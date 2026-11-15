// Product Reviews — verified-purchase reviews with admin moderation.
//
// Public:  GET /product/:productId   → approved reviews for a product
//          GET /product/:productId/summary → rating summary (avg, count)
// Customer: POST /                   → submit a review (must have delivered order)
// Admin:   GET /                     → list all reviews (filterable by status)
//          PATCH /:id/moderate       → approve / reject
//          DELETE /:id               → remove

import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requirePerm, getAdminFromRequest } from '../middleware/auth.js'
import jwt from 'jsonwebtoken'

const router = Router()

function getCustomerFromRequest(req) {
  try {
    const header = req.headers.authorization
    if (!header) return null
    const token = header.replace('Bearer ', '')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (decoded.type !== 'customer') return null
    return decoded
  } catch { return null }
}

async function audit(action, adminId, targetId, before, after) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resource: 'review',
        resourceId: targetId,
        adminUserId: adminId,
        before: before ? JSON.parse(JSON.stringify(before)) : undefined,
        after: after ? JSON.parse(JSON.stringify(after)) : undefined,
      },
    })
  } catch (err) {
    console.error('Review audit log failed:', err.message)
  }
}

// ── Public: reviews for a product ────────────────────────────────────────────
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await prisma.productReview.findMany({
      where: { productId: req.params.productId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    })
    res.json(reviews)
  } catch (err) {
    console.error('Error fetching reviews:', err)
    res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

// ── Public: rating summary for a product ─────────────────────────────────────
router.get('/product/:productId/summary', async (req, res) => {
  try {
    const agg = await prisma.productReview.aggregate({
      where: { productId: req.params.productId, status: 'approved' },
      _avg: { rating: true },
      _count: { rating: true },
    })
    const distribution = await prisma.productReview.groupBy({
      by: ['rating'],
      where: { productId: req.params.productId, status: 'approved' },
      _count: true,
    })
    const dist = {}
    for (let i = 1; i <= 5; i++) dist[i] = 0
    distribution.forEach(r => { dist[r.rating] = r._count })

    res.json({
      average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      count: agg._count.rating,
      distribution: dist,
    })
  } catch (err) {
    console.error('Error fetching review summary:', err)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

// ── Customer: submit a review ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const customer = getCustomerFromRequest(req)
  if (!customer) return res.status(401).json({ error: 'Sign in to leave a review' })

  const { productId, orderItemId, rating, title, body } = req.body
  if (!productId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Product and rating (1-5) required' })
  }

  try {
    if (orderItemId) {
      const item = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { order: true },
      })
      if (!item || item.order.customerId !== customer.id) {
        return res.status(403).json({ error: 'Order item does not belong to you' })
      }
      if (item.order.status !== 'delivered') {
        return res.status(400).json({ error: 'You can only review delivered orders' })
      }
      const existing = await prisma.productReview.findUnique({
        where: { orderItemId },
      })
      if (existing) {
        return res.status(409).json({ error: 'You already reviewed this item' })
      }
    }

    const review = await prisma.productReview.create({
      data: {
        productId,
        customerId: customer.id,
        orderItemId: orderItemId || null,
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        title: title ? String(title).slice(0, 200) : null,
        body: body ? String(body).slice(0, 2000) : null,
        status: 'pending',
      },
    })
    res.status(201).json(review)
  } catch (err) {
    console.error('Error creating review:', err)
    res.status(500).json({ error: 'Failed to submit review' })
  }
})

// ── Admin: list reviews ──────────────────────────────────────────────────────
router.get('/', requirePerm('reviews', 'read'), async (req, res) => {
  try {
    const { status, productId, page = 1, limit = 50 } = req.query
    const where = {}
    if (status) where.status = status
    if (productId) where.productId = productId

    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
          product: { select: { id: true, name: true, primaryImage: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.productReview.count({ where }),
    ])
    res.json({ reviews, total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    console.error('Error listing reviews:', err)
    res.status(500).json({ error: 'Failed to list reviews' })
  }
})

// ── Admin: moderate (approve/reject) ─────────────────────────────────────────
router.patch('/:id/moderate', requirePerm('reviews', 'write'), async (req, res) => {
  try {
    const admin = await getAdminFromRequest(req)
    const { status } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' })
    }

    const before = await prisma.productReview.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Review not found' })

    const review = await prisma.productReview.update({
      where: { id: req.params.id },
      data: {
        status,
        moderatedBy: admin?.id || null,
        moderatedAt: new Date(),
      },
    })
    await audit(`review_${status}`, admin?.id, review.id, before, review)
    res.json(review)
  } catch (err) {
    console.error('Error moderating review:', err)
    res.status(500).json({ error: 'Failed to moderate review' })
  }
})

// ── Admin: delete review ─────────────────────────────────────────────────────
router.delete('/:id', requirePerm('reviews', 'delete'), async (req, res) => {
  try {
    const admin = await getAdminFromRequest(req)
    const before = await prisma.productReview.findUnique({ where: { id: req.params.id } })
    if (!before) return res.status(404).json({ error: 'Review not found' })

    await prisma.productReview.delete({ where: { id: req.params.id } })
    await audit('review_deleted', admin?.id, req.params.id, before, null)
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting review:', err)
    res.status(500).json({ error: 'Failed to delete review' })
  }
})

export default router
