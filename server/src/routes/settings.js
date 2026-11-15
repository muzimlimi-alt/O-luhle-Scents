import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import sanitizeHtml from 'sanitize-html'
import prisma from '../lib/prisma.js'
import { requireRole } from '../middleware/auth.js'
import configStore from '../lib/configStore.js'
import { storedUploadName } from '../lib/uploadNames.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../images/site')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, storedUploadName(file.originalname))
})

// Hero background media can be a still image or a short video — both land
// in the same field/endpoint, distinguished later by file extension.
const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|mp4|webm|mov|quicktime/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) return cb(null, true)
    cb(new Error('Only images (jpg, png, webp) or videos (mp4, webm, mov) are allowed'))
  }
})

const router = Router()

// story_body is injected into the public homepage via innerHTML — strip
// everything except a minimal formatting subset to close the stored-XSS surface.
const SANITIZED_KEYS = new Set(['story_body'])
const SANITIZE_OPTS = {
  allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href'] },
}

// GET /api/admin/settings/public — unauthenticated, content group only.
// Declared before requireRole('admin') so it is never accidentally protected.
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

// POST /api/admin/settings/upload-image — admin: upload a site-content image
// or video (e.g. the hero background). Returns a public URL; the caller
// still has to save it against a settings key via POST / like any other
// content field.
router.post('/upload-image', requireRole('admin'), upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' })
    res.json({ url: `/images/site/${req.file.filename}` })
  } catch (err) { next(err) }
})

// GET /api/admin/settings — admin: list all grouped
router.get('/', requireRole('admin'), async (req, res, next) => {
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
router.post('/', requireRole('admin'), async (req, res, next) => {
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
            adminUserId: req.adminId || null,
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
