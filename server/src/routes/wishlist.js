// Wishlist — "My Favourites"
//
// Customer:  GET  /api/wishlist                    → get default list (creates if absent)
//            POST /api/wishlist/items              → add { productId, variantId? }
//            DELETE /api/wishlist/items/:productId → remove item
//            GET  /api/wishlist/check/:productId   → { saved: bool }
//
// Admin:     GET  /api/wishlists/admin/all                    → paginated list
//            GET  /api/wishlists/admin/customer/:customerId   → one customer's wishlists

import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requirePerm } from '../middleware/auth.js'
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

function requireCustomer(req, res, next) {
  const customer = getCustomerFromRequest(req)
  if (!customer) return res.status(401).json({ error: 'Sign in to manage your favourites' })
  req.customer = customer
  next()
}

const PRODUCT_SELECT = {
  id: true, name: true, primaryImage: true, family: true,
  cardBadge: true, type: true,
  variants: { select: { id: true, price: true, size: true, uom: true, inventory: true } },
}

async function getOrCreateDefaultList(customerId) {
  let wishlist = await prisma.wishlist.findFirst({
    where: { customerId, name: 'My Favourites' },
    include: {
      items: {
        include: { product: { select: PRODUCT_SELECT } },
        orderBy: { addedAt: 'desc' },
      },
    },
  })
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { customerId, name: 'My Favourites' },
      include: {
        items: {
          include: { product: { select: PRODUCT_SELECT } },
        },
      },
    })
  }
  return wishlist
}

// ── GET /api/wishlist ─────────────────────────────────────────────────────────
router.get('/', requireCustomer, async (req, res) => {
  try {
    const wishlist = await getOrCreateDefaultList(req.customer.customerId)
    res.json(wishlist)
  } catch (err) {
    console.error('Error fetching wishlist:', err)
    res.status(500).json({ error: 'Failed to fetch wishlist' })
  }
})

// ── GET /api/wishlist/check/:productId ───────────────────────────────────────
router.get('/check/:productId', requireCustomer, async (req, res) => {
  try {
    const wishlist = await prisma.wishlist.findFirst({
      where: { customerId: req.customer.customerId, name: 'My Favourites' },
      select: { id: true },
    })
    if (!wishlist) return res.json({ saved: false })
    const item = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId: req.params.productId },
    })
    res.json({ saved: !!item })
  } catch (err) {
    console.error('Error checking wishlist:', err)
    res.status(500).json({ error: 'Failed to check wishlist' })
  }
})

// ── POST /api/wishlist/items ──────────────────────────────────────────────────
router.post('/items', requireCustomer, async (req, res) => {
  const { productId, variantId } = req.body
  if (!productId) return res.status(400).json({ error: 'productId required' })
  try {
    const wishlist = await getOrCreateDefaultList(req.customer.customerId)
    const item = await prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId_variantId: {
          wishlistId: wishlist.id,
          productId,
          variantId: variantId || null,
        },
      },
      update: {},
      create: { wishlistId: wishlist.id, productId, variantId: variantId || null },
    })
    try {
      await prisma.auditLog.create({
        data: {
          action: 'wishlist_add',
          entity: 'WishlistItem',
          entityId: item.id,
          details: { productId, customerId: req.customer.customerId },
        },
      })
    } catch { /* audit non-fatal */ }
    res.status(201).json({ id: item.id, wishlistId: wishlist.id, productId, variantId: variantId || null })
  } catch (err) {
    console.error('Error adding to wishlist:', err)
    res.status(500).json({ error: 'Failed to add to wishlist' })
  }
})

// ── DELETE /api/wishlist/items/:productId ────────────────────────────────────
router.delete('/items/:productId', requireCustomer, async (req, res) => {
  try {
    const wishlist = await prisma.wishlist.findFirst({
      where: { customerId: req.customer.customerId, name: 'My Favourites' },
      select: { id: true },
    })
    if (!wishlist) return res.status(404).json({ error: 'Wishlist not found' })
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId: req.params.productId },
    })
    if (deleted.count === 0) return res.status(404).json({ error: 'Item not in wishlist' })
    try {
      await prisma.auditLog.create({
        data: {
          action: 'wishlist_remove',
          entity: 'WishlistItem',
          entityId: req.params.productId,
          details: { productId: req.params.productId, customerId: req.customer.customerId },
        },
      })
    } catch { /* audit non-fatal */ }
    res.json({ removed: true })
  } catch (err) {
    console.error('Error removing from wishlist:', err)
    res.status(500).json({ error: 'Failed to remove from wishlist' })
  }
})

// ── Admin: GET /api/wishlist/admin/all ───────────────────────────────────────
router.get('/admin/all', requirePerm('wishlists', 'read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, parseInt(req.query.limit) || 25)
    const skip = (page - 1) * limit
    const [wishlists, total] = await Promise.all([
      prisma.wishlist.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.wishlist.count(),
    ])
    res.json({ wishlists, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Error listing wishlists:', err)
    res.status(500).json({ error: 'Failed to fetch wishlists' })
  }
})

// ── Admin: GET /api/wishlist/admin/customer/:customerId ──────────────────────
router.get('/admin/customer/:customerId', requirePerm('wishlists', 'read'), async (req, res) => {
  try {
    const wishlists = await prisma.wishlist.findMany({
      where: { customerId: req.params.customerId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, primaryImage: true } } },
          orderBy: { addedAt: 'desc' },
        },
        _count: { select: { items: true } },
      },
    })
    res.json(wishlists)
  } catch (err) {
    console.error('Error fetching customer wishlists:', err)
    res.status(500).json({ error: 'Failed to fetch wishlists' })
  }
})

export default router
