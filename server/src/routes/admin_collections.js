// Collections: merchandising groupings (Premium, Signature, Flame & Bloom,
// Gourmet Petite…) distinct from Category (Perfume / Candle / Bath Salt).
// One product can belong to multiple collections — the join lives in
// ProductCollection.
//
// Public GET /api/collections (unauthed) is used by the storefront to render
// collection pages; everything else is admin-only.

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requirePerm } from '../middleware/auth.js'
import { generateUniqueCollectionSlug } from '../lib/slug.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const collectionImageDir = path.join(__dirname, '../../../images/collections')
if (!fs.existsSync(collectionImageDir)) fs.mkdirSync(collectionImageDir, { recursive: true })

// Collection hero images sit in their own folder (not images/products/)
// because the storefront serves them as full-width banner backgrounds —
// larger than product gallery images and worth lazy-loading separately.
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, collectionImageDir),
  filename: (req, file, cb) => {
    const stamp = Date.now()
    const clean = file.originalname.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '')
    cb(null, `${stamp}_${clean}`)
  },
})

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB — hero crops can be chunky
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype) ||
      /\.(jpe?g|png|webp)$/i.test(file.originalname)
    cb(ok ? null : new Error('Only JPG, PNG or WebP images are allowed'), ok)
  },
})

const router = Router()

// Best-effort audit entry — same rationale as the catalogue router's helper:
// a logging failure must never fail the mutation.
async function audit(req, { action, entity, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details || null,
      },
    })
  } catch (err) {
    console.warn('[collections audit]', action, err.message)
  }
}

// ─── GET /api/collections ─────────────────────────────────────────────────
// Public sees active collections only; admin (Bearer header present) sees all
// plus the product-count aggregate the admin UI needs for its card badge.
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = !!req.headers.authorization
    const collections = await prisma.collection.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        displayOrder: true,
        isActive: true,
        _count: isAdmin ? { select: { products: true } } : undefined,
      },
    })
    res.json(collections)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/collections/:slugOrId/products ──────────────────────────────
// Storefront-friendly: accept either the slug or the UUID so category/
// collection landing pages can use either in their URL.
router.get('/:slugOrId/products', async (req, res, next) => {
  try {
    const { slugOrId } = req.params
    const isUuid = slugOrId.length > 20
    const collection = await prisma.collection.findUnique({
      where: isUuid ? { id: slugOrId } : { slug: slugOrId },
    })
    if (!collection) return res.status(404).json({ error: 'Collection not found' })

    const isAdmin = !!req.headers.authorization
    const productCollections = await prisma.productCollection.findMany({
      where: { collectionId: collection.id },
      include: {
        product: {
          include: {
            variants: { select: { id: true, size: true, price: true, sku: true } },
            category: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    })
    const products = productCollections
      .map((pc) => pc.product)
      .filter((p) => (isAdmin ? true : p.status === 'ACTIVE'))

    res.json({ collection, products })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/collections (collections:write) ────────────────────────────
router.post('/', requirePerm('collections', 'write'), async (req, res, next) => {
  try {
    const { name, description, image, displayOrder, isActive } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Collection name is required' })

    const slug = await generateUniqueCollectionSlug(name)
    const collection = await prisma.collection.create({
      data: {
        name: name.trim(),
        slug,
        description: description || null,
        image: image || null,
        displayOrder: parseInt(displayOrder) || 0,
        isActive: isActive === undefined ? true : Boolean(isActive),
      },
    })
    await audit(req, { action: 'COLLECTION_CREATE', entity: 'Collection', entityId: collection.id, details: { name: collection.name, slug } })
    res.status(201).json(collection)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A collection with that name already exists' })
    }
    next(err)
  }
})

// ─── PATCH /api/collections/:id (collections:write) ───────────────────────
router.patch('/:id', requirePerm('collections', 'write'), async (req, res, next) => {
  try {
    const { name, description, image, displayOrder, isActive } = req.body
    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
        image: image !== undefined ? image || null : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    })
    await audit(req, { action: 'COLLECTION_UPDATE', entity: 'Collection', entityId: collection.id, details: { changes: req.body } })
    res.json(collection)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'A collection with that name already exists' })
    }
    next(err)
  }
})

// ─── DELETE /api/collections/:id (collections:delete) — soft: deactivate ──
router.delete('/:id', requirePerm('collections', 'delete'), async (req, res, next) => {
  try {
    const productCount = await prisma.productCollection.count({
      where: { collectionId: req.params.id },
    })
    if (productCount > 0) {
      return res.status(400).json({
        error: `Cannot remove — ${productCount} product(s) still reference it. Unlink them first.`,
      })
    }
    await prisma.collection.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    await audit(req, { action: 'COLLECTION_ARCHIVE', entity: 'Collection', entityId: req.params.id, details: null })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/collections/:id/image (collections:write) ─────────────────
// Uploads a hero image for a collection and updates Collection.image to the
// new filename. Returns the updated collection so the admin UI can show the
// new preview without a separate fetch.
router.post(
  '/:id/image',
  requirePerm('collections', 'write'),
  imageUpload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file is required' })
      const collection = await prisma.collection.update({
        where: { id: req.params.id },
        data: { image: req.file.filename },
      })
      await audit(req, {
        action: 'COLLECTION_IMAGE_UPLOAD',
        entity: 'Collection',
        entityId: collection.id,
        details: { filename: req.file.filename, size: req.file.size },
      })
      res.json(collection)
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/collections/:id/image (collections:write) ────────────────
router.delete('/:id/image', requirePerm('collections', 'write'), async (req, res, next) => {
  try {
    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: { image: null },
    })
    await audit(req, { action: 'COLLECTION_IMAGE_REMOVE', entity: 'Collection', entityId: collection.id, details: null })
    res.json(collection)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/collections/:id/products (collections:link) ───────────────
router.post('/:id/products', requirePerm('collections', 'link'), async (req, res, next) => {
  try {
    const { productIds } = req.body
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds must be a non-empty array' })
    }
    // createMany with skipDuplicates uses the ProductCollection composite PK
    // as the dedupe key, so re-posting an already-linked product is a no-op.
    const result = await prisma.productCollection.createMany({
      data: productIds.map((productId) => ({ productId, collectionId: req.params.id })),
      skipDuplicates: true,
    })
    res.json({ added: result.count })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/collections/:id/products/:productId (collections:link) ──
router.delete('/:id/products/:productId', requirePerm('collections', 'link'), async (req, res, next) => {
  try {
    await prisma.productCollection.delete({
      where: {
        productId_collectionId: {
          productId: req.params.productId,
          collectionId: req.params.id,
        },
      },
    })
    res.status(204).end()
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Link not found' })
    next(err)
  }
})

export default router
