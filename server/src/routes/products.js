import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { convertPrice } from '../lib/currencyService.js'
import { adjustStock } from '../lib/inventoryService.js'
import { generateUniqueProductSlug } from '../lib/slug.js'
import { syncProductMedia } from '../lib/mediaService.js'

const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED']
const PRODUCT_FAMILIES = ['PERFUME', 'CANDLE', 'HOME_FRAGRANCE', 'ACCESSORY', 'GIFT_SET']

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
    const where = isAdmin ? {} : { status: 'ACTIVE' }

    // If admin explicitly requests a status
    if (isAdmin && status && status !== 'all') {
      const upper = status.toUpperCase()
      if (PRODUCT_STATUSES.includes(upper)) where.status = upper
    }

    if (category && category !== 'all') {
      // Check if category is a UUID or a slug/name
      if (category.length > 20) {
        where.categoryId = category
      } else {
        // Slug match first (the real identifier categories are linked by
        // everywhere else — storefront filter buttons, ?cat= deep links);
        // name-contains stays as a fallback for any older link that still
        // passes a bare name instead of a slug.
        where.category = {
          OR: [
            { slug: { equals: category, mode: 'insensitive' } },
            { name: { contains: category, mode: 'insensitive' } },
          ]
        }
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ]
    }

    if (tags) {
      // tags is now a String[] column (PIM) — hasEvery matches the original
      // "must have all of these tags" intent, not the old string `contains`.
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
      where.tags = { hasEvery: tagList }
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
          brandRef: true,
          variants: { include: { inventory: true } },
          attributeValues: { include: { definition: true } },
          media: { include: { media: true }, orderBy: { sortOrder: 'asc' } }
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
  } catch (err) {
    console.error('API GET ERROR TRACE:', err);
    res.status(500).json({ error: 'Internal server error', msg: err.message, stack: err.stack });
  }
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
        },
        attributeValues: { include: { definition: true } },
        media: { include: { media: true }, orderBy: { sortOrder: 'asc' } }
      }
    })

    if (!product || (product.status !== 'ACTIVE' && !req.headers.authorization)) {
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
        status: 'ACTIVE'
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
    const {
      name, brand, description, categoryId, variants, supplierId,
      collection, type, scentFamily, status,
      topNotes, heartNotes, baseNotes, cardBadge,
      internalName, family, brandId, tags, launchDate, retirementDate,
      shortDescription, marketingDescription, ingredients,
      usageInstructions, safetyWarnings, careInstructions,
      metaTitle, metaDescription, attributes
    } = req.body

    // Auto-population Logic (Backend Enforcement)
    let oilConcentration = "Varies";
    let longevity = "N/A";
    if (type === "Extrait de Parfum" || type === "Parfum") {
      oilConcentration = "±20–40%"; longevity = "±10–24 hours";
    } else if (type === "Eau de Parfum") {
      oilConcentration = "±15–20%"; longevity = "±6–10 hours";
    } else if (type === "Eau de Toilette") {
      oilConcentration = "±5–15%"; longevity = "±3–6 hours";
    } else if (type === "Eau de Cologne" || type === "Eau Fraîche") {
      oilConcentration = type === "Eau de Cologne" ? "±2–4%" : "±1–3%";
      longevity = "±1–2 hours";
    } else if (type === "Eau de Senteur") {
      longevity = "Short, depends on solvents";
    } else if (type === "Splash & Aftershave") {
      longevity = "±1–3 hours";
    }

    const characteristicMap = {
      "Floral": "Sweet, Soft, Feminine",
      "Citrus": "Fresh, Bright, Uplifting",
      "Fruity": "Sweet, Juicy, Fun",
      "Woody": "Warm, Masculine, Deep",
      "Oriental": "Warm, Exotic, Sensual",
      "Aquatic": "Clean, Fresh, Airy; not too sweet or heavy",
      "Herbal": "Fresh, Herbal, Clean"
    };
    const characteristic = characteristicMap[scentFamily] || "N/A";

    const files = req.files || []
    const filenames = files.map(f => f.filename)
    const primaryImage = filenames.length > 0 ? filenames[0] : null

    const parsedVariants = JSON.parse(variants || '[]')
    const parsedTags = (() => { try { return JSON.parse(tags || '[]') } catch { return [] } })()
    const slug = await generateUniqueProductSlug(name)

    const product = await prisma.$transaction(async (tx) => {
      // Defensive UUID handling
      const safeCategoryId = (categoryId && categoryId !== "" && categoryId !== "undefined") ? categoryId : null;
      const safeSupplierId = (supplierId && supplierId !== "" && supplierId !== "undefined") ? supplierId : null;
      const safeBrandId = (brandId && brandId !== "" && brandId !== "undefined") ? brandId : null;

      const p = await tx.product.create({
        data: {
          name,
          brand: brand || "O'luhle Scents",
          description: description || "",
          category: safeCategoryId ? { connect: { id: safeCategoryId } } : undefined,
          supplier: safeSupplierId ? { connect: { id: safeSupplierId } } : undefined,
          images: JSON.stringify(filenames),
          primaryImage,
          cardBadge,
          status: PRODUCT_STATUSES.includes(status) ? status : 'ACTIVE',
          collection,
          type,
          oilConcentration,
          longevity,
          scentFamily,
          characteristic,
          topNotes,
          heartNotes,
          baseNotes,
          slug,
          internalName: internalName || null,
          brandRef: safeBrandId ? { connect: { id: safeBrandId } } : undefined,
          family: PRODUCT_FAMILIES.includes(family) ? family : 'PERFUME',
          tags: parsedTags,
          launchDate: launchDate ? new Date(launchDate) : null,
          retirementDate: retirementDate ? new Date(retirementDate) : null,
          shortDescription: shortDescription || null,
          marketingDescription: marketingDescription || null,
          ingredients: ingredients || null,
          usageInstructions: usageInstructions || null,
          safetyWarnings: safetyWarnings || null,
          careInstructions: careInstructions || null,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null
        }
      })

      for (const v of parsedVariants) {
        const variantPrice = parseFloat(v.price) || 0;
        const variantCost = (v.costPrice && v.costPrice !== "") ? parseFloat(v.costPrice) : 0;
        const variantPackagingCost = (v.packagingCost && v.packagingCost !== "") ? parseFloat(v.packagingCost) : 0;
        const variantLabellingCost = (v.labellingCost && v.labellingCost !== "") ? parseFloat(v.labellingCost) : 0;

        let volume = parseInt(v.volume || 0);
        if (v.size === "Full Size") volume = 100;
        else if (v.size === "Travel Size") volume = 50;

        const variant = await tx.productVariant.create({
          data: {
            productId: p.id,
            size: v.size || 'Other',
            price: variantPrice,
            costPrice: variantCost,
            packagingCost: variantPackagingCost,
            labellingCost: variantLabellingCost,
            sku: v.sku || `SKU-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            barcode: v.barcode || null,
            uom: v.uom || 'ml',
            volume
          }
        })
        
        const startingQuantity = parseInt(v.quantity || 0)
        await tx.inventory.create({
          data: {
            variantId: variant.id,
            quantity: startingQuantity,
            lowStockThreshold: parseInt(v.lowStockThreshold || 5)
          }
        })

        if (startingQuantity > 0) {
          await tx.inventoryLog.create({
            data: {
              variantId: variant.id,
              changeType: 'INITIAL_STOCK',
              quantityChanged: startingQuantity,
              reason: 'Opening stock on product creation',
              referenceId: p.id
            }
          })
        }
      }

      // Family-specific attribute values (e.g. Candle -> Wax Type). Keyed by
      // AttributeDefinition id, populated by ProductModal's dynamic form.
      const parsedAttributes = (() => { try { return JSON.parse(attributes || '{}') } catch { return {} } })()
      for (const [definitionId, value] of Object.entries(parsedAttributes)) {
        if (value === '' || value === null || value === undefined) continue
        await tx.productAttributeValue.create({
          data: { productId: p.id, definitionId, value: String(value) }
        })
      }

      await syncProductMedia(tx, p.id, filenames)

      return tx.product.findUnique({
        where: { id: p.id },
        include: {
          variants: { include: { inventory: true } },
          attributeValues: { include: { definition: true } },
          media: { include: { media: true }, orderBy: { sortOrder: 'asc' } }
        }
      })
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'CREATE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        details: { name: product.name, slug: product.slug, family: product.family, status: product.status }
      }
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
    const {
      name, brand, description, categoryId, status, variants,
      collection, type, scentFamily,
      topNotes, heartNotes, baseNotes, cardBadge,
      existingImages,
      internalName, family, brandId, tags, launchDate, retirementDate,
      shortDescription, marketingDescription, ingredients,
      usageInstructions, safetyWarnings, careInstructions,
      metaTitle, metaDescription, slug: requestedSlug, attributes
    } = req.body

    const previous = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!previous) return res.status(404).json({ error: 'Product not found' })

    // Auto-population Logic (Backend Enforcement)
    let oilConcentration = "Varies";
    let longevity = "N/A";
    if (type === "Extrait de Parfum" || type === "Parfum") {
      oilConcentration = "±20–40%"; longevity = "±10–24 hours";
    } else if (type === "Eau de Parfum") {
      oilConcentration = "±15–20%"; longevity = "±6–10 hours";
    } else if (type === "Eau de Toilette") {
      oilConcentration = "±5–15%"; longevity = "±3–6 hours";
    } else if (type === "Eau de Cologne" || type === "Eau Fraîche") {
      oilConcentration = type === "Eau de Cologne" ? "±2–4%" : "±1–3%";
      longevity = "±1–2 hours";
    } else if (type === "Eau de Senteur") {
      longevity = "Short, depends on solvents";
    } else if (type === "Splash & Aftershave") {
      longevity = "±1–3 hours";
    }

    const characteristicMap = {
      "Floral": "Sweet, Soft, Feminine",
      "Citrus": "Fresh, Bright, Uplifting",
      "Fruity": "Sweet, Juicy, Fun",
      "Woody": "Warm, Masculine, Deep",
      "Oriental": "Warm, Exotic, Sensual",
      "Aquatic": "Clean, Fresh, Airy; not too sweet or heavy",
      "Herbal": "Fresh, Herbal, Clean"
    };
    const characteristic = characteristicMap[scentFamily] || "N/A";
    
    // Manage image orchestration
    let currentImages = []
    try { currentImages = JSON.parse(existingImages || '[]') } catch (e) { currentImages = [] }
    
    const files = req.files || []
    const newFiles = files.map(f => f.filename)
    const allImages = [...currentImages, ...newFiles]
    const primaryImage = allImages.length > 0 ? allImages[0] : null

    // Slugs are stable once set — only touched when the admin explicitly
    // edits it via an SEO field, never silently regenerated from a rename
    // (that would break any link already shared to the old slug).
    let resolvedSlug = undefined
    if (requestedSlug !== undefined && requestedSlug !== previous.slug) {
      resolvedSlug = requestedSlug ? await generateUniqueProductSlug(requestedSlug, previous.id) : null
    }
    const parsedTags = tags !== undefined ? (() => { try { return JSON.parse(tags) } catch { return [] } })() : undefined

    const product = await prisma.$transaction(async (tx) => {
      // Defensive UUID handling
      const safeCategoryId = (categoryId && categoryId !== "" && categoryId !== "undefined") ? categoryId : null;
      const safeSupplierId = (req.body.supplierId && req.body.supplierId !== "" && req.body.supplierId !== "undefined") ? req.body.supplierId : null;
      const safeBrandId = (brandId && brandId !== "" && brandId !== "undefined") ? brandId : null;

      console.log('[PATCH] Transaction Logic:', { safeCategoryId, safeSupplierId });

      // 1. Update Product details
      const p = await tx.product.update({
        where: { id: req.params.id },
        data: {
          name,
          brand,
          description,
          // Only touch these relations when the field was actually part of the
          // request — omitting a field must never silently disconnect it
          // (a partial PATCH previously stripped category/supplier entirely).
          category: categoryId !== undefined ? (safeCategoryId ? { connect: { id: safeCategoryId } } : { disconnect: true }) : undefined,
          supplier: req.body.supplierId !== undefined ? (safeSupplierId ? { connect: { id: safeSupplierId } } : { disconnect: true }) : undefined,
          status: PRODUCT_STATUSES.includes(status) ? status : undefined,
          images: JSON.stringify(allImages),
          primaryImage,
          cardBadge,
          collection,
          type,
          oilConcentration,
          longevity,
          scentFamily,
          characteristic,
          topNotes,
          heartNotes,
          baseNotes,
          slug: resolvedSlug,
          internalName: internalName !== undefined ? (internalName || null) : undefined,
          brandRef: brandId !== undefined ? (safeBrandId ? { connect: { id: safeBrandId } } : { disconnect: true }) : undefined,
          family: PRODUCT_FAMILIES.includes(family) ? family : undefined,
          tags: parsedTags,
          launchDate: launchDate !== undefined ? (launchDate ? new Date(launchDate) : null) : undefined,
          retirementDate: retirementDate !== undefined ? (retirementDate ? new Date(retirementDate) : null) : undefined,
          shortDescription: shortDescription !== undefined ? (shortDescription || null) : undefined,
          marketingDescription: marketingDescription !== undefined ? (marketingDescription || null) : undefined,
          ingredients: ingredients !== undefined ? (ingredients || null) : undefined,
          usageInstructions: usageInstructions !== undefined ? (usageInstructions || null) : undefined,
          safetyWarnings: safetyWarnings !== undefined ? (safetyWarnings || null) : undefined,
          careInstructions: careInstructions !== undefined ? (careInstructions || null) : undefined,
          metaTitle: metaTitle !== undefined ? (metaTitle || null) : undefined,
          metaDescription: metaDescription !== undefined ? (metaDescription || null) : undefined
        }
      })

      // 2. Manage Variants (if provided)
      if (variants) {
        const parsedVariants = JSON.parse(variants)
        for (const v of parsedVariants) {
          let volume = v.volume !== undefined ? parseInt(v.volume) : undefined;
          if (v.size === "Full Size") volume = 100;
          else if (v.size === "Travel Size") volume = 50;

          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                size: v.size,
                price: parseFloat(v.price) || 0,
                costPrice: (v.costPrice && v.costPrice !== "") ? parseFloat(v.costPrice) : 0,
                packagingCost: (v.packagingCost && v.packagingCost !== "") ? parseFloat(v.packagingCost) : 0,
                labellingCost: (v.labellingCost && v.labellingCost !== "") ? parseFloat(v.labellingCost) : 0,
                barcode: v.barcode || undefined,
                uom: v.uom,
                volume,
                weightGrams: v.weightGrams !== undefined && v.weightGrams !== '' ? parseInt(v.weightGrams) : undefined
              }
            })

            // Stock quantity is never overwritten directly — a delta is
            // computed and routed through adjustStock so it's always ledgered.
            if (v.quantity !== undefined) {
              const currentInventory = await tx.inventory.findUnique({ where: { variantId: v.id } })
              const nextQuantity = parseInt(v.quantity)
              const delta = nextQuantity - (currentInventory?.quantity || 0)
              if (currentInventory && delta !== 0) {
                await adjustStock(tx, {
                  variantId: v.id,
                  delta,
                  changeType: 'CORRECTION',
                  reason: 'Manual correction via product edit',
                  referenceId: p.id
                })
              }
            }
            if (v.lowStockThreshold !== undefined) {
              await tx.inventory.updateMany({
                where: { variantId: v.id },
                data: { lowStockThreshold: parseInt(v.lowStockThreshold) }
              })
            }
          } else {
            const nv = await tx.productVariant.create({
              data: {
                productId: p.id,
                size: v.size,
                price: parseFloat(v.price) || 0,
                costPrice: (v.costPrice && v.costPrice !== "") ? parseFloat(v.costPrice) : 0,
                packagingCost: (v.packagingCost && v.packagingCost !== "") ? parseFloat(v.packagingCost) : 0,
                labellingCost: (v.labellingCost && v.labellingCost !== "") ? parseFloat(v.labellingCost) : 0,
                sku: v.sku || `SKU-${Date.now()}`,
                barcode: v.barcode || null,
                uom: v.uom || 'ml',
                volume: parseInt(v.volume || 0),
                weightGrams: v.weightGrams !== undefined && v.weightGrams !== '' ? parseInt(v.weightGrams) : undefined
              }
            })
            const startingQuantity = parseInt(v.quantity || 0)
            await tx.inventory.create({
              data: {
                variantId: nv.id,
                quantity: startingQuantity,
                lowStockThreshold: parseInt(v.lowStockThreshold || 5)
              }
            })
            if (startingQuantity > 0) {
              await tx.inventoryLog.create({
                data: {
                  variantId: nv.id,
                  changeType: 'INITIAL_STOCK',
                  quantityChanged: startingQuantity,
                  reason: 'Opening stock for new variation',
                  referenceId: p.id
                }
              })
            }
          }
        }
      }

      // 3. Sync attribute values (full replace — the family-aware form always
      // submits the complete current attribute set).
      if (attributes !== undefined) {
        const parsedAttributes = (() => { try { return JSON.parse(attributes) } catch { return {} } })()
        await tx.productAttributeValue.deleteMany({ where: { productId: req.params.id } })
        for (const [definitionId, value] of Object.entries(parsedAttributes)) {
          if (value === '' || value === null || value === undefined) continue
          await tx.productAttributeValue.create({
            data: { productId: req.params.id, definitionId, value: String(value) }
          })
        }
      }

      await syncProductMedia(tx, req.params.id, allImages)

      return tx.product.findUnique({
        where: { id: req.params.id },
        include: {
          variants: { include: { inventory: true } },
          attributeValues: { include: { definition: true } },
          media: { include: { media: true }, orderBy: { sortOrder: 'asc' } }
        }
      })
    })

    const TRACKED_FIELDS = ['name', 'brand', 'status', 'family', 'slug', 'categoryId', 'supplierId', 'brandId']
    const changes = {}
    for (const field of TRACKED_FIELDS) {
      if (previous[field] !== product[field]) {
        changes[field] = { from: previous[field], to: product[field] }
      }
    }
    if (Object.keys(changes).length > 0) {
      await prisma.auditLog.create({
        data: {
          adminUserId: req.adminId,
          action: 'UPDATE_PRODUCT',
          entity: 'Product',
          entityId: product.id,
          details: { changes }
        }
      })
    }

    res.json(product)
  } catch (err) {
    console.error('[PATCH /api/products/:id] Error:', err);
    next(err);
  }
})


// DELETE /api/products/:id (soft delete)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED' }
    })
    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'ARCHIVE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        details: { name: product.name }
      }
    })
    res.status(204).end()
  } catch (err) { next(err) }
})

export default router
