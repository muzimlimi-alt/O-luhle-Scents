import { Router } from 'express'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { verifyPayment, rejectPayment } from '../lib/eftPaymentService.js'

// Kept separate from the already-large admin_ops.js — Manual EFT
// verification actions live here alongside the payment list they operate on.
const router = Router()

// GET /api/admin/payments — list, with an optional Manual EFT verification
// filter (?eftStatus=PENDING_PROOF,PROOF_UPLOADED). The existing
// GET /admin/ops/payments (admin_ops.js) stays as-is for the general list;
// this augmented version adds the filter the verification queue needs.
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { eftStatus } = req.query
    const where = {}
    if (eftStatus) where.eftVerificationStatus = { in: eftStatus.split(',') }

    const payments = await prisma.payment.findMany({
      where,
      include: { order: { include: { customer: true } }, statusHistory: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(payments)
  } catch (err) { next(err) }
})

router.post('/:id/verify', requireAdmin, async (req, res, next) => {
  try {
    const payment = await verifyPayment(req.params.id, { adminUserId: req.adminId })
    res.json(payment)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ error: 'A rejection reason is required' })
    const payment = await rejectPayment(req.params.id, { reason: reason.trim(), adminUserId: req.adminId })
    res.json(payment)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// GET /api/admin/payments/:id/proof — auth-gated file stream. Proof images
// can show visible bank account details, so this is never served from a
// public static path (unlike site/product images).
router.get('/:id/proof', requireAdmin, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } })
    if (!payment?.proofOfPaymentUrl) return res.status(404).json({ error: 'No proof of payment on file' })
    if (!fs.existsSync(payment.proofOfPaymentUrl)) return res.status(404).json({ error: 'Proof file is missing on disk' })

    res.setHeader('Content-Type', payment.proofMimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${payment.proofFileName || 'proof'}"`)
    fs.createReadStream(payment.proofOfPaymentUrl).pipe(res)
  } catch (err) { next(err) }
})

export default router
