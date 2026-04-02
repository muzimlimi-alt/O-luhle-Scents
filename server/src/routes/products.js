import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query
    const where = { active: true }
    if (category && category !== 'all') where.category = category

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    res.json(products)
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: parseInt(req.params.id), active: true },
    })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/products/:id/stock  (admin only)
router.patch('/:id/stock', requireAdmin, async (req, res, next) => {
  try {
    const { stockQty } = req.body
    if (typeof stockQty !== 'number' || stockQty < 0) {
      return res.status(400).json({ error: 'stockQty must be a non-negative number' })
    }
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { stockQty },
    })
    res.json(product)
  } catch (err) {
    next(err)
  }
})

export default router
