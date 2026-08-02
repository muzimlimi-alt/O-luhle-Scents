import { Router } from 'express'
import sanitizeHtml from 'sanitize-html'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import configStore from '../lib/configStore.js'

const router = Router()

// story_body is injected into the public homepage via innerHTML — strip
// everything except a minimal formatting subset to close the stored-XSS surface.
const SANITIZED_KEYS = new Set(['story_body'])
const SANITIZE_OPTS = {
  allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href'] },
}

// GET /api/admin/settings/public — unauthenticated, content group only.
// Declared before requireAdmin so it is never accidentally protected.
// Deliberately NOT extended to 'general': that group is also where
// newly-added Config.jsx fields (EMAIL_*, TWILIO_*) land by default the
// first time they're saved, since handleChange() has no group for a key it
// hasn't fetched yet. business_email/business_whatsapp/business_address were
// moved into 'content' (see seed_content.js) so this route can stay a strict
// single-group allowlist instead of trusting every future 'general' key.
router.get('/public', async (req, res, next) => {
  try {
    const rows = await prisma.globalSetting.findMany({
      where: { group: 'content' },
      select: { key: true, value: true },
    })
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
    res.set('Cache-Control', 'public, max-age=60')
    res.json(map)
  } catch (err) { next(err) }
})

// GET /api/admin/settings — admin: list all grouped
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const settings = await prisma.globalSetting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }]
    })
    
    // Group them for easier UI rendering
    const grouped = settings.reduce((acc, s) => {
      if (!acc[s.group]) acc[s.group] = []
      acc[s.group].push(s)
      return acc
    }, {})

    res.json(grouped)
  } catch (err) { next(err) }
})

// POST /api/admin/settings — admin: bulk upsert
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { settings } = req.body // Expects [{ key, value, group }]
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings must be an array' })
    }

    await prisma.$transaction(async (tx) => {
      for (const s of settings) {
        const value = SANITIZED_KEYS.has(s.key) ? sanitizeHtml(s.value, SANITIZE_OPTS) : s.value

        await tx.globalSetting.upsert({
          where: { key: s.key },
          update: { value, group: s.group || 'general' },
          create: { key: s.key, value, group: s.group || 'general' }
        })

        // Audit Log for every change
        await tx.auditLog.create({
          data: {
            action: 'UPDATE_SETTING',
            entity: 'GlobalSetting',
            entityId: null,
            details: { key: s.key, value: s.value }
          }
        })
      }
    })

    // Invalidate Cache
    configStore.clearCache()
    
    res.json({ message: 'Global configuration synchronized successfully' })
  } catch (err) { next(err) }
})

export default router
