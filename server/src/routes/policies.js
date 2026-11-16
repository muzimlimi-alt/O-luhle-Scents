import { Router } from 'express'
import prisma from '../lib/prisma.js'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const policies = await prisma.legalPolicy.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        effectiveDate: true,
        updatedAt: true,
        metaTitle: true,
        metaDescription: true,
      },
      orderBy: { title: 'asc' },
    })
    res.json(policies)
  } catch (err) {
    next(err)
  }
})

router.get('/:slug', async (req, res, next) => {
  try {
    const policy = await prisma.legalPolicy.findFirst({
      where: { slug: req.params.slug, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        summary: true,
        version: true,
        effectiveDate: true,
        publishedAt: true,
        updatedAt: true,
        metaTitle: true,
        metaDescription: true,
      },
    })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    res.json(policy)
  } catch (err) {
    next(err)
  }
})

export default router
