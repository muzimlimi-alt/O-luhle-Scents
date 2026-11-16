import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requirePerm } from '../middleware/auth.js'

const router = Router()

router.get('/', requirePerm('policies', 'read'), async (_req, res, next) => {
  try {
    const policies = await prisma.legalPolicy.findMany({
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { versions: true } },
      },
    })
    res.json(policies)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requirePerm('policies', 'read'), async (req, res, next) => {
  try {
    const policy = await prisma.legalPolicy.findUnique({
      where: { id: req.params.id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 20,
        },
      },
    })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    res.json(policy)
  } catch (err) {
    next(err)
  }
})

router.post('/', requirePerm('policies', 'write'), async (req, res, next) => {
  try {
    const { title, slug, content, summary, effectiveDate, metaTitle, metaDescription } = req.body
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'title, slug and content are required' })
    }
    const existing = await prisma.legalPolicy.findUnique({ where: { slug } })
    if (existing) return res.status(409).json({ error: 'A policy with this slug already exists' })

    const policy = await prisma.legalPolicy.create({
      data: {
        title,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        content,
        summary: summary || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        createdById: req.adminId,
        updatedById: req.adminId,
      },
    })

    await prisma.legalPolicyVersion.create({
      data: {
        policyId: policy.id,
        version: 1,
        title: policy.title,
        content: policy.content,
        status: policy.status,
        changeNotes: 'Initial draft',
        createdById: req.adminId,
      },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'CREATE',
        entity: 'LegalPolicy',
        entityId: policy.id,
        details: { title, slug: policy.slug },
      },
    })

    res.status(201).json(policy)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requirePerm('policies', 'write'), async (req, res, next) => {
  try {
    const existing = await prisma.legalPolicy.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Policy not found' })

    const { title, content, summary, effectiveDate, metaTitle, metaDescription, changeNotes } = req.body
    const newVersion = existing.version + 1

    const policy = await prisma.legalPolicy.update({
      where: { id: req.params.id },
      data: {
        title: title || existing.title,
        content: content || existing.content,
        summary: summary !== undefined ? summary : existing.summary,
        effectiveDate: effectiveDate !== undefined ? (effectiveDate ? new Date(effectiveDate) : null) : existing.effectiveDate,
        metaTitle: metaTitle !== undefined ? metaTitle : existing.metaTitle,
        metaDescription: metaDescription !== undefined ? metaDescription : existing.metaDescription,
        version: newVersion,
        updatedById: req.adminId,
      },
    })

    await prisma.legalPolicyVersion.create({
      data: {
        policyId: policy.id,
        version: newVersion,
        title: policy.title,
        content: policy.content,
        status: policy.status,
        changeNotes: changeNotes || null,
        createdById: req.adminId,
      },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'UPDATE',
        entity: 'LegalPolicy',
        entityId: policy.id,
        details: { version: newVersion, changeNotes },
      },
    })

    res.json(policy)
  } catch (err) {
    next(err)
  }
})

router.put('/:id/status', requirePerm('policies', 'write'), async (req, res, next) => {
  try {
    const { status } = req.body
    const valid = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` })
    }

    const existing = await prisma.legalPolicy.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Policy not found' })

    const data = { status, updatedById: req.adminId }
    if (status === 'PUBLISHED' && !existing.publishedAt) {
      data.publishedAt = new Date()
    }

    const policy = await prisma.legalPolicy.update({
      where: { id: req.params.id },
      data,
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'STATUS_CHANGE',
        entity: 'LegalPolicy',
        entityId: policy.id,
        details: { from: existing.status, to: status },
      },
    })

    res.json(policy)
  } catch (err) {
    next(err)
  }
})

router.get('/:id/versions', requirePerm('policies', 'read'), async (req, res, next) => {
  try {
    const versions = await prisma.legalPolicyVersion.findMany({
      where: { policyId: req.params.id },
      orderBy: { version: 'desc' },
    })
    res.json(versions)
  } catch (err) {
    next(err)
  }
})

router.get('/:id/versions/:versionId', requirePerm('policies', 'read'), async (req, res, next) => {
  try {
    const version = await prisma.legalPolicyVersion.findUnique({
      where: { id: req.params.versionId },
    })
    if (!version || version.policyId !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' })
    }
    res.json(version)
  } catch (err) {
    next(err)
  }
})

router.post('/:id/restore/:versionId', requirePerm('policies', 'write'), async (req, res, next) => {
  try {
    const version = await prisma.legalPolicyVersion.findUnique({
      where: { id: req.params.versionId },
    })
    if (!version || version.policyId !== req.params.id) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const existing = await prisma.legalPolicy.findUnique({ where: { id: req.params.id } })
    const newVersion = existing.version + 1

    const policy = await prisma.legalPolicy.update({
      where: { id: req.params.id },
      data: {
        title: version.title,
        content: version.content,
        version: newVersion,
        updatedById: req.adminId,
      },
    })

    await prisma.legalPolicyVersion.create({
      data: {
        policyId: policy.id,
        version: newVersion,
        title: version.title,
        content: version.content,
        status: policy.status,
        changeNotes: `Restored from version ${version.version}`,
        createdById: req.adminId,
      },
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'RESTORE',
        entity: 'LegalPolicy',
        entityId: policy.id,
        details: { restoredFromVersion: version.version, newVersion },
      },
    })

    res.json(policy)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requirePerm('policies', 'delete'), async (req, res, next) => {
  try {
    const existing = await prisma.legalPolicy.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Policy not found' })

    await prisma.legalPolicy.delete({ where: { id: req.params.id } })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'DELETE',
        entity: 'LegalPolicy',
        entityId: req.params.id,
        details: { title: existing.title, slug: existing.slug },
      },
    })

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
