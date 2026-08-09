import { Router } from 'express'
import { requireAdmin, requireRole } from '../middleware/auth.js'
import prisma from '../lib/prisma.js'
import { resolveDataSubjectRequest } from '../lib/dataSubjectService.js'
import { CONSENT_PURPOSES } from '../lib/consentService.js'

// Mounted at /api/admin/privacy — the "Privacy & POPIA Management" section's
// backend. requireAdmin already covers all four roles and makes auditor
// read-only (see middleware/auth.js); the extra requireRole('admin') calls
// below are for actions with real consequences beyond viewing.
const router = Router()

// ─── Dashboard summary ────────────────────────────────────────────────────
router.get('/summary', requireAdmin, async (req, res, next) => {
  try {
    const [openRequests, byStatus, byType, recentConsentRevocations, retentionPolicies] = await Promise.all([
      prisma.dataSubjectRequest.count({ where: { status: { in: ['submitted', 'in_review'] } } }),
      prisma.dataSubjectRequest.groupBy({ by: ['status'], _count: true }),
      prisma.dataSubjectRequest.groupBy({ by: ['type'], _count: true, where: { status: { in: ['submitted', 'in_review'] } } }),
      prisma.consentRecord.count({ where: { granted: false, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.dataRetentionPolicy.findMany({ orderBy: { category: 'asc' } }),
    ])
    res.json({
      openRequests,
      requestsByStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
      openRequestsByType: byType.map((r) => ({ type: r.type, count: r._count })),
      recentConsentRevocations,
      retentionPolicies,
    })
  } catch (err) { next(err) }
})

// ─── Data subject request queue ───────────────────────────────────────────
router.get('/requests', requireAdmin, async (req, res, next) => {
  try {
    const { status = '', type = '' } = req.query
    const requests = await prisma.dataSubjectRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      include: { customer: { select: { id: true, name: true, email: true } }, resolvedByAdmin: { select: { name: true } } },
      orderBy: { requestedAt: 'desc' },
    })
    res.json(requests)
  } catch (err) { next(err) }
})

router.patch('/requests/:id', requireRole('admin', 'shop_manager'), async (req, res, next) => {
  try {
    const { status, resolutionNotes } = req.body
    const valid = ['submitted', 'in_review', 'approved', 'rejected', 'completed']
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` })
    }

    const target = await prisma.dataSubjectRequest.findUniqueOrThrow({ where: { id: req.params.id } })
    // Anonymising a customer's account is the one action here with no way
    // back — reserved for the admin role, even though shop_manager can
    // triage/review the rest of the queue.
    if (target.type === 'deletion' && status === 'approved' && req.user.role?.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Only an Administrator can approve an account deletion request' })
    }

    const updated = await resolveDataSubjectRequest(req.params.id, { status, resolutionNotes, adminId: req.adminId })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'RESOLVE_DSR', entity: 'DataSubjectRequest', entityId: req.params.id, details: { status, type: target.type } },
    })

    res.json(updated)
  } catch (err) { next(err) }
})

// ─── Consent statistics ───────────────────────────────────────────────────
router.get('/consent-stats', requireAdmin, async (req, res, next) => {
  try {
    const stats = {}
    for (const purpose of CONSENT_PURPOSES) {
      const rows = await prisma.consentRecord.findMany({
        where: { purpose },
        distinct: ['customerId', 'subjectEmail'],
        orderBy: { createdAt: 'desc' },
      })
      // distinct on two nullable columns can still return a null/null "no
      // subject" row if bad data ever slips in — filter defensively.
      const meaningful = rows.filter((r) => r.customerId || r.subjectEmail)
      stats[purpose] = {
        totalSubjects: meaningful.length,
        currentlyGranted: meaningful.filter((r) => r.granted).length,
      }
    }
    res.json(stats)
  } catch (err) { next(err) }
})

// ─── Retention policy configuration ───────────────────────────────────────
router.get('/retention-policies', requireAdmin, async (req, res, next) => {
  try {
    res.json(await prisma.dataRetentionPolicy.findMany({ orderBy: { category: 'asc' } }))
  } catch (err) { next(err) }
})

router.patch('/retention-policies/:category', requireRole('admin'), async (req, res, next) => {
  try {
    const { retentionDays, autoDelete } = req.body
    if (typeof retentionDays !== 'number' || retentionDays < 1) {
      return res.status(400).json({ error: 'retentionDays must be a positive number' })
    }
    const policy = await prisma.dataRetentionPolicy.update({
      where: { category: req.params.category },
      data: { retentionDays, autoDelete: Boolean(autoDelete), updatedByAdminId: req.adminId },
    })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'UPDATE_RETENTION_POLICY', entity: 'DataRetentionPolicy', entityId: policy.id, details: { category: policy.category, retentionDays, autoDelete } },
    })
    res.json(policy)
  } catch (err) { next(err) }
})

export default router
