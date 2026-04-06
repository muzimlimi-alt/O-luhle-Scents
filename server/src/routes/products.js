import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { convertPrice } from '../lib/currencyService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../images/products')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const originalName = file.originalname.replace(/\s+/g, '_')
    cb(null, `${timestamp}_${originalName}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) return cb(null, true)
    cb(new Error('Only images are allowed'))
  }
})

const router = Router()

// GET /api/products
router.get('/', async (req, res, next) => {
  try {
    const { 
      category, 
      search, 
      sort, 
      status,
      minPrice, 
      maxPrice, 
      tags, 
      currency = 'ZAR',
      page = 1,
      limit = 10
    } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Admins (Bearer token present) see all products by default; storefront only sees active
    const isAdmin = !!req.headers.authorization
    const where = isAdmin ? {} : { isActive: true }

    // If admin explicitly requests a status
    if (isAdmin && status && status !== 'all') {
      where.isActive = status === 'active'
    }

    if (category && category !== 'all') {
      // Check if category is a UUID or a slug/name
      if (category.length > 20) {
        where.categoryId = category
      } else {
        where.category = { name: { contains: category, mode: 'insensitive' } }
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (tags) {
      const tagList = tags.split(',')
      where.AND = tagList.map(t => ({ tags: { contains: t } }))
    }

    if (minPrice || maxPrice) {
      where.variants = {
        some: {
          price: {
            gte: minPrice ? parseFloat(minPrice) : undefined,
            lte: maxPrice ? parseFloat(maxPrice) : undefined
          }
        }
      }
    }

    // Extended Sorting
    let orderBy = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    if (sort === 'name-asc') orderBy = { name: 'asc' }
    if (sort === 'name-desc') orderBy = { name: 'desc' }
    
    // Note: Prisma does not support easy direct sorting by related variant counts/prices in findMany
    // We maintain basic sort logic for these for now. 
    if (sort === 'price-low') orderBy = { createdAt: 'desc' } // Placeholder for complex aggregate sort

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { 
          category: true,
          supplier: true,
          variants: { include: { inventory: true } } 
        },
        orderBy,
        skip,
        take: limitNum
      }),
      prisma.product.count({ where })
    ])

    // On-the-fly currency conversion
    const formattedProducts = await Promise.all(products.map(async (p) => {
      const convertedVariants = await Promise.all(p.variants.map(async (v) => ({
        ...v,
        originalPrice: v.price,
        price: await convertPrice(v.price, currency),
        currency
      })))
      return { ...p, variants: convertedVariants }
    }))

    res.json({ 
      count: formattedProducts.length, 
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum,
      products: formattedProducts 
    })
  } catch (err) { next(err) }
})


// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { currency = 'ZAR' } = req.query
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        variants: { 
          include: { inventory: true },
          orderBy: { price: 'asc' }
        }
      }
    })

    if (!product || (!product.isActive && !req.headers.authorization)) {
      return res.status(404).json({ error: 'Scent not found' })
    }

    const convertedVariants = await Promise.all(product.variants.map(async (v) => ({
      ...v,
      originalPrice: v.price,
      price: await convertPrice(v.price, currency),
      currency
    })))

    const related = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isActive: true
      },
      take: 4,
      include: { variants: true }
    })

    const formattedRelated = await Promise.all(related.map(async (r) => {
      const minPrice = r.variants.length > 0 ? Math.min(...r.variants.map(rv => rv.price)) : 0
      return {
        ...r,
        price: await convertPrice(minPrice, currency),
        currency
      }
    }))

    res.json({ 
      ...product, 
      variants: convertedVariants,
      related: formattedRelated
    })
  } catch (err) { next(err) }
})

// GET /api/products/low-stock
router.get('/low-stock', requireAdmin, async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5
    const lowStock = await prisma.inventory.findMany({
      where: { quantity: { lt: threshold } },
      include: { variant: { include: { product: { include: { supplier: true } } } } }
    })
    res.json(lowStock)
  } catch (err) { next(err) }
})

// POST /api/products (admin only)
router.post('/', requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const { name, brand, description, categoryId, variants, supplierId, tags } = req.body
    const files = req.files || []
    const filenames = files.map(f => f.filename)
    const primaryImage = filenames.length > 0 ? filenames[0] : null
    
    const parsedVariants = JSON.parse(variants || '[]')

    const product = await prisma.$transaction(async (tx) => {
      // Defensive UUID handling: Ensure empty strings or "undefined" are passed as null
      const safeCategoryId = (categoryId && categoryId !== "" && categoryId !== "undefined") ? categoryId : null;
      const safeSupplierId = (supplierId && supplierId !== "" && supplierId !== "undefined") ? supplierId : null;

      const p = await tx.product.create({
        data: {
          name, 
          brand: brand || "O'luhle Scents", 
          description: description || "", 
          category: safeCategoryId ? { connect: { id: safeCategoryId } } : undefined,
          supplier: safeSupplierId ? { connect: { id: safeSupplierId } } : undefined,
          images: JSON.stringify(filenames),
          primaryImage,
          isActive: true
        }
      })

      for (const v of parsedVariants) {
        const variantPrice = parseFloat(v.price) || 0;
        const variantCost = (v.costPrice && v.costPrice !== "") ? parseFloat(v.costPrice) : 0;
        
        const variant = await tx.productVariant.create({
          data: {
            productId: p.id,
            size: v.size || 'Standard',
            price: variantPrice,
            costPrice: variantCost,
            sku: v.sku || `SKU-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            barcode: v.barcode || null,
          }
        })
        
        await tx.inventory.create({
          data: {
            variantId: variant.id,
            quantity: parseInt(v.quantity || 0),
            lowStockThreshold: parseInt(v.lowStockThreshold || 5)
          }
        })
      }
      return tx.product.findUnique({
        where: { id: p.id },
        include: { variants: { include: { inventory: true } } }
      })
    })

    res.status(201).json(product)
  } catch (err) { 
    console.error('[POST /api/products] Error:', err);
    next(err);
  }
})

// PATCH /api/products/:id
router.patch('/:id', requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    console.log('[PATCH /api/products/:id] Payload:', { id: req.params.id, body: req.body, files: req.files?.length });
    const { name, brand, description, categoryId, isActive, variants, tags, existingImages } = req.body
    
    // Manage image orchestration
    let currentImages = []
    try { currentImages = JSON.parse(existingImages || '[]') } catch (e) { currentImages = [] }
    
    const files = req.files || []
    const newFiles = files.map(f => f.filename)
    const allImages = [...currentImages, ...newFiles]
    const primaryImage = allImages.length > 0 ? allImages[0] : null

    const product = await prisma.$transaction(async (tx) => {
      // Defensive UUID handling
      const safeCategoryId = (categoryId && categoryId !== "" && categoryId !== "undefined") ? categoryId : null;
      const safeSupplierId = (req.body.supplierId && req.body.supplierId !== "" && req.body.supplierId !== "undefined") ? req.body.supplierId : null;
      
      console.log('[PATCH] Transaction Logic:', { safeCategoryId, safeSupplierId });

      // 1. Update Product details
      const p = await tx.product.update({
        where: { id: req.params.id },
        data: { 
          name, 
          brand, 
          description, 
          category: safeCategoryId ? { connect: { id: safeCategoryId } } : { disconnect: true },
          supplier: safeSupplierId ? { connect: { id: safeSupplierId } } : { disconnect: true },
          isActive: isActive === 'true' || isActive === true,
          images: JSON.stringify(allImages),
          primaryImage
        }
      })

      // 2. Manage Variants (if provided)
      if (variants) {
        const parsedVariants = JSON.parse(variants)
        // For simplicity in this modernization, we'll sync by SKU or recreate
        // production grade: update by ID, delete missing, create new.
        for (const v of parsedVariants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: { 
                size: v.size, 
                price: parseFloat(v.price) || 0, 
                costPrice: (v.costPrice && v.costPrice !== "") ? parseFloat(v.costPrice) : 0,
                barcode: v.barcode || undefined
              }
            })
            if (v.quantity !== undefined || v.lowStockThreshold !== undefined) {
              await tx.inventory.updateMany({
                where: { variantId: v.id },
                data: { 
                  quantity: v.quantity !== undefined ? parseInt(v.quantity) : undefined,
                  lowStockThreshold: v.lowStockThreshold !== undefined ? parseInt(v.lowStockThreshold) : undefined
                }
              })
            }
          } else {
            const nv = await tx.productVariant.create({
              data: {
                productId: p.id,
                size: v.size,
                price: parseFloat(v.price) || 0,
                costPrice: (v.costPrice && v.costPrice !== "") ? parseFloat(v.costPrice) : 0,
                sku: v.sku || `SKU-${Date.now()}`,
                barcode: v.barcode || null
              }
            })
            await tx.inventory.create({
              data: { 
                variantId: nv.id, 
                quantity: parseInt(v.quantity || 0),
                lowStockThreshold: parseInt(v.lowStockThreshold || 5)
              }
            })
          }
        }
      }

      return tx.product.findUnique({
        where: { id: req.params.id },
        include: { variants: { include: { inventory: true } } }
      })
    })

    res.json(product)
  } catch (err) { 
    console.error('[PATCH /api/products/:id] Error:', err);
    next(err);
  }
})


// DELETE /api/products/:id (soft delete)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
