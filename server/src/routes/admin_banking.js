import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import {
  createBankTransaction,
  matchTransaction,
  unmatchTransaction,
  createAdjustmentAndMatch,
  getReconciliation
} from '../lib/bankingService.js'

// Finance Phase 6 — bank accounts (the GL-side entity, distinct from the
// customer-facing bank_* GlobalSetting keys used for EFT instructions) and
// reconciliation against manually entered statement lines.
const router = Router()

router.get('/accounts', requireAdmin, async (req, res, next) => {
  try {
    const accounts = await prisma.bankAccount.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] })
    res.json(accounts)
  } catch (err) { next(err) }
})

router.post('/accounts', requireAdmin, async (req, res, next) => {
  try {
    const { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift, chartAccountCode, isDefault } = req.body
    if (!name || !chartAccountCode) {
      return res.status(400).json({ error: 'name and chartAccountCode are required' })
    }
    const account = await prisma.chartOfAccount.findUnique({ where: { code: chartAccountCode } })
    if (!account) return res.status(400).json({ error: `Unknown chart of account code: ${chartAccountCode}` })

    const created = await prisma.bankAccount.create({
      data: { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift, chartAccountCode, isDefault: !!isDefault }
    })
    res.status(201).json(created)
  } catch (err) { next(err) }
})

router.patch('/accounts/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift, isDefault, isActive } = req.body
    const updated = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift, isDefault, isActive }
    })
    res.json(updated)
  } catch (err) { next(err) }
})

router.post('/accounts/:id/transactions', requireAdmin, async (req, res, next) => {
  try {
    const { date, description, amount, reference } = req.body
    const amt = parseFloat(amount)
    if (!date || !description || !Number.isFinite(amt) || amt === 0) {
      return res.status(400).json({ error: 'date, description, and a non-zero amount are required' })
    }
    const transaction = await createBankTransaction(req.params.id, { date, description, amount: amt, reference })
    res.status(201).json(transaction)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.get('/accounts/:id/reconciliation', requireAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query
    const result = await getReconciliation(req.params.id, { from, to })
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/transactions/:id/match', requireAdmin, async (req, res, next) => {
  try {
    const { journalLineId } = req.body
    if (!journalLineId) return res.status(400).json({ error: 'journalLineId is required' })
    const result = await matchTransaction(req.params.id, journalLineId)
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/transactions/:id/unmatch', requireAdmin, async (req, res, next) => {
  try {
    const result = await unmatchTransaction(req.params.id)
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/transactions/:id/adjust', requireAdmin, async (req, res, next) => {
  try {
    const { offsetAccountCode, description } = req.body
    if (!offsetAccountCode) return res.status(400).json({ error: 'offsetAccountCode is required' })
    const result = await createAdjustmentAndMatch(req.params.id, { offsetAccountCode, description, adminUserId: req.adminId })
    res.status(201).json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
