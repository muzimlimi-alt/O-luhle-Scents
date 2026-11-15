// Homepage Campaigns — scheduled hero overrides.
//
// Public:  GET /active         → current live campaign (highest priority)
// Admin:   GET /preview/:id    → single campaign for storefront preview
//          GET /               → list all campaigns with computed status
//          POST /              → create
//          PATCH /:id          → update
//          DELETE /:id         → delete
//          POST /:id/image     → upload desktop or mobile hero image
//          DELETE /:id/image   → remove a hero image

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requirePerm, getAdminFromRequest } from '../middleware/auth.js'
import { storedUploadName } from '../lib/uploadNames.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const campaignImageDir = path.join(__dirname, '../../../images/campaigns')
if (!fs.existsSync(campaignImageDir)) fs.mkdirSync(campaignImageDir, { recursive: true })

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, campaignImageDir),
  filename: (_req, file, cb) => cb(null, storedUploadName(file.originalname)),
})
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

const router = Router()

// ── helpers ────────────────────────────────────────────────────────────────

function campaignStatus(c) {
  if (!c.isActive) return 'draft'
  const now = new Date()
  if (c.startsAt > now) return 'scheduled'
  if (c.endsAt && c.endsAt <= now) return 'ended'
  return 'live'
}

function enrichCampaign(c) {
  return { ...c, status: campaignStatus(c) }
}

function activeWhere() {
  const now = new Date()
  return {
    isActive: true,
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  }
}

async function audit(action, adminId, targetId, before, after) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resource: 'campaign',
        resourceId: targetId,
        adminUserId: adminId,
        before: before ? JSON.parse(JSON.stringify(before)) : undefined,
        after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      },
    })
  } catch (err) {
    console.error('[campaigns] audit log failed:', err.message)
  }
}

// ── public ─────────────────────────────────────────────────────────────────

// GET /api/campaigns/active — highest-priority live campaign
router.get('/active', async (_req, res, next) => {
  try {
    const campaign = await prisma.homepageCampaign.findFirst({
      where: activeWhere(),
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
    })
    res.json(campaign ? enrichCampaign(campaign) : null)
  } catch (err) { next(err) }
})

// ── admin: preview ─────────────────────────────────────────────────────────

router.get('/preview/:id', requirePerm('campaigns', 'read'), async (req, res, next) => {
  try {
    const campaign = await prisma.homepageCampaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    res.json(enrichCampaign(campaign))
  } catch (err) { next(err) }
})

// ── admin: list ────────────────────────────────────────────────────────────

router.get('/', requirePerm('campaigns', 'read'), async (_req, res, next) => {
  try {
    const campaigns = await prisma.homepageCampaign.findMany({
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
    })
    res.json(campaigns.map(enrichCampaign))
  } catch (err) { next(err) }
})

// ── admin: create ──────────────────────────────────────────────────────────

router.post('/', requirePerm('campaigns', 'write'), async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req)
    const { name, eyebrow, heading, subheading, ctaLabel, ctaHref, startsAt, endsAt, isActive, priority } = req.body
    if (!name || !heading || !startsAt) {
      return res.status(400).json({ error: 'name, heading and startsAt are required' })
    }
    const campaign = await prisma.homepageCampaign.create({
      data: {
        name,
        eyebrow: eyebrow || null,
        heading,
        subheading: subheading || null,
        ctaLabel: ctaLabel || null,
        ctaHref: ctaHref || null,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: isActive ?? false,
        priority: parseInt(priority) || 0,
      },
    })
    await audit('CAMPAIGN_CREATED', admin?.id, campaign.id, null, campaign)
    res.status(201).json(enrichCampaign(campaign))
  } catch (err) { next(err) }
})

// ── admin: update ──────────────────────────────────────────────────────────

router.patch('/:id', requirePerm('campaigns', 'write'), async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req)
    const existing = await prisma.homepageCampaign.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Campaign not found' })

    const data = {}
    const fields = ['name', 'eyebrow', 'heading', 'subheading', 'ctaLabel', 'ctaHref', 'isActive', 'priority']
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f]
    }
    if (req.body.startsAt !== undefined) data.startsAt = new Date(req.body.startsAt)
    if (req.body.endsAt !== undefined) data.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null
    // Normalise nullable strings
    for (const f of ['eyebrow', 'subheading', 'ctaLabel', 'ctaHref']) {
      if (data[f] === '') data[f] = null
    }
    if (data.priority !== undefined) data.priority = parseInt(data.priority) || 0

    const updated = await prisma.homepageCampaign.update({ where: { id: req.params.id }, data })
    await audit('CAMPAIGN_UPDATED', admin?.id, updated.id, existing, updated)
    res.json(enrichCampaign(updated))
  } catch (err) { next(err) }
})

// ── admin: delete ──────────────────────────────────────────────────────────

router.delete('/:id', requirePerm('campaigns', 'delete'), async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req)
    const existing = await prisma.homepageCampaign.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Campaign not found' })

    // Remove image files from disk
    for (const field of ['desktopImage', 'mobileImage']) {
      if (existing[field]) {
        const filePath = path.join(campaignImageDir, path.basename(existing[field]))
        fs.unlink(filePath, () => {})
      }
    }

    await prisma.homepageCampaign.delete({ where: { id: req.params.id } })
    await audit('CAMPAIGN_DELETED', admin?.id, req.params.id, existing, null)
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── admin: image upload ────────────────────────────────────────────────────

// POST /:id/image?slot=desktop|mobile
router.post('/:id/image', requirePerm('campaigns', 'write'), imageUpload.single('image'), async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req)
    const slot = req.query.slot === 'mobile' ? 'mobileImage' : 'desktopImage'
    const existing = await prisma.homepageCampaign.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return res.status(404).json({ error: 'Campaign not found' })
    }
    if (!req.file) return res.status(400).json({ error: 'No image file provided' })

    // Remove previous image
    if (existing[slot]) {
      const oldPath = path.join(campaignImageDir, path.basename(existing[slot]))
      fs.unlink(oldPath, () => {})
    }

    const imageUrl = `/images/campaigns/${req.file.filename}`
    const updated = await prisma.homepageCampaign.update({
      where: { id: req.params.id },
      data: { [slot]: imageUrl },
    })
    await audit('CAMPAIGN_IMAGE_UPLOADED', admin?.id, updated.id, { [slot]: existing[slot] }, { [slot]: imageUrl })
    res.json(enrichCampaign(updated))
  } catch (err) { next(err) }
})

// DELETE /:id/image?slot=desktop|mobile
router.delete('/:id/image', requirePerm('campaigns', 'write'), async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req)
    const slot = req.query.slot === 'mobile' ? 'mobileImage' : 'desktopImage'
    const existing = await prisma.homepageCampaign.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Campaign not found' })

    if (existing[slot]) {
      const filePath = path.join(campaignImageDir, path.basename(existing[slot]))
      fs.unlink(filePath, () => {})
    }

    const updated = await prisma.homepageCampaign.update({
      where: { id: req.params.id },
      data: { [slot]: null },
    })
    await audit('CAMPAIGN_IMAGE_REMOVED', admin?.id, updated.id, { [slot]: existing[slot] }, { [slot]: null })
    res.json(enrichCampaign(updated))
  } catch (err) { next(err) }
})

export default router
