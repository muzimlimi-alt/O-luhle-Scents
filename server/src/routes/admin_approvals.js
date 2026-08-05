import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { listPendingApprovals, approveRequest, rejectRequest } from '../lib/approvalService.js'

// Finance Phase 11 — Approval Workflows (large refunds only for now; see
// approvalService.js and admin_ops.js POST /orders/:id/refunds).
const router = Router()

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    res.json(await listPendingApprovals())
  } catch (err) { next(err) }
})

router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const result = await approveRequest(req.params.id, req.adminId)
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body
    const result = await rejectRequest(req.params.id, req.adminId, reason)
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
