// SARS Compliance Phase G — the dashboard is deliberately a read-only
// aggregation over everything Phases A-F already built (VAT settings, VAT
// reports, fiscal periods, bank reconciliation, aged balances). No new
// source of truth, and no attempt to calculate SARS filing due dates —
// this system doesn't know your VAT vendor category or filing frequency
// well enough to state a due date with any authority, so "reporting
// deadlines" is a plain admin-entered list instead of a guess dressed up
// as a calculation.
import crypto from 'crypto'
import prisma from './prisma.js'
import configStore from './configStore.js'
import { getVatSummary } from './vatReportService.js'
import { getReconciliation } from './bankingService.js'
import { round2 } from './accountingService.js'

const TAX_IDENTITY_FIELDS = [
  { key: 'company_legal_name', label: 'Registered Company Name' },
  { key: 'company_registration_number', label: 'Company Registration Number' },
  { key: 'income_tax_reference_number', label: 'Income Tax Reference Number' },
  { key: 'financial_year_start_month', label: 'Financial Year Start' },
  { key: 'financial_year_end_month', label: 'Financial Year End' },
]

async function getReceivablesTotal() {
  const orders = await prisma.order.findMany({
    where: { paymentStatus: { in: ['unpaid', 'partially_paid'] } },
    include: { payments: { where: { paymentStatus: 'COMPLETE' }, select: { amount: true } } },
  })
  let total = 0
  for (const o of orders) {
    const paid = o.payments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const outstanding = Number(o.totalAmount) - paid
    if (outstanding > 0) total += outstanding
  }
  return round2(total)
}

async function getPayablesTotal() {
  const purchases = await prisma.purchase.findMany({
    where: { status: 'RECEIVED', paymentStatus: { in: ['unpaid', 'partially_paid'] } },
    include: { payments: { select: { amount: true } } },
  })
  let total = 0
  for (const p of purchases) {
    const paid = p.payments.reduce((s, sp) => s + Number(sp.amount || 0), 0)
    const outstanding = Number(p.totalCost || 0) - paid
    if (outstanding > 0) total += outstanding
  }
  return round2(total)
}

export async function getComplianceSummary() {
  const taxSettings = await prisma.globalSetting.findMany({ where: { group: 'tax' } })
  const taxMap = Object.fromEntries(taxSettings.map(s => [s.key, s.value]))
  const vatRegistered = taxMap.vat_registered === 'true'

  const requiredFields = vatRegistered
    ? [...TAX_IDENTITY_FIELDS, { key: 'vat_registration_number', label: 'VAT Registration Number' }]
    : TAX_IDENTITY_FIELDS
  const missingTaxInfo = requiredFields.filter(f => !taxMap[f.key]).map(f => f.label)

  const periods = await prisma.fiscalPeriod.findMany({ orderBy: { startDate: 'desc' } })
  const openPeriods = periods.filter(p => p.status === 'OPEN')
  const currentPeriod = openPeriods[0] || null
  // Any OPEN period other than the current (most recent) one is stale — it
  // should have been closed by now. Not "unposted journals" (nothing here
  // is ever left half-posted — postJournal is all-or-nothing), but the same
  // underlying signal the brief was after: work that hasn't been finalised.
  const staleOpenPeriods = openPeriods.slice(1)

  const vatSummary = currentPeriod
    ? await getVatSummary({ startDate: currentPeriod.startDate.toISOString(), endDate: currentPeriod.endDate.toISOString() })
    : await getVatSummary({})

  const bankAccounts = await prisma.bankAccount.findMany({ where: { isActive: true } })
  const bankReconciliation = []
  for (const acct of bankAccounts) {
    const { unmatchedTransactions, unmatchedJournalLines } = await getReconciliation(acct.id)
    bankReconciliation.push({
      bankAccountId: acct.id,
      bankAccountName: acct.name,
      unmatchedTransactions: unmatchedTransactions.length,
      unmatchedJournalLines: unmatchedJournalLines.length,
    })
  }
  const totalUnreconciled = bankReconciliation.reduce((s, b) => s + b.unmatchedTransactions + b.unmatchedJournalLines, 0)

  const [receivablesTotal, payablesTotal] = await Promise.all([getReceivablesTotal(), getPayablesTotal()])

  return {
    vatRegistered,
    businessTaxIdentity: { ...taxMap, missingFields: missingTaxInfo },
    currentPeriod,
    staleOpenPeriodCount: staleOpenPeriods.length,
    staleOpenPeriods: staleOpenPeriods.map(p => p.label),
    vatSummary,
    bankReconciliation,
    totalUnreconciled,
    receivablesTotal,
    payablesTotal,
    readiness: {
      businessIdentityComplete: missingTaxInfo.length === 0,
      // Zero bank accounts would otherwise satisfy `totalUnreconciled === 0`
      // by vacuous truth (reduce over an empty array is 0) and read as a
      // reassuring green check — "reconciled" should mean something was
      // actually checked, not that there was nothing to check.
      bankFullyReconciled: bankAccounts.length > 0 && totalUnreconciled === 0,
      noStalePeriods: staleOpenPeriods.length === 0,
    },
  }
}

// Reporting deadlines — plain admin-entered {label, dueDate} pairs, stored
// as one JSON GlobalSetting rather than a new table; this is a short list a
// human maintains, not queried/joined data.
const DEADLINES_KEY = 'reporting_deadlines'

async function readDeadlines() {
  const raw = await configStore.get(DEADLINES_KEY, '[]')
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeDeadlines(deadlines) {
  await prisma.globalSetting.upsert({
    where: { key: DEADLINES_KEY },
    update: { value: JSON.stringify(deadlines) },
    create: { key: DEADLINES_KEY, value: JSON.stringify(deadlines), group: 'tax' },
  })
  configStore.clearCache()
}

export async function getDeadlines() {
  const deadlines = await readDeadlines()
  return deadlines.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
}

export async function addDeadline({ label, dueDate }) {
  if (!label || !dueDate) throw Object.assign(new Error('label and dueDate are required'), { status: 400 })
  // The shipped UI only ever sends a value from <input type="date">, but this
  // endpoint is reachable directly too — a bad date here would silently sit
  // on the dashboard forever as an un-sortable "NaNd" badge, since dueDate
  // only ever gets read back through `new Date(...)`, never re-validated.
  if (Number.isNaN(new Date(dueDate).getTime())) {
    throw Object.assign(new Error('dueDate is not a valid date'), { status: 400 })
  }
  const deadlines = await readDeadlines()
  const entry = { id: crypto.randomUUID(), label, dueDate }
  deadlines.push(entry)
  await writeDeadlines(deadlines)
  return entry
}

export async function removeDeadline(id) {
  const deadlines = await readDeadlines()
  const next = deadlines.filter(d => d.id !== id)
  await writeDeadlines(next)
}
