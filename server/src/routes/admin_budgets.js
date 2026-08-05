import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

// Finance Phase 11 — Budgeting. One figure per account for the whole budget
// period (not monthly-granular).
const router = Router()

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const budgets = await prisma.budget.findMany({ include: { lines: true }, orderBy: { startDate: 'desc' } })
    res.json(budgets)
  } catch (err) { next(err) }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, startDate, endDate, lines } = req.body
    if (!name || !startDate || !endDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'name, startDate, endDate, and at least one line are required' })
    }
    for (const l of lines) {
      if (!l.accountCode || !Number.isFinite(parseFloat(l.budgetedAmount))) {
        return res.status(400).json({ error: 'Each line needs an accountCode and a numeric budgetedAmount' })
      }
    }

    const accounts = await prisma.chartOfAccount.findMany({ where: { code: { in: lines.map(l => l.accountCode) } } })
    const missing = lines.map(l => l.accountCode).filter(c => !accounts.some(a => a.code === c))
    if (missing.length) return res.status(400).json({ error: `Unknown chart of account code(s): ${missing.join(', ')}` })

    const budget = await prisma.budget.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        lines: { create: lines.map(l => ({ accountCode: l.accountCode, budgetedAmount: parseFloat(l.budgetedAmount) })) }
      },
      include: { lines: true }
    })
    res.status(201).json(budget)
  } catch (err) { next(err) }
})

// GET /:id/actual — budget vs. actual. "Actual" for each line is computed
// the same signed way admin_finance.js's trial balance does (debit-credit
// for a DEBIT-normal account, credit-debit for a CREDIT-normal one), so a
// budgeted expense and its actual spend compare as like-for-like positive
// numbers rather than raw debit/credit totals.
router.get('/:id/actual', requireAdmin, async (req, res, next) => {
  try {
    const budget = await prisma.budget.findUnique({ where: { id: req.params.id }, include: { lines: true } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })

    const accounts = await prisma.chartOfAccount.findMany({ where: { code: { in: budget.lines.map(l => l.accountCode) } } })
    const accountByCode = new Map(accounts.map(a => [a.code, a]))

    const sums = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accounts.map(a => a.id) },
        journal: { date: { gte: budget.startDate, lte: budget.endDate } }
      },
      _sum: { debit: true, credit: true }
    })
    const sumByAccountId = new Map(sums.map(s => [s.accountId, s._sum]))

    const rows = budget.lines.map(line => {
      const account = accountByCode.get(line.accountCode)
      const sum = account ? sumByAccountId.get(account.id) : null
      const debit = Number(sum?.debit || 0)
      const credit = Number(sum?.credit || 0)
      const actual = round2(account?.normalBalance === 'DEBIT' ? debit - credit : credit - debit)
      const budgeted = round2(line.budgetedAmount)
      const variance = round2(actual - budgeted)
      const variancePercent = budgeted !== 0 ? round2((variance / budgeted) * 100) : null

      return { accountCode: line.accountCode, accountName: account?.name || line.accountCode, budgeted, actual, variance, variancePercent }
    })

    res.json({ budget: { id: budget.id, name: budget.name, startDate: budget.startDate, endDate: budget.endDate }, rows })
  } catch (err) { next(err) }
})

export default router
