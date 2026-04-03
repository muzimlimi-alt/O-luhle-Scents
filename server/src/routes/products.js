import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../images/products')

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const originalName = file.originalname.replace(/\s+/g, '_')
    cb(null, `${timestamp}_${originalName}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) return cb(null, true)
    cb(new Error('Only images (.jpg, .jpeg, .png, .webp) are allowed'))
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
      minPrice, 
      maxPrice, 
      colors, 
      tags,
      includeDeleted // admin might want this
    } = req.query

    const where = {
      deletedAt: includeDeleted === 'true' ? undefined : null,
      active: includeDeleted === 'true' ? undefined : true
    }

    if (category && category !== 'all') {
      where.category = { slug: category }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } }
      ]
    }

    if (minPrice || maxPrice) {
      where.price = {
        gte: minPrice ? parseInt(minPrice) : undefined,
        lte: maxPrice ? parseInt(maxPrice) : undefined
      }
    }

    // Filter by JSON strings (basic contains for simplicity in SQLite)
    if (colors) {
      const colorList = colors.split(',')
      where.AND = where.AND || []
      colorList.forEach(c => {
        where.AND.push({ colors: { contains: c } })
      })
    }

    if (tags) {
      const tagList = tags.split(',')
      where.AND = where.AND || []
      tagList.forEach(t => {
        where.AND.push({ tags: { contains: t } })
      })
    }

    let orderBy = { createdAt: 'desc' }
    if (sort) {
      switch (sort) {
        case 'new': orderBy = { createdAt: 'desc' }; break
        case 'price-low': orderBy = { price: 'asc' }; break
        case 'price-high': orderBy = { price: 'desc' }; break
        case 'popular': orderBy = { orderItems: { _count: 'desc' } }; break
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy
    })

    res.json({
      count: products.length,
      products
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/products/low-stock (admin only)
router.get('/low-stock', requireAdmin, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { stockQty: { lt: 5 }, deletedAt: null },
      include: { category: true },
      orderBy: { stockQty: 'asc' },
    })
    res.json(products)
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' })

    const product = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    res.json(product)
  } catch (err) {
    next(err)
  }
})

// POST /api/products (admin only)
router.post('/', requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const { 
      name, description, sku, categoryId, 
      price, price50ml, price100ml, 
      badge, stockQty, colors, tags, primaryImage 
    } = req.body
    
    const filenames = req.files.map(f => f.filename)
    const user = req.user?.firstName + ' ' + (req.user?.lastName || '')

    const product = await prisma.product.create({
      data: {
        name,
        description,
        sku,
        categoryId: parseInt(categoryId),
        price: price ? parseInt(price) : null,
        price50ml: parseInt(price50ml || 0),
        price100ml: parseInt(price100ml || 0),
        badge,
        stockQty: parseInt(stockQty || 0),
        images: JSON.stringify(filenames),
        primaryImage: primaryImage || filenames[0],
        imageUrl: filenames[0] ? `/images/products/${filenames[0]}` : '',
        colors: colors || '[]',
        tags: tags || '[]',
        createdBy: user.trim()
      },
      include: { category: true }
    })
    res.status(201).json(product)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/products/:id (admin only)
router.patch('/:id', requireAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id)
    const { 
      name, description, sku, categoryId, 
      price, price50ml, price100ml, 
      badge, stockQty, active, colors, tags, 
      primaryImage, existingImages 
    } = req.body
    
    const user = req.user?.firstName + ' ' + (req.user?.lastName || '')
    const newFiles = req.files.map(f => f.filename)
    
    // Combine existing and new images
    let finalImages = []
    if (existingImages) {
      finalImages = Array.isArray(existingImages) ? existingImages : [existingImages]
    }
    finalImages = [...finalImages, ...newFiles]

    const data = {
      updatedBy: user.trim()
    }
    
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (sku !== undefined) data.sku = sku
    if (categoryId !== undefined) data.categoryId = parseInt(categoryId)
    if (price !== undefined) data.price = parseInt(price)
    if (price50ml !== undefined) data.price50ml = parseInt(price50ml)
    if (price100ml !== undefined) data.price100ml = parseInt(price100ml)
    if (stockQty !== undefined) data.stockQty = parseInt(stockQty)
    if (badge !== undefined) data.badge = badge
    if (active !== undefined) data.active = active === 'true' || active === true
    if (colors !== undefined) data.colors = colors
    if (tags !== undefined) data.tags = tags
    
    data.images = JSON.stringify(finalImages)
    data.primaryImage = primaryImage || finalImages[0]
    if (finalImages[0]) data.imageUrl = `/images/products/${finalImages[0]}`

    const product = await prisma.product.update({
      where: { id: productId },
      data,
      include: { category: true }
    })
    res.json(product)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/products/:id (admin only)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id)
    const user = req.user?.firstName + ' ' + (req.user?.lastName || '')

    await prisma.product.update({
      where: { id: productId },
      data: { 
        active: false,
        deletedAt: new Date(),
        deletedBy: user.trim()
      }
    })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
