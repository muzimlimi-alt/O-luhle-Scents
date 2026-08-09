// SARS Compliance Phase D — activates the fiscal-period lock that has
// existed since Finance Phase 1 (accountingService.js's ensureOpenFiscalPeriod
// genuinely rejects postings into a CLOSED period) but was never reachable —
// nothing anywhere ever set a period to CLOSED. Closing a period also fixes
// the Balance Sheet's "Net Income (undistributed)" plug line as a side
// effect: that line exists only because nothing ever swept Revenue/Expense
// into Retained Earnings (3100) — see admin_finance.js's balance-sheet route.
import prisma from './prisma.js'
import { postJournal, round2 } from './accountingService.js'
import { createApprovalRequest } from './approvalService.js'

const RETAINED_EARNINGS_CODE = '3100'

// Deliberately re-derives the period's net income from scratch every time
// rather than tracking "what's already closed" separately. This is what
// makes closing a REOPENED period safe without extra bookkeeping: the first
// close's reversing entries are themselves journal lines dated inside the
// period, so re-summing the same date range nets them against the original
// activity, leaving only whatever's been posted since (a correction, say) —
// see the design note in the PR/commit that introduced this file for the
// worked-through math.
async function computePeriodRevenueExpense(periodStart, periodEnd) {
  const accounts = await prisma.chartOfAccount.findMany({ where: { type: { in: ['REVENUE', 'EXPENSE'] } } })
  const sums = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accounts.map(a => a.id) },
      journal: { date: { gte: periodStart, lte: periodEnd } },
    },
    _sum: { debit: true, credit: true },
  })
  const sumByAccount = new Map(sums.map(s => [s.accountId, s._sum]))

  const rows = accounts.map(a => {
    const sum = sumByAccount.get(a.id)
    const debit = Number(sum?.debit || 0)
    const credit = Number(sum?.credit || 0)
    // Same convention as admin_finance.js's computeIncomeStatement: revenue
    // net = credit - debit (unconditional, so a contra-revenue account like
    // 4900 Sales Returns comes out negative and correctly reduces revenue);
    // expense net = debit - credit.
    const net = a.type === 'REVENUE' ? credit - debit : debit - credit
    return { code: a.code, type: a.type, net: round2(net) }
  })

  const totalRevenue = round2(rows.filter(r => r.type === 'REVENUE').reduce((s, r) => s + r.net, 0))
  const totalExpenses = round2(rows.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + r.net, 0))
  return { rows: rows.filter(r => Math.abs(r.net) > 0.001), netProfit: round2(totalRevenue - totalExpenses) }
}

export async function previewPeriodClose(periodId) {
  const period = await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: periodId } })
  const { netProfit } = await computePeriodRevenueExpense(period.startDate, period.endDate)
  return { period, netProfit }
}

export async function closePeriod(periodId, { adminId } = {}) {
  const period = await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: periodId } })
  if (period.status === 'CLOSED') {
    throw Object.assign(new Error(`Period ${period.label} is already closed`), { status: 400 })
  }

  // Closing out of order would let an earlier period's correction, if one's
  // ever needed, post straight into an already-swept Retained Earnings
  // figure with nothing to reconcile against — close oldest-first.
  const earlierOpenPeriod = await prisma.fiscalPeriod.findFirst({
    where: { status: 'OPEN', startDate: { lt: period.startDate } },
    orderBy: { startDate: 'asc' },
  })
  if (earlierOpenPeriod) {
    throw Object.assign(
      new Error(`Cannot close ${period.label} — ${earlierOpenPeriod.label} is still open and comes first`),
      { status: 400 }
    )
  }

  const { rows, netProfit } = await computePeriodRevenueExpense(period.startDate, period.endDate)

  return prisma.$transaction(async (tx) => {
    if (rows.length > 0) {
      const lines = rows.map(r => ({
        accountCode: r.code,
        // Zeroing a REVENUE row (net = credit - debit) takes a debit of
        // +net or a credit of -net; an EXPENSE row (net = debit - credit)
        // takes the opposite. Same line either way: post the sign that
        // cancels net, whichever side it's on. REVENUE and EXPENSE take
        // opposite signs here — revenue's net is (credit - debit), so a
        // normal positive net needs a DEBIT to zero it; expense's net is
        // (debit - credit), so a normal positive net needs a CREDIT.
        debit: r.type === 'REVENUE' ? (r.net > 0 ? r.net : 0) : (r.net < 0 ? -r.net : 0),
        credit: r.type === 'REVENUE' ? (r.net < 0 ? -r.net : 0) : (r.net > 0 ? r.net : 0),
        memo: `Period close — ${period.label}`,
      }))
      if (Math.abs(netProfit) > 0.001) {
        lines.push(netProfit > 0
          ? { accountCode: RETAINED_EARNINGS_CODE, debit: 0, credit: netProfit, memo: `Period close — ${period.label}` }
          : { accountCode: RETAINED_EARNINGS_CODE, debit: -netProfit, credit: 0, memo: `Period close — ${period.label}` })
      }

      await postJournal(tx, {
        sourceType: 'PERIOD_CLOSE',
        sourceId: period.id,
        date: period.endDate,
        description: `Period close — ${period.label} (net ${netProfit >= 0 ? 'income' : 'loss'} R${Math.abs(netProfit).toFixed(2)} to Retained Earnings)`,
        lines,
        postedByAdminId: adminId,
      })
    }

    // The status re-check above ran outside this transaction — two admins
    // closing the same period within the same instant could both pass it and
    // both post a journal above before either commits. This conditional
    // update is the real guard, run AFTER posting (not before — posting
    // first is required, since postJournal's own ensureOpenFiscalPeriod
    // check would reject its own closing journal if status flipped to
    // CLOSED first). Postgres re-evaluates an UPDATE's WHERE clause against
    // the latest committed row once it acquires the row lock, even under
    // READ COMMITTED — so whichever of the two transactions reaches this
    // second finds `count: 0` once the first has committed, and throwing
    // here rolls back everything in THIS transaction, including the journal
    // just posted above. No double-post survives either way.
    const { count } = await tx.fiscalPeriod.updateMany({ where: { id: period.id, status: 'OPEN' }, data: { status: 'CLOSED' } })
    if (count === 0) {
      throw Object.assign(new Error(`Period ${period.label} is already closed`), { status: 400 })
    }

    await tx.auditLog.create({
      data: { adminUserId: adminId, action: 'CLOSE_FISCAL_PERIOD', entity: 'FiscalPeriod', entityId: period.id, details: { label: period.label, netProfit } }
    })
    const updated = await tx.fiscalPeriod.findUniqueOrThrow({ where: { id: period.id } })
    return { period: updated, netProfit }
  })
}

// Reopening doesn't itself post anything — it just lifts the write-block so
// a correction can be posted, then the period should be closed again (see
// computePeriodRevenueExpense's note above for why re-closing is safe).
// Routed through the same second-admin-must-approve mechanism as large
// refunds (approvalService.js) rather than a bespoke one.
export async function requestPeriodReopen(periodId, requestedById) {
  const period = await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: periodId } })
  if (period.status !== 'CLOSED') {
    throw Object.assign(new Error(`Period ${period.label} is not closed`), { status: 400 })
  }
  return createApprovalRequest({
    entityType: 'REOPEN_PERIOD',
    requestedById,
    payload: { periodId, periodLabel: period.label },
  })
}

export async function reopenPeriod(periodId) {
  return prisma.fiscalPeriod.update({ where: { id: periodId }, data: { status: 'OPEN' } })
}
