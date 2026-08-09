import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { previewPeriodClose, closePeriod, requestPeriodReopen } from '../lib/periodCloseService.js'
import { sendExport } from '../lib/exportService.js'

// Finance Phase 1 — read-only views over the General Ledger (Journal +
// JournalLine). Trial balance, ledger, and income statement are computed on
// demand from JournalLine rather than stored, so they can never drift out of
// sync with the journals that back them.
const router = Router()

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// A bare "YYYY-MM-DD" (the normal shape from a date picker) parses as UTC
// midnight — used unadjusted as an `lte` bound, "to 2026-08-31" would exclude
// virtually the entire day's activity instead of including it. Append
// end-of-day only when the string doesn't already carry its own time
// component (a full ISO datetime passed in from elsewhere should be trusted
// as-is) — same fix as vatReportService.js's dateRangeWhere.
function endOfDayIfBareDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T23:59:59.999Z` : dateStr
}

function dateRangeWhere(from, to) {
  const where = {}
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(endOfDayIfBareDate(to))
  }
  return where
}

// Shared by /trial-balance, /balance-sheet, and /cash-flow's opening/closing
// cash balances — every account (optionally filtered by accountWhere) with
// its cumulative debit/credit/balance under journalWhere.
async function computeAccountBalances(journalWhere, accountWhere = {}) {
  const accounts = await prisma.chartOfAccount.findMany({ where: accountWhere, orderBy: { code: 'asc' } })
  const sums = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { journal: journalWhere, accountId: { in: accounts.map(a => a.id) } },
    _sum: { debit: true, credit: true }
  })
  const sumByAccount = new Map(sums.map(s => [s.accountId, s._sum]))

  return accounts.map(a => {
    const sum = sumByAccount.get(a.id)
    const debit = Number(sum?.debit || 0)
    const credit = Number(sum?.credit || 0)
    return {
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.normalBalance,
      debit,
      credit,
      balance: a.normalBalance === 'DEBIT' ? debit - credit : credit - debit
    }
  })
}

// Shared by /income-statement and /balance-sheet's undistributed-net-income
// equity line.
async function computeIncomeStatement(journalWhere) {
  const rows = await computeAccountBalances(journalWhere, { type: { in: ['REVENUE', 'EXPENSE'] } })

  const revenue = []
  const expenses = []
  let totalRevenue = 0
  let totalExpenses = 0

  for (const r of rows) {
    if (r.type === 'REVENUE') {
      // credit - debit unconditionally (not keyed off normalBalance): this
      // makes 4900 Sales Returns & Allowances — a DEBIT-balance contra
      // account — come out negative here, correctly netting refunds off
      // 4000/4010 rather than adding to revenue.
      const net = r.credit - r.debit
      revenue.push({ code: r.code, name: r.name, amount: net })
      totalRevenue += net
    } else {
      const net = r.debit - r.credit
      expenses.push({ code: r.code, name: r.name, amount: net })
      totalExpenses += net
    }
  }

  return { revenue, totalRevenue, expenses, totalExpenses, netProfit: totalRevenue - totalExpenses }
}

router.get('/chart-of-accounts', requireAdmin, async (req, res, next) => {
  try {
    const accounts = await prisma.chartOfAccount.findMany({ orderBy: { code: 'asc' } })
    res.json(accounts)
  } catch (err) { next(err) }
})

// GET /trial-balance?asOf=2026-08-31 — every account's cumulative debit/credit
// as of a date (all journals if omitted). Balances to zero (total debits ==
// total credits) whenever the GL is internally consistent.
router.get('/trial-balance', requireAdmin, async (req, res, next) => {
  try {
    const { asOf, format } = req.query
    const journalWhere = asOf ? { date: { lte: new Date(endOfDayIfBareDate(asOf)) } } : {}

    const rows = await computeAccountBalances(journalWhere)
    const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0)
    const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0)

    if (format) {
      const columns = [
        { key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'type', label: 'Type' },
        { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'balance', label: 'Balance' },
      ]
      if (await sendExport(res, format, `trial-balance${asOf ? '-' + asOf : ''}`, columns, rows)) return
    }

    res.json({ asOf: asOf || null, accounts: rows, totalDebit, totalCredit })
  } catch (err) { next(err) }
})

// GET /ledger/:accountCode?from=&to= — every journal line posted to one
// account, oldest first, with a running balance.
router.get('/ledger/:accountCode', requireAdmin, async (req, res, next) => {
  try {
    const account = await prisma.chartOfAccount.findUnique({ where: { code: req.params.accountCode } })
    if (!account) return res.status(404).json({ error: 'Unknown account code' })

    const { from, to, format } = req.query
    const lines = await prisma.journalLine.findMany({
      where: { accountId: account.id, journal: dateRangeWhere(from, to) },
      include: { journal: true },
      orderBy: { journal: { date: 'asc' } }
    })

    let running = 0
    const entries = lines.map(l => {
      const debit = Number(l.debit)
      const credit = Number(l.credit)
      running += account.normalBalance === 'DEBIT' ? debit - credit : credit - debit
      return {
        journalNumber: l.journal.journalNumber,
        date: l.journal.date,
        description: l.journal.description,
        memo: l.memo,
        debit,
        credit,
        runningBalance: running
      }
    })

    if (format) {
      const columns = [
        { key: 'journalNumber', label: 'Journal' },
        { key: 'date', label: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
        { key: 'description', label: 'Description' }, { key: 'memo', label: 'Memo' },
        { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'runningBalance', label: 'Running Balance' },
      ]
      if (await sendExport(res, format, `ledger-${account.code}`, columns, entries)) return
    }

    res.json({ account: { code: account.code, name: account.name, type: account.type, normalBalance: account.normalBalance }, entries })
  } catch (err) { next(err) }
})

// GET /journals?sourceType=&from=&to= — journal headers with their lines.
router.get('/journals', requireAdmin, async (req, res, next) => {
  try {
    const { sourceType, from, to, format } = req.query
    const where = dateRangeWhere(from, to)
    if (sourceType) where.sourceType = sourceType

    const journals = await prisma.journal.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'desc' }
    })

    if (format) {
      // One row per journal LINE (not per journal) — the standard "journal
      // listing" export shape, with the journal-level fields repeated on
      // every line so the file is self-contained without a second sheet.
      const flatRows = journals.flatMap(j => j.lines.map(l => ({
        journalNumber: j.journalNumber,
        date: j.date,
        description: j.description,
        sourceType: j.sourceType,
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
        memo: l.memo,
      })))
      const columns = [
        { key: 'journalNumber', label: 'Journal' },
        { key: 'date', label: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
        { key: 'description', label: 'Description' }, { key: 'sourceType', label: 'Source' },
        { key: 'accountCode', label: 'Account Code' }, { key: 'accountName', label: 'Account' },
        { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'memo', label: 'Memo' },
      ]
      if (await sendExport(res, format, 'journals', columns, flatRows)) return
    }

    res.json(journals)
  } catch (err) { next(err) }
})

// GET /income-statement?from=&to= — Revenue less COGS/Expense over a range.
router.get('/income-statement', requireAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query
    const stmt = await computeIncomeStatement(dateRangeWhere(from, to))
    res.json({ from: from || null, to: to || null, ...stmt })
  } catch (err) { next(err) }
})

// GET /balance-sheet?asOf= — Assets = Liabilities + Equity. Equity includes
// an "Net Income (undistributed)" plug line because this system never runs
// a period-closing step that sweeps Revenue/Expense into Retained Earnings
// — the same reason any live (pre-close) balance sheet shows a current-
// earnings line. `balanced` is a self-check, same role as trial-balance's
// totalDebit/totalCredit.
router.get('/balance-sheet', requireAdmin, async (req, res, next) => {
  try {
    const { asOf } = req.query
    const journalWhere = asOf ? { date: { lte: new Date(endOfDayIfBareDate(asOf)) } } : {}

    const rows = await computeAccountBalances(journalWhere, { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } })
    const toLine = r => ({ code: r.code, name: r.name, balance: r.balance })
    const assets = rows.filter(r => r.type === 'ASSET').map(toLine)
    const liabilities = rows.filter(r => r.type === 'LIABILITY').map(toLine)
    const equityAccounts = rows.filter(r => r.type === 'EQUITY').map(toLine)

    const { netProfit } = await computeIncomeStatement(journalWhere)
    const equity = [...equityAccounts, { code: null, name: 'Net Income (undistributed)', balance: round2(netProfit) }]

    const totalAssets = round2(assets.reduce((s, a) => s + a.balance, 0))
    const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0))
    const totalEquity = round2(equity.reduce((s, a) => s + a.balance, 0))

    res.json({
      asOf: asOf || null,
      assets, totalAssets,
      liabilities, totalLiabilities,
      equity, totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    })
  } catch (err) { next(err) }
})

const CASH_ACCOUNT_CODES = ['1000', '1010']
const OPERATING_SOURCE_LABELS = {
  ORDER_PAYMENT: 'Cash received from customers',
  REFUND: 'Refunds paid to customers',
  SUPPLIER_PAYMENT: 'Payments to suppliers'
}
// SARS Compliance Phase F — Fixed Assets (Finance Phase 11) does touch cash
// (postAssetAcquisitionJournal/postAssetDisposalJournal both move 1010), so
// this was never really "no data yet" — it was real cash activity being
// silently swept into `other` because this map only knew about the three
// operating source types. Financing stays genuinely empty: nothing posts a
// loan or equity-and-cash movement anywhere in the app yet.
const INVESTING_SOURCE_LABELS = {
  ASSET_ACQUISITION: 'Purchase of fixed assets',
  ASSET_DISPOSAL: 'Proceeds from disposal of fixed assets'
}

// GET /cash-flow?from=&to= — direct method. Anything unclassified (a future
// phase adds a new sourceType that touches cash without this route being
// updated) lands in `other` rather than silently vanishing from the statement.
router.get('/cash-flow', requireAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query

    const lines = await prisma.journalLine.findMany({
      where: { account: { code: { in: CASH_ACCOUNT_CODES } }, journal: dateRangeWhere(from, to) },
      include: { journal: { select: { sourceType: true } } }
    })

    const bySourceType = new Map()
    for (const l of lines) {
      const st = l.journal.sourceType
      const net = Number(l.debit) - Number(l.credit) // cash accounts are DEBIT-normal
      bySourceType.set(st, (bySourceType.get(st) || 0) + net)
    }

    const operating = []
    let netOperating = 0
    for (const [sourceType, label] of Object.entries(OPERATING_SOURCE_LABELS)) {
      const amount = round2(bySourceType.get(sourceType) || 0)
      operating.push({ sourceType, label, amount })
      netOperating += amount
      bySourceType.delete(sourceType)
    }

    const investing = []
    let netInvesting = 0
    for (const [sourceType, label] of Object.entries(INVESTING_SOURCE_LABELS)) {
      if (!bySourceType.has(sourceType)) continue
      const amount = round2(bySourceType.get(sourceType))
      investing.push({ sourceType, label, amount })
      netInvesting += amount
      bySourceType.delete(sourceType)
    }

    const other = [...bySourceType.entries()].map(([sourceType, amount]) => ({ sourceType, amount: round2(amount) }))
    const netOther = other.reduce((s, o) => s + o.amount, 0)

    const financing = []
    const netFinancing = 0

    const netChangeInCash = round2(netOperating + netInvesting + netFinancing + netOther)

    const openingRows = from
      ? await computeAccountBalances({ date: { lt: new Date(from) } }, { code: { in: CASH_ACCOUNT_CODES } })
      : []
    const openingCash = round2(openingRows.reduce((s, r) => s + r.balance, 0))

    const closingRows = await computeAccountBalances(
      to ? { date: { lte: new Date(endOfDayIfBareDate(to)) } } : {},
      { code: { in: CASH_ACCOUNT_CODES } }
    )
    const closingCash = round2(closingRows.reduce((s, r) => s + r.balance, 0))

    res.json({
      from: from || null,
      to: to || null,
      operating, netOperating,
      investing, netInvesting,
      financing, netFinancing,
      other, netOther,
      netChangeInCash,
      openingCash,
      closingCash,
      reconciles: Math.abs(round2(openingCash + netChangeInCash) - closingCash) < 0.01
    })
  } catch (err) { next(err) }
})

const AGING_BUCKETS = [
  { label: 'Current (0-30)', max: 30 },
  { label: '31-60 days', max: 60 },
  { label: '61-90 days', max: 90 },
  { label: '90+ days', max: Infinity }
]

function bucketFor(days) {
  return (AGING_BUCKETS.find(b => days <= b.max) || AGING_BUCKETS[AGING_BUCKETS.length - 1]).label
}

function emptyBucketTotals() {
  return Object.fromEntries(AGING_BUCKETS.map(b => [b.label, 0]))
}

function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

// GET /aged-receivables?asOf= — outstanding orders bucketed by age since
// creation. Only sums COMPLETE payments — a manual-EFT Payment row is
// created PENDING at checkout and only flips to COMPLETE once an admin
// verifies it (see eftPaymentService.js), so an unverified proof sitting in
// the queue must not make an order look paid before it actually is.
router.get('/aged-receivables', requireAdmin, async (req, res, next) => {
  try {
    const asOf = req.query.asOf ? new Date(endOfDayIfBareDate(req.query.asOf)) : new Date()
    const orders = await prisma.order.findMany({
      where: { paymentStatus: { in: ['unpaid', 'partially_paid'] }, createdAt: { lte: asOf } },
      include: { payments: true, customer: true }
    })

    const rows = []
    for (const o of orders) {
      const amountPaid = round2(o.payments.filter(p => p.paymentStatus === 'COMPLETE').reduce((s, p) => s + Number(p.amount || 0), 0))
      const amountOutstanding = round2(Number(o.totalAmount) - amountPaid)
      if (amountOutstanding <= 0) continue

      const daysOutstanding = daysBetween(o.createdAt, asOf)
      rows.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.name || o.customer?.email || 'Guest',
        totalAmount: Number(o.totalAmount),
        amountPaid,
        amountOutstanding,
        daysOutstanding,
        bucket: bucketFor(daysOutstanding)
      })
    }
    rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding)

    const bucketTotals = emptyBucketTotals()
    for (const r of rows) bucketTotals[r.bucket] = round2(bucketTotals[r.bucket] + r.amountOutstanding)
    const totalOutstanding = round2(rows.reduce((s, r) => s + r.amountOutstanding, 0))

    if (req.query.format) {
      const columns = [
        { key: 'orderNumber', label: 'Order' }, { key: 'customerName', label: 'Customer' },
        { key: 'totalAmount', label: 'Total' }, { key: 'amountPaid', label: 'Paid' },
        { key: 'amountOutstanding', label: 'Outstanding' }, { key: 'daysOutstanding', label: 'Days' }, { key: 'bucket', label: 'Bucket' },
      ]
      if (await sendExport(res, req.query.format, 'aged-receivables', columns, rows)) return
    }

    res.json({ asOf: asOf.toISOString(), rows, bucketTotals, totalOutstanding })
  } catch (err) { next(err) }
})

// GET /aged-payables?asOf= — outstanding purchases bucketed by age since
// receipt (when the AP liability actually posted — see accountingService.js
// postPurchaseReceivedJournal — not when the PO was placed). SupplierPayment
// has no verification workflow (admin-recorded, immediately final), so
// every row counts.
router.get('/aged-payables', requireAdmin, async (req, res, next) => {
  try {
    const asOf = req.query.asOf ? new Date(endOfDayIfBareDate(req.query.asOf)) : new Date()
    const purchases = await prisma.purchase.findMany({
      where: { status: 'RECEIVED', paymentStatus: { in: ['unpaid', 'partially_paid'] }, receivedAt: { lte: asOf } },
      include: { payments: true, supplier: true }
    })

    const rows = []
    for (const p of purchases) {
      const amountPaid = round2(p.payments.reduce((s, sp) => s + Number(sp.amount || 0), 0))
      const amountOutstanding = round2(Number(p.totalCost || 0) - amountPaid)
      if (amountOutstanding <= 0) continue

      const daysOutstanding = daysBetween(p.receivedAt, asOf)
      rows.push({
        purchaseId: p.id,
        supplierName: p.supplier?.name || 'Unknown Supplier',
        totalCost: Number(p.totalCost || 0),
        amountPaid,
        amountOutstanding,
        daysOutstanding,
        bucket: bucketFor(daysOutstanding)
      })
    }
    rows.sort((a, b) => b.daysOutstanding - a.daysOutstanding)

    const bucketTotals = emptyBucketTotals()
    for (const r of rows) bucketTotals[r.bucket] = round2(bucketTotals[r.bucket] + r.amountOutstanding)
    const totalOutstanding = round2(rows.reduce((s, r) => s + r.amountOutstanding, 0))

    if (req.query.format) {
      const columns = [
        { key: 'supplierName', label: 'Supplier' }, { key: 'totalCost', label: 'Total Cost' },
        { key: 'amountPaid', label: 'Paid' }, { key: 'amountOutstanding', label: 'Outstanding' },
        { key: 'daysOutstanding', label: 'Days' }, { key: 'bucket', label: 'Bucket' },
      ]
      if (await sendExport(res, req.query.format, 'aged-payables', columns, rows)) return
    }

    res.json({ asOf: asOf.toISOString(), rows, bucketTotals, totalOutstanding })
  } catch (err) { next(err) }
})

// GET /cash-flow-forecast?days=30 — two honestly-separated pieces rather
// than one falsely-precise number: scheduled inflows (PENDING
// PaymentMilestones with a dueDate inside the window — B2B/milestone orders
// only, an actual date exists) vs. unscheduled receivables/payables (real
// money owed with no specific expected date, reported for visibility but
// excluded from the projection itself since there's no date to place them
// on).
router.get('/cash-flow-forecast', requireAdmin, async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30
    const now = new Date()
    const windowEnd = new Date(now.getTime() + days * 86400000)

    const cashRows = await computeAccountBalances({}, { code: { in: ['1000', '1010'] } })
    const currentCashBalance = round2(cashRows.reduce((s, r) => s + r.balance, 0))

    const milestones = await prisma.paymentMilestone.findMany({
      where: { status: 'PENDING', dueDate: { gte: now, lte: windowEnd } }
    })
    const scheduledInflows = round2(milestones.reduce((s, m) => s + Number(m.amountDue), 0))

    const unpaidOrders = await prisma.order.findMany({
      where: { paymentStatus: { in: ['unpaid', 'partially_paid'] } },
      include: { payments: true }
    })
    let unscheduledReceivablesOutstanding = 0
    for (const o of unpaidOrders) {
      const paid = o.payments.filter(p => p.paymentStatus === 'COMPLETE').reduce((s, p) => s + Number(p.amount || 0), 0)
      const outstanding = Number(o.totalAmount) - paid
      if (outstanding > 0) unscheduledReceivablesOutstanding += outstanding
    }
    unscheduledReceivablesOutstanding = round2(unscheduledReceivablesOutstanding)

    const unpaidPurchases = await prisma.purchase.findMany({
      where: { status: 'RECEIVED', paymentStatus: { in: ['unpaid', 'partially_paid'] } },
      include: { payments: true }
    })
    let payablesOutstanding = 0
    for (const p of unpaidPurchases) {
      const paid = p.payments.reduce((s, sp) => s + Number(sp.amount || 0), 0)
      const outstanding = Number(p.totalCost || 0) - paid
      if (outstanding > 0) payablesOutstanding += outstanding
    }
    payablesOutstanding = round2(payablesOutstanding)

    const projectedCashBalance = round2(currentCashBalance + scheduledInflows - payablesOutstanding)

    res.json({
      days,
      currentCashBalance,
      scheduledInflows,
      unscheduledReceivablesOutstanding,
      payablesOutstanding,
      projectedCashBalance
    })
  } catch (err) { next(err) }
})

// GET /fiscal-periods — every period, oldest first, with a live net-income
// preview for OPEN ones (what closing it right now would sweep to Retained
// Earnings) so an admin isn't closing blind.
router.get('/fiscal-periods', requireAdmin, async (req, res, next) => {
  try {
    const periods = await prisma.fiscalPeriod.findMany({ orderBy: { startDate: 'asc' } })
    const withPreview = await Promise.all(periods.map(async (p) => {
      if (p.status === 'CLOSED') return { ...p, previewNetProfit: null }
      const { netProfit } = await previewPeriodClose(p.id)
      return { ...p, previewNetProfit: netProfit }
    }))
    res.json(withPreview)
  } catch (err) { next(err) }
})

router.post('/fiscal-periods/:id/close', requireAdmin, async (req, res, next) => {
  try {
    const result = await closePeriod(req.params.id, { adminId: req.adminId })
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// Any admin can request a reopen; approvalService.js's existing
// "a different admin must decide" rule is the actual control — see
// /api/admin/approvals for the approve/reject side of this.
router.post('/fiscal-periods/:id/reopen-request', requireAdmin, async (req, res, next) => {
  try {
    const request = await requestPeriodReopen(req.params.id, req.adminId)
    res.status(201).json(request)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
