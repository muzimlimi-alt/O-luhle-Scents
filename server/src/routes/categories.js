import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requirePerm, getAdminFromRequest } from '../middleware/auth.js'
import { generateUniqueCategorySlug } from '../lib/slug.js'
import { storedUploadName } from '../lib/uploadNames.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const categoryImageDir = path.join(__dirname, '../../../images/categories')
if (!fs.existsSync(categoryImageDir)) fs.mkdirSync(categoryImageDir, { recursive: true })

// Category banner images, shown behind the shop page title for that category.
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, categoryImageDir),
    filename: (req, file, cb) => cb(null, storedUploadName(file.originalname)),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype) && /\.(jpe?g|png|webp)$/i.test(file.originalname)
    cb(ok ? null : Object.assign(new Error('Only JPG, PNG or WebP images are allowed'), { status: 400 }), ok)
  },
})

const router = Router()

// ─── GET /api/categories ──────────────────────────────────────────────────────
// Storefront sees only active categories; signed-in admins see all.
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = !!(await getAdminFromRequest(req))
    const categories = await prisma.category.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, slug: true, description: true, image: true,
        parentId: true, displayOrder: true, isActive: true,
        _count: isAdmin ? { select: { products: true } } : undefined
      },
    })
    res.json(categories)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/categories (admin) ─────────────────────────────────────────────
router.post('/', requirePerm('categories', 'write'), async (req, res, next) => {
  try {
    const { name, description, image, parentId, displayOrder } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' })

    const slug = await generateUniqueCategorySlug(name)
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        description: description || null,
        image: image || null,
        parentId: parentId || null,
        displayOrder: parseInt(displayOrder) || 0
      }
    })
    res.status(201).json(category)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'A category with that name already exists' })
    next(err)
  }
})

// ─── PATCH /api/categories/:id (admin) ────────────────────────────────────────
router.patch('/:id', requirePerm('categories', 'write'), async (req, res, next) => {
  try {
    const { name, description, image, parentId, displayOrder, isActive } = req.body

    if (parentId === req.params.id) {
      return res.status(400).json({ error: 'A category cannot be its own parent' })
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? (description || null) : undefined,
        image: image !== undefined ? (image || null) : undefined,
        parentId: parentId !== undefined ? (parentId || null) : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined
      }
    })
    res.json(category)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'A category with that name already exists' })
    next(err)
  }
})

// ─── POST /api/categories/:id/image (admin) — upload the banner image ─────────
router.post('/:id/image', requirePerm('categories', 'write'), imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image file is required' })
    const category = await prisma.category.update({ where: { id: req.params.id }, data: { image: req.file.filename } })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'CATEGORY_IMAGE_UPLOAD', entity: 'Category', entityId: category.id, details: { filename: req.file.filename, size: req.file.size } },
    })
    res.json(category)
  } catch (err) { next(err) }
})

// ─── DELETE /api/categories/:id/image (admin) ─────────────────────────────────
router.delete('/:id/image', requirePerm('categories', 'write'), async (req, res, next) => {
  try {
    const category = await prisma.category.update({ where: { id: req.params.id }, data: { image: null } })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'CATEGORY_IMAGE_REMOVE', entity: 'Category', entityId: category.id },
    })
    res.json(category)
  } catch (err) { next(err) }
})

// ─── DELETE /api/categories/:id (admin) — soft: archive, don't orphan products ─
router.delete('/:id', requirePerm('categories', 'delete'), async (req, res, next) => {
  try {
    const [productCount, childCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: req.params.id } }),
      prisma.category.count({ where: { parentId: req.params.id } })
    ])
    if (productCount > 0 || childCount > 0) {
      return res.status(400).json({
        error: `Cannot remove — ${productCount} product(s) and ${childCount} subcategor(y/ies) still reference it. Reassign them first.`
      })
    }
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
