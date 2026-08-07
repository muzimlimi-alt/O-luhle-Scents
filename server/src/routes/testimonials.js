import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { matchesFileSignature } from '../lib/fileSignature.js'
import { testimonialLimiter } from '../middleware/rateLimit.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../images/testimonials')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`)
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(new Error('Only JPG, PNG, or WEBP images are allowed'))
    cb(null, true)
  }
})

// Runs after multer has saved the file — mirrors lib/eftUpload.js's validateUploadedProof.
// multer's fileFilter alone trusts the client-reported mimetype, which is spoofable.
async function validateUploadedPhoto(req, res, next) {
  if (!req.file) return next() // photo is optional
  if (!matchesFileSignature(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {})
    return res.status(400).json({ error: 'File content does not match its declared type' })
  }
  next()
}

const router = Router()

/* ── Public ──────────────────────────────────────────────────────────── */

// GET /api/testimonials — approved only, for the storefront spotlight
router.get('/', async (req, res, next) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { status: 'approved' },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
    })
    res.json(testimonials)
  } catch (err) { next(err) }
})

// POST /api/testimonials — public submission, always starts pending
router.post('/', testimonialLimiter, upload.single('photo'), validateUploadedPhoto, async (req, res, next) => {
  try {
    const { name, designation, quote } = req.body
    if (!name || !quote) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return res.status(400).json({ error: 'Name and testimonial text are required' })
    }
    const testimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        designation: designation?.trim() || null,
        quote: quote.trim(),
        imagePath: req.file ? `images/testimonials/${req.file.filename}` : null,
        status: 'pending',
        submittedBy: 'visitor'
      }
    })
    res.json({ success: true, message: 'Thank you! Your testimonial has been submitted for review.', id: testimonial.id })
  } catch (err) { next(err) }
})

/* ── Admin ───────────────────────────────────────────────────────────── */

// GET /api/testimonials/admin?status=pending — every status, for the moderation queue
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query
    const testimonials = await prisma.testimonial.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
    })
    res.json(testimonials)
  } catch (err) { next(err) }
})

// POST /api/testimonials/admin — admin-authored, skips the review queue
router.post('/admin', requireAdmin, upload.single('photo'), validateUploadedPhoto, async (req, res, next) => {
  try {
    const { name, designation, quote, displayOrder } = req.body
    if (!name || !quote) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return res.status(400).json({ error: 'Name and testimonial text are required' })
    }
    const testimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        designation: designation?.trim() || null,
        quote: quote.trim(),
        imagePath: req.file ? `images/testimonials/${req.file.filename}` : null,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        status: 'approved',
        submittedBy: 'admin'
      }
    })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'CREATE_TESTIMONIAL', entity: 'Testimonial', entityId: testimonial.id, details: testimonial }
    })
    res.json({ success: true, id: testimonial.id })
  } catch (err) { next(err) }
})

// PUT /api/testimonials/admin/:id — edit AND moderate (a status-only body = approve/reject/retract)
router.put('/admin/:id', requireAdmin, upload.single('photo'), validateUploadedPhoto, async (req, res, next) => {
  try {
    const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Testimonial not found' })

    const { name, designation, quote, displayOrder, status, clearImage } = req.body
    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (designation !== undefined) data.designation = designation.trim() || null
    if (quote !== undefined) data.quote = quote.trim()
    if (displayOrder !== undefined) data.displayOrder = Number(displayOrder)
    if (status !== undefined) data.status = status
    if (clearImage === 'true' || clearImage === true) data.imagePath = null
    else if (req.file) data.imagePath = `images/testimonials/${req.file.filename}`

    const updated = await prisma.testimonial.update({ where: { id: req.params.id }, data })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'UPDATE_TESTIMONIAL', entity: 'Testimonial', entityId: updated.id, details: { before: existing, after: updated } }
    })
    res.json({ success: true, testimonial: updated })
  } catch (err) { next(err) }
})

// DELETE /api/testimonials/admin/:id
router.delete('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Testimonial not found' })
    await prisma.testimonial.delete({ where: { id: req.params.id } })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'DELETE_TESTIMONIAL', entity: 'Testimonial', entityId: req.params.id, details: existing }
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
