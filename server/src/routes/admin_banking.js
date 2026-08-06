import { Router } from 'express'
import multer from 'multer'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import {
  createBankTransaction,
  matchTransaction,
  unmatchTransaction,
  createAdjustmentAndMatch,
  getReconciliation,
  setDefaultBankAccount,
  setBankAccountActive,
  importBankTransactions
} from '../lib/bankingService.js'
import { parseCsv, mapRows } from '../lib/bankStatementImport.js'

// Finance Phase 6 — bank accounts (the GL-side entity, distinct from the
// customer-facing bank_* GlobalSetting keys used for EFT instructions) and
// reconciliation against manually entered statement lines.
const router = Router()

// Memory storage — the raw upload is only needed transiently to parse into
// BankTransaction rows, unlike eftUpload.js's proof-of-payment which needs
// to persist for admin review later.
const statementUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

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

    // The very first account must be the default — otherwise EFT checkout
    // would have nothing to resolve. Later accounts only become default via
    // the dedicated set-default endpoint, which enforces exclusivity.
    const isFirstAccount = (await prisma.bankAccount.count()) === 0
    const created = await prisma.bankAccount.create({
      data: { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift, chartAccountCode, isDefault: isFirstAccount }
    })

    if (!isFirstAccount && isDefault) {
      return res.status(201).json(await setDefaultBankAccount(created.id))
    }
    res.status(201).json(created)
  } catch (err) { next(err) }
})

router.patch('/accounts/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift, isActive } = req.body
    if (isActive !== undefined) {
      await setBankAccountActive(req.params.id, isActive)
    }
    const updated = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift }
    })
    res.json(updated)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/accounts/:id/set-default', requireAdmin, async (req, res, next) => {
  try {
    res.json(await setDefaultBankAccount(req.params.id))
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
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

// CSV statement import — see server/src/lib/bankStatementImport.js. The
// admin maps columns client-side (real bank exports vary too much to guess
// a layout), so `mapping` arrives as a JSON string alongside the file in
// the same multipart body.
router.post('/accounts/:id/transactions/import', requireAdmin, statementUpload.single('statement'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A statement file is required' })

    let mapping
    try {
      mapping = JSON.parse(req.body.mapping || '{}')
    } catch {
      return res.status(400).json({ error: 'mapping must be valid JSON' })
    }
    if (mapping.dateColumn == null || mapping.descriptionColumn == null) {
      return res.status(400).json({ error: 'Date and Description columns are required' })
    }

    const { rows } = parseCsv(req.file.buffer)
    const { rows: mappedRows, invalid } = mapRows(rows, mapping)

    const { imported, skippedDuplicates } = await importBankTransactions(req.params.id, mappedRows)

    res.status(201).json({
      imported,
      skippedDuplicates,
      skippedInvalidRows: invalid.length,
      invalidRowSamples: invalid.slice(0, 5)
    })
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
