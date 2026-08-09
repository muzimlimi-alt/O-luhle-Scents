import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { listPendingApprovals, approveRequest, rejectRequest } from '../lib/approvalService.js'
import prisma from '../lib/prisma.js'

// Finance Phase 11 — Approval Workflows (large refunds, and — as of the
// SARS Compliance period-close work — fiscal period reopen requests; see
// approvalService.js, admin_ops.js POST /orders/:id/refunds, and
// periodCloseService.js).
const router = Router()

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    res.json(await listPendingApprovals())
  } catch (err) { next(err) }
})

router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const result = await approveRequest(req.params.id, req.adminId)
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'APPROVE_REQUEST', entity: 'ApprovalRequest', entityId: req.params.id, details: { entityType: result.approvalRequest.entityType, requestedById: result.approvalRequest.requestedById } }
    })
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
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'REJECT_REQUEST', entity: 'ApprovalRequest', entityId: req.params.id, details: { entityType: result.entityType, requestedById: result.requestedById, reason: reason || null } }
    })
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
