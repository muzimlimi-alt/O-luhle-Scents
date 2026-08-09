// SARS Compliance Phase C — VAT reporting, read entirely from the existing
// General Ledger rather than a parallel VAT data store. Output VAT lives on
// account 2100 (credited by postSaleRecognitionJournal, debited/reversed by
// postRefundJournal); Input VAT lives on account 1150 (debited by
// postPurchaseReceivedJournal) — see accountingService.js. Reading the GL
// directly means these reports can never drift from what's actually posted.
import prisma from './prisma.js'
import { round2 } from './accountingService.js'

async function getAccountId(code) {
  const account = await prisma.chartOfAccount.findUnique({ where: { code } })
  if (!account) {
    throw Object.assign(new Error(`Chart of account ${code} not found — has seed_chart_of_accounts.js been run?`), { status: 500 })
  }
  return account.id
}

// Accepts either a bare "YYYY-MM-DD" (from a date-picker/query-param — the
// original assumption, which needs the end-of-day suffix appended so "to
// 2026-08-31" includes the whole day) or a full ISO datetime already carrying
// its own time component (e.g. FiscalPeriod.endDate.toISOString(), used by
// complianceDashboardService.js) — blindly concatenating the suffix onto an
// already-complete datetime string used to produce "...999ZT23:59:59.999Z",
// which Date() silently turned into Invalid Date.
function endOfDayIfBareDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T23:59:59.999Z` : dateStr
}

function dateRangeWhere(startDate, endDate) {
  const where = {}
  if (startDate) where.gte = new Date(startDate)
  if (endDate) where.lte = new Date(endOfDayIfBareDate(endDate))
  return Object.keys(where).length ? where : undefined
}

// Every JournalLine against 2100 — sale lines are always a credit (VAT
// collected), refund lines are always a debit (VAT reversed on that specific
// order's own historical rate, not today's — see postRefundJournal). Signing
// refunds negative here means totalOutputVat is already net of reversals.
export async function getOutputVatRegister({ startDate, endDate } = {}) {
  const accountId = await getAccountId('2100')
  const dateWhere = dateRangeWhere(startDate, endDate)

  const lines = await prisma.journalLine.findMany({
    where: { accountId, ...(dateWhere ? { journal: { date: dateWhere } } : {}) },
    include: { journal: true },
    orderBy: { journal: { date: 'asc' } },
  })

  const orderIds = lines.filter(l => l.journal.sourceType === 'ORDER_SALE').map(l => l.journal.sourceId)
  const refundIds = lines.filter(l => l.journal.sourceType === 'REFUND').map(l => l.journal.sourceId)

  const [orders, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNumber: true, customer: { select: { name: true, email: true } } },
    }),
    prisma.refund.findMany({
      where: { id: { in: refundIds } },
      select: { id: true, order: { select: { orderNumber: true, customer: { select: { name: true, email: true } } } } },
    }),
  ])
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const refundMap = new Map(refunds.map(r => [r.id, r]))

  const rows = lines.map(l => {
    const isRefund = l.journal.sourceType === 'REFUND'
    const source = isRefund ? refundMap.get(l.journal.sourceId)?.order : orderMap.get(l.journal.sourceId)
    return {
      date: l.journal.date,
      journalNumber: l.journal.journalNumber,
      type: isRefund ? 'refund' : 'sale',
      orderNumber: source?.orderNumber || null,
      customerName: source?.customer?.name || null,
      customerEmail: source?.customer?.email || null,
      vatAmount: isRefund ? -round2(l.debit) : round2(l.credit),
    }
  })

  return { rows, totalOutputVat: round2(rows.reduce((sum, r) => sum + r.vatAmount, 0)) }
}

// Every JournalLine against 1150 — always a debit (input VAT recoverable),
// posted once per Purchase at goods-received time.
export async function getInputVatRegister({ startDate, endDate } = {}) {
  const accountId = await getAccountId('1150')
  const dateWhere = dateRangeWhere(startDate, endDate)

  const lines = await prisma.journalLine.findMany({
    where: { accountId, ...(dateWhere ? { journal: { date: dateWhere } } : {}) },
    include: { journal: true },
    orderBy: { journal: { date: 'asc' } },
  })

  const purchaseIds = lines.map(l => l.journal.sourceId).filter(Boolean)
  const purchases = await prisma.purchase.findMany({
    where: { id: { in: purchaseIds } },
    select: { id: true, supplier: { select: { name: true } }, receivedAt: true, totalCost: true },
  })
  const purchaseMap = new Map(purchases.map(p => [p.id, p]))

  const rows = lines.map(l => {
    const purchase = purchaseMap.get(l.journal.sourceId)
    return {
      date: l.journal.date,
      journalNumber: l.journal.journalNumber,
      purchaseRef: l.journal.sourceId ? l.journal.sourceId.split('-')[0].toUpperCase() : null,
      supplierName: purchase?.supplier?.name || null,
      totalCost: purchase ? round2(purchase.totalCost) : null,
      vatAmount: round2(l.debit),
    }
  })

  return { rows, totalInputVat: round2(rows.reduce((sum, r) => sum + r.vatAmount, 0)) }
}

export async function getVatSummary({ startDate, endDate } = {}) {
  const [output, input] = await Promise.all([
    getOutputVatRegister({ startDate, endDate }),
    getInputVatRegister({ startDate, endDate }),
  ])

  return {
    period: { startDate: startDate || null, endDate: endDate || null },
    totalOutputVat: output.totalOutputVat,
    totalInputVat: input.totalInputVat,
    // Positive = owed TO SARS (output exceeds input); negative = a refund
    // position (input exceeds output) — standard VAT201 framing.
    netVatPosition: round2(output.totalOutputVat - input.totalInputVat),
    salesTransactionCount: output.rows.filter(r => r.type === 'sale').length,
    refundTransactionCount: output.rows.filter(r => r.type === 'refund').length,
    purchaseTransactionCount: input.rows.length,
  }
}
