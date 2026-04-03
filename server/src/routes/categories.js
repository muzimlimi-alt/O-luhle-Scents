import { Router } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

// ─── GET /api/categories ──────────────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, slug: true },
    })
    res.json(categories)
  } catch (err) {
    next(err)
  }
})

export default router
