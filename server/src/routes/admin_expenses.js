import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { postExpenseJournal } from '../lib/accountingService.js'

// Finance Phase 8 — records a business expense (courier, marketing,
// packaging, etc.) and posts it to the GL in one step. Closes the gap where
// those chart-of-accounts rows have existed since Phase 1 but nothing ever
// posted to them.
const router = Router()

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } })
    res.json(expenses)
  } catch (err) { next(err) }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { accountCode, amount, description, date, paymentMethod } = req.body
    const amt = parseFloat(amount)
    if (!accountCode || !description || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'accountCode, description, and a positive amount are required' })
    }

    const account = await prisma.chartOfAccount.findUnique({ where: { code: accountCode } })
    if (!account) return res.status(400).json({ error: `Unknown chart of account code: ${accountCode}` })
    if (account.type !== 'EXPENSE') return res.status(400).json({ error: `${accountCode} is not an EXPENSE account` })

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          accountCode,
          amount: amt,
          description,
          date: date ? new Date(date) : new Date(),
          paymentMethod: paymentMethod || null,
          adminUserId: req.adminId
        }
      })
      await postExpenseJournal(tx, created)
      await tx.auditLog.create({
        data: { adminUserId: req.adminId, action: 'RECORD_EXPENSE', entity: 'Expense', entityId: created.id, details: { accountCode, amount: amt, description } }
      })
      return created
    })

    res.status(201).json(expense)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
