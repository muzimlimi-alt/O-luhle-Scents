import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requirePerm } from '../middleware/auth.js'
import { generateUniqueCategorySlug } from '../lib/slug.js'

const router = Router()

// ─── GET /api/categories ──────────────────────────────────────────────────────
// Storefront sees only active categories; admin (Bearer token present) sees all.
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = !!req.headers.authorization
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
