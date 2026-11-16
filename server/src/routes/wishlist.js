// Wishlist — My Favourites (Phase 2)
//
// Customer (auth):
//   GET    /api/wishlist                         → all lists for signed-in customer
//   GET    /api/wishlist/default                  → default list (creates if absent)
//   POST   /api/wishlist/lists                    → create named list { name, description? }
//   PATCH  /api/wishlist/lists/:id                → rename/update { name?, description? }
//   DELETE /api/wishlist/lists/:id                → delete list (not default)
//   POST   /api/wishlist/items                    → add { productId, variantId?, listId?, note? }
//   DELETE /api/wishlist/items/:productId         → remove from default (back-compat)
//   DELETE /api/wishlist/lists/:listId/items/:productId → remove from specific list
//   GET    /api/wishlist/check/:productId         → { saved: bool, lists: [...] }
//   POST   /api/wishlist/merge                    → merge guest wishlist into account
//
// Guest (token):
//   GET    /api/wishlist/guest                    → get guest list (token in header)
//   POST   /api/wishlist/guest/items              → add to guest list
//   DELETE /api/wishlist/guest/items/:productId   → remove from guest list
//
// Sharing (public):
//   POST   /api/wishlist/share/:listId            → create share link
//   DELETE /api/wishlist/share/:shareId            → revoke share link
//   GET    /api/wishlist/shared/:token             → view shared list (no auth)
//
// Admin:
//   GET    /api/wishlist/admin/all                → paginated list
//   GET    /api/wishlist/admin/customer/:cid      → one customer's wishlists
//   GET    /api/wishlist/admin/stats               → aggregate stats

import { Router } from 'express'
import crypto from 'crypto'
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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getGuestToken(req) {
  return req.headers['x-wishlist-token'] || null
}

const PRODUCT_SELECT = {
  id: true, name: true, primaryImage: true, family: true,
  cardBadge: true, type: true,
  variants: { select: { id: true, price: true, size: true, uom: true, currency: true, inventory: true } },
}

const LIST_INCLUDE = {
  items: {
    include: { product: { select: PRODUCT_SELECT } },
    orderBy: { addedAt: 'desc' },
  },
  _count: { select: { items: true } },
}

async function getOrCreateDefaultList(customerId) {
  let wishlist = await prisma.wishlist.findFirst({
    where: { customerId, isDefault: true },
    include: LIST_INCLUDE,
  })
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { customerId, name: 'My Favourites', isDefault: true },
      include: LIST_INCLUDE,
    })
  }
  return wishlist
}

async function getOrCreateGuestList(guestToken) {
  const hash = hashToken(guestToken)
  let wishlist = await prisma.wishlist.findFirst({
    where: { guestTokenHash: hash, customerId: null },
    include: LIST_INCLUDE,
  })
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { guestTokenHash: hash, name: 'My Favourites', isDefault: true },
      include: LIST_INCLUDE,
    })
  }
  return wishlist
}

function auditLog(action, entityId, details) {
  return prisma.auditLog.create({
    data: { action, entity: 'WishlistItem', entityId: entityId || 'system', details },
  }).catch(() => {})
}

// ════════════════════════════════════════════════════════════════════════════
// CUSTOMER ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/wishlist — all lists for signed-in customer
router.get('/', requireCustomer, async (req, res) => {
  try {
    const lists = await prisma.wishlist.findMany({
      where: { customerId: req.customer.customerId },
      include: LIST_INCLUDE,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    if (!lists.length) {
      const defaultList = await getOrCreateDefaultList(req.customer.customerId)
      return res.json([defaultList])
    }
    res.json(lists)
  } catch (err) {
    console.error('Error fetching wishlists:', err)
    res.status(500).json({ error: 'Failed to fetch wishlists' })
  }
})

// GET /api/wishlist/default — default list only
router.get('/default', requireCustomer, async (req, res) => {
  try {
    const wishlist = await getOrCreateDefaultList(req.customer.customerId)
    res.json(wishlist)
  } catch (err) {
    console.error('Error fetching default wishlist:', err)
    res.status(500).json({ error: 'Failed to fetch wishlist' })
  }
})

// POST /api/wishlist/lists — create named list
router.post('/lists', requireCustomer, async (req, res) => {
  const { name, description } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' })
  const trimmed = name.trim().slice(0, 100)
  try {
    const existing = await prisma.wishlist.findFirst({
      where: { customerId: req.customer.customerId, name: trimmed },
    })
    if (existing) return res.status(409).json({ error: 'A list with that name already exists' })
    const list = await prisma.wishlist.create({
      data: {
        customerId: req.customer.customerId,
        name: trimmed,
        description: description ? description.trim().slice(0, 500) : null,
        isDefault: false,
      },
      include: LIST_INCLUDE,
    })
    res.status(201).json(list)
  } catch (err) {
    console.error('Error creating wishlist:', err)
    res.status(500).json({ error: 'Failed to create list' })
  }
})

// PATCH /api/wishlist/lists/:id — rename/update
router.patch('/lists/:id', requireCustomer, async (req, res) => {
  const { name, description } = req.body
  try {
    const list = await prisma.wishlist.findFirst({
      where: { id: req.params.id, customerId: req.customer.customerId },
    })
    if (!list) return res.status(404).json({ error: 'List not found' })
    const data = {}
    if (name !== undefined) {
      const trimmed = name.trim().slice(0, 100)
      if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' })
      const dup = await prisma.wishlist.findFirst({
        where: { customerId: req.customer.customerId, name: trimmed, id: { not: list.id } },
      })
      if (dup) return res.status(409).json({ error: 'A list with that name already exists' })
      data.name = trimmed
    }
    if (description !== undefined) data.description = description ? description.trim().slice(0, 500) : null
    const updated = await prisma.wishlist.update({
      where: { id: list.id },
      data,
      include: LIST_INCLUDE,
    })
    res.json(updated)
  } catch (err) {
    console.error('Error updating wishlist:', err)
    res.status(500).json({ error: 'Failed to update list' })
  }
})

// DELETE /api/wishlist/lists/:id — delete (not default)
router.delete('/lists/:id', requireCustomer, async (req, res) => {
  try {
    const list = await prisma.wishlist.findFirst({
      where: { id: req.params.id, customerId: req.customer.customerId },
    })
    if (!list) return res.status(404).json({ error: 'List not found' })
    if (list.isDefault) return res.status(400).json({ error: 'Cannot delete your default list' })
    await prisma.wishlist.delete({ where: { id: list.id } })
    res.json({ deleted: true })
  } catch (err) {
    console.error('Error deleting wishlist:', err)
    res.status(500).json({ error: 'Failed to delete list' })
  }
})

// POST /api/wishlist/items — add item
router.post('/items', requireCustomer, async (req, res) => {
  const { productId, variantId, listId, note } = req.body
  if (!productId) return res.status(400).json({ error: 'productId required' })
  try {
    let wishlist
    if (listId) {
      wishlist = await prisma.wishlist.findFirst({
        where: { id: listId, customerId: req.customer.customerId },
        select: { id: true },
      })
      if (!wishlist) return res.status(404).json({ error: 'List not found' })
    } else {
      wishlist = await getOrCreateDefaultList(req.customer.customerId)
    }
    const item = await prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId_variantId: {
          wishlistId: wishlist.id,
          productId,
          variantId: variantId || null,
        },
      },
      update: { note: note !== undefined ? (note ? note.trim().slice(0, 500) : null) : undefined },
      create: {
        wishlistId: wishlist.id,
        productId,
        variantId: variantId || null,
        note: note ? note.trim().slice(0, 500) : null,
      },
    })
    auditLog('wishlist_add', item.id, { productId, customerId: req.customer.customerId, listId: wishlist.id })
    res.status(201).json({ id: item.id, wishlistId: wishlist.id, productId, variantId: variantId || null })
  } catch (err) {
    console.error('Error adding to wishlist:', err)
    res.status(500).json({ error: 'Failed to add to wishlist' })
  }
})

// DELETE /api/wishlist/items/:productId — remove from default list (back-compat)
router.delete('/items/:productId', requireCustomer, async (req, res) => {
  try {
    const wishlist = await prisma.wishlist.findFirst({
      where: { customerId: req.customer.customerId, isDefault: true },
      select: { id: true },
    })
    if (!wishlist) return res.status(404).json({ error: 'Wishlist not found' })
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId: req.params.productId },
    })
    if (deleted.count === 0) return res.status(404).json({ error: 'Item not in wishlist' })
    auditLog('wishlist_remove', req.params.productId, { productId: req.params.productId, customerId: req.customer.customerId })
    res.json({ removed: true })
  } catch (err) {
    console.error('Error removing from wishlist:', err)
    res.status(500).json({ error: 'Failed to remove from wishlist' })
  }
})

// DELETE /api/wishlist/lists/:listId/items/:productId — remove from specific list
router.delete('/lists/:listId/items/:productId', requireCustomer, async (req, res) => {
  try {
    const list = await prisma.wishlist.findFirst({
      where: { id: req.params.listId, customerId: req.customer.customerId },
      select: { id: true },
    })
    if (!list) return res.status(404).json({ error: 'List not found' })
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { wishlistId: list.id, productId: req.params.productId },
    })
    if (deleted.count === 0) return res.status(404).json({ error: 'Item not in list' })
    auditLog('wishlist_remove', req.params.productId, { productId: req.params.productId, listId: list.id })
    res.json({ removed: true })
  } catch (err) {
    console.error('Error removing from list:', err)
    res.status(500).json({ error: 'Failed to remove item' })
  }
})

// GET /api/wishlist/check/:productId — check across all lists
router.get('/check/:productId', requireCustomer, async (req, res) => {
  try {
    const lists = await prisma.wishlist.findMany({
      where: { customerId: req.customer.customerId },
      select: {
        id: true, name: true,
        items: {
          where: { productId: req.params.productId },
          select: { id: true, variantId: true },
        },
      },
    })
    const saved = lists.some(l => l.items.length > 0)
    const inLists = lists.filter(l => l.items.length > 0).map(l => ({ id: l.id, name: l.name }))
    res.json({ saved, lists: inLists })
  } catch (err) {
    console.error('Error checking wishlist:', err)
    res.status(500).json({ error: 'Failed to check wishlist' })
  }
})

// POST /api/wishlist/merge — merge guest wishlist into customer account
router.post('/merge', requireCustomer, async (req, res) => {
  const { guestToken } = req.body
  if (!guestToken) return res.status(400).json({ error: 'guestToken required' })
  try {
    const hash = hashToken(guestToken)
    const guestList = await prisma.wishlist.findFirst({
      where: { guestTokenHash: hash, customerId: null },
      include: { items: true },
    })
    if (!guestList || guestList.items.length === 0) {
      return res.json({ merged: 0 })
    }
    const defaultList = await getOrCreateDefaultList(req.customer.customerId)
    let merged = 0
    for (const item of guestList.items) {
      try {
        await prisma.wishlistItem.upsert({
          where: {
            wishlistId_productId_variantId: {
              wishlistId: defaultList.id,
              productId: item.productId,
              variantId: item.variantId,
            },
          },
          update: {},
          create: {
            wishlistId: defaultList.id,
            productId: item.productId,
            variantId: item.variantId,
            note: item.note,
          },
        })
        merged++
      } catch { /* skip items referencing deleted products */ }
    }
    await prisma.wishlist.delete({ where: { id: guestList.id } })
    auditLog('wishlist_merge', defaultList.id, {
      customerId: req.customer.customerId,
      mergedItems: merged,
    })
    res.json({ merged })
  } catch (err) {
    console.error('Error merging wishlist:', err)
    res.status(500).json({ error: 'Failed to merge wishlist' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// GUEST ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/wishlist/guest
router.get('/guest', async (req, res) => {
  const token = getGuestToken(req)
  if (!token) return res.json({ items: [] })
  try {
    const wishlist = await getOrCreateGuestList(token)
    res.json(wishlist)
  } catch (err) {
    console.error('Error fetching guest wishlist:', err)
    res.status(500).json({ error: 'Failed to fetch wishlist' })
  }
})

// POST /api/wishlist/guest/items
router.post('/guest/items', async (req, res) => {
  const token = getGuestToken(req)
  if (!token) return res.status(400).json({ error: 'x-wishlist-token header required' })
  const { productId, variantId } = req.body
  if (!productId) return res.status(400).json({ error: 'productId required' })
  try {
    const wishlist = await getOrCreateGuestList(token)
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
    res.status(201).json({ id: item.id, productId, variantId: variantId || null })
  } catch (err) {
    console.error('Error adding to guest wishlist:', err)
    res.status(500).json({ error: 'Failed to add to wishlist' })
  }
})

// DELETE /api/wishlist/guest/items/:productId
router.delete('/guest/items/:productId', async (req, res) => {
  const token = getGuestToken(req)
  if (!token) return res.status(400).json({ error: 'x-wishlist-token header required' })
  try {
    const hash = hashToken(token)
    const wishlist = await prisma.wishlist.findFirst({
      where: { guestTokenHash: hash, customerId: null },
      select: { id: true },
    })
    if (!wishlist) return res.status(404).json({ error: 'Wishlist not found' })
    const deleted = await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId: req.params.productId },
    })
    if (deleted.count === 0) return res.status(404).json({ error: 'Item not in wishlist' })
    res.json({ removed: true })
  } catch (err) {
    console.error('Error removing from guest wishlist:', err)
    res.status(500).json({ error: 'Failed to remove from wishlist' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// SHARING
// ════════════════════════════════════════════════════════════════════════════

// POST /api/wishlist/share/:listId — create share link
router.post('/share/:listId', requireCustomer, async (req, res) => {
  try {
    const list = await prisma.wishlist.findFirst({
      where: { id: req.params.listId, customerId: req.customer.customerId },
    })
    if (!list) return res.status(404).json({ error: 'List not found' })
    const token = crypto.randomBytes(32).toString('hex')
    const share = await prisma.wishlistShare.create({
      data: {
        wishlistId: list.id,
        tokenHash: hashToken(token),
        accessType: 'view',
      },
    })
    res.status(201).json({ shareId: share.id, token, url: `/wishlist/shared/${token}` })
  } catch (err) {
    console.error('Error creating share:', err)
    res.status(500).json({ error: 'Failed to create share link' })
  }
})

// DELETE /api/wishlist/share/:shareId — revoke
router.delete('/share/:shareId', requireCustomer, async (req, res) => {
  try {
    const share = await prisma.wishlistShare.findUnique({
      where: { id: req.params.shareId },
      include: { wishlist: { select: { customerId: true } } },
    })
    if (!share || share.wishlist.customerId !== req.customer.customerId) {
      return res.status(404).json({ error: 'Share not found' })
    }
    await prisma.wishlistShare.update({
      where: { id: share.id },
      data: { revokedAt: new Date() },
    })
    res.json({ revoked: true })
  } catch (err) {
    console.error('Error revoking share:', err)
    res.status(500).json({ error: 'Failed to revoke share' })
  }
})

// GET /api/wishlist/shared/:token — public view
router.get('/shared/:token', async (req, res) => {
  try {
    const hash = hashToken(req.params.token)
    const share = await prisma.wishlistShare.findUnique({
      where: { tokenHash: hash },
      include: {
        wishlist: {
          include: {
            items: {
              include: { product: { select: PRODUCT_SELECT } },
              orderBy: { addedAt: 'desc' },
            },
          },
        },
      },
    })
    if (!share || share.revokedAt) return res.status(404).json({ error: 'Shared list not found or link expired' })
    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ error: 'This share link has expired' })
    }
    const { items, name, description } = share.wishlist
    res.json({ name, description, items, shareId: share.id })
  } catch (err) {
    console.error('Error fetching shared wishlist:', err)
    res.status(500).json({ error: 'Failed to fetch shared list' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════

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
    res.json({ customer: { id: req.params.customerId }, wishlists })
  } catch (err) {
    console.error('Error fetching customer wishlists:', err)
    res.status(500).json({ error: 'Failed to fetch wishlists' })
  }
})

router.get('/admin/stats', requirePerm('wishlists', 'read'), async (req, res) => {
  try {
    const [totalLists, totalItems, activeLists] = await Promise.all([
      prisma.wishlist.count(),
      prisma.wishlistItem.count(),
      prisma.wishlist.count({ where: { items: { some: {} } } }),
    ])
    const topProducts = await prisma.wishlistItem.groupBy({
      by: ['productId'],
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 10,
    })
    const products = topProducts.length
      ? await prisma.product.findMany({
          where: { id: { in: topProducts.map(t => t.productId) } },
          select: { id: true, name: true, family: true, primaryImage: true },
        })
      : []
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))
    res.json({
      totalLists,
      totalItems,
      activeLists,
      topProducts: topProducts.map(t => ({
        ...productMap[t.productId],
        savedCount: t._count.productId,
      })),
    })
  } catch (err) {
    console.error('Error fetching wishlist stats:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
