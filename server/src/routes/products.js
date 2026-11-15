import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requirePerm } from '../middleware/auth.js'
import { convertPrice } from '../lib/currencyService.js'
import { adjustStock } from '../lib/inventoryService.js'
import { generateUniqueProductSlug } from '../lib/slug.js'
import { syncProductMedia } from '../lib/mediaService.js'
import { storedUploadName } from '../lib/uploadNames.js'

const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED']

// Storefront price filter buckets (ZAR). Upper bounds are exclusive so a
// R999 product never lands in two adjacent buckets.
const PRICE_BUCKETS = [
  { id: '0-500', min: 0, max: 500 },
  { id: '500-1000', min: 500, max: 1000 },
  { id: '1000-2000', min: 1000, max: 2000 },
  { id: '2000-', min: 2000, max: null },
]
const inBucket = (price, b) => price >= b.min && (b.max == null || price < b.max)
const listParam = (raw) => String(raw || '').split(',').map((v) => v.trim()).filter((v) => v && v !== 'all')

// Storefront search: every word must match somewhere (name, copy, scent
// family, notes, type, tags, collection or category), so "rose oud" and
// "oud rose" both find Sublime Rose Oud.
function buildSearchWhere(raw) {
  const words = String(raw || '').trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 5)
  if (!words.length) return null
  return words.map((word) => {
    const c = { contains: word, mode: 'insensitive' }
    return {
      OR: [
        { name: c }, { description: c }, { shortDescription: c }, { brand: c }, { type: c },
        { scentFamily: c }, { topNotes: c }, { heartNotes: c }, { baseNotes: c },
        { tags: { has: word.toLowerCase() } },
        { attributeValues: { some: { value: c } } },
        { collections: { some: { collection: { name: c } } } },
        { category: { name: c } },
      ],
    }
  })
}
const PRODUCT_FAMILIES = ['PERFUME', 'CANDLE', 'HOME_FRAGRANCE', 'ACCESSORY', 'GIFT_SET', 'BATH_SALT']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../images/products')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, storedUploadName(file.originalname))
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
      collection,
      family,
      scentFamily,
      search,
      sort,
      status,
      minPrice,
      maxPrice,
      priceRanges,
      tags,
      currency = 'ZAR',
      page = 1,
      limit = 10
    } = req.query

    const pageNum = Math.max(parseInt(page) || 1, 1)
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 200)
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

    // Collection filter — many-to-many via ProductCollection. Accepts one
    // slug/UUID or a comma-separated list (any match).
    const collectionList = listParam(collection)
    if (collectionList.length) {
      where.collections = {
        some: {
          collection: {
            OR: collectionList.map((c) => (c.length > 20 ? { id: c } : { slug: { equals: c, mode: 'insensitive' } })),
          },
        },
      }
    }

    // Family filter — perfume / candle / bath_salt / etc. Applied as a
    // direct enum match. Kept separate from category so a candles-only
    // feed can still cut across multiple candle sub-categories later.
    if (family && family !== 'all') {
      const upperFamily = family.toUpperCase()
      if (PRODUCT_FAMILIES.includes(upperFamily)) {
        where.family = upperFamily
      }
    }

    // Scent family — stored as free text on Product.scentFamily (e.g.
    // "Floral · Oriental"). Contains-match so a filter for "Floral" matches
    // products with "Floral · Oriental" too; two-faceted scents are the
    // norm in this catalogue so an exact match would under-return.
    const scentList = listParam(scentFamily)
    if (scentList.length) {
      where.AND = [...(where.AND || []), { OR: scentList.map((s) => ({ scentFamily: { contains: s, mode: 'insensitive' } })) }]
    }

    // Generic attribute filters — any query param prefixed `attr_` is
    // resolved against ProductAttributeValue for that definition's key.
    // Multiple attributes AND together (a product must satisfy every
    // selected facet); multiple values for the same key is treated as OR
    // via a comma-separated value list, same convention as `tags`.
    const attrFilters = []
    for (const [param, raw] of Object.entries(req.query)) {
      if (!param.startsWith('attr_')) continue
      if (!raw || raw === 'all') continue
      const key = param.slice(5)
      const values = String(raw).split(',').map((v) => v.trim()).filter(Boolean)
      if (values.length === 0) continue
      attrFilters.push({
        attributeValues: {
          some: {
            definition: { key },
            value: values.length === 1 ? values[0] : { in: values },
          },
        },
      })
    }
    if (attrFilters.length > 0) {
      where.AND = [...(where.AND || []), ...attrFilters]
    }

    const searchFilter = buildSearchWhere(search)
    if (searchFilter) where.AND = [...(where.AND || []), ...searchFilter]

    if (tags) {
      // tags is now a String[] column (PIM) — hasEvery matches the original
      // "must have all of these tags" intent, not the old string `contains`.
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
      where.tags = { hasEvery: tagList }
    }

    // Price buckets ("0-500,2000-"): a product matches if any size falls in
    // any selected bucket. Takes precedence over minPrice/maxPrice.
    const buckets = listParam(priceRanges).map((id) => PRICE_BUCKETS.find((b) => b.id === id)).filter(Boolean)
    if (buckets.length) {
      where.variants = {
        some: { OR: buckets.map((b) => ({ price: { gte: b.min, ...(b.max != null ? { lt: b.max } : {}) } })) },
      }
    } else if (minPrice || maxPrice) {
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
    if (sort === 'name-asc' || sort === 'name') orderBy = { name: 'asc' }
    if (sort === 'name-desc') orderBy = { name: 'desc' }

    // Price sort is a two-stage query: we need each product's cheapest
    // variant price as the sort key, and Prisma findMany doesn't order on
    // related aggregates directly. Resolve the id order first via a raw-ish
    // groupBy, then hydrate with the usual include. Still only two DB round
    // trips, same shape of response as the default order path.
    const isPriceSort = sort === 'price-low' || sort === 'price-high'
    let orderedIds = null
    if (isPriceSort) {
      const matchingProducts = await prisma.product.findMany({
        where,
        select: { id: true, variants: { select: { price: true } } },
      })
      const withMinPrice = matchingProducts
        .map((p) => {
          const prices = p.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n))
          return { id: p.id, minPrice: prices.length ? Math.min(...prices) : null }
        })
        .filter((p) => p.minPrice !== null)
      withMinPrice.sort((a, b) => sort === 'price-low' ? a.minPrice - b.minPrice : b.minPrice - a.minPrice)
      orderedIds = withMinPrice.slice(skip, skip + limitNum).map((p) => p.id)
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: orderedIds ? { id: { in: orderedIds } } : where,
        include: {
          category: true,
          supplier: true,
          brandRef: true,
          variants: { include: { inventory: true } },
          attributeValues: { include: { definition: true } },
          media: { include: { media: true }, orderBy: { sortOrder: 'asc' } }
        },
        orderBy: orderedIds ? undefined : orderBy,
        skip: orderedIds ? 0 : skip,
        take: orderedIds ? undefined : limitNum
      }),
      prisma.product.count({ where })
    ])

    // Prisma doesn't preserve the id-list order on `in` queries, so we
    // reorder the hydrated rows to match the price-sorted id sequence.
    if (orderedIds) {
      const byId = Object.fromEntries(products.map((p) => [p.id, p]))
      const reordered = orderedIds.map((id) => byId[id]).filter(Boolean)
      products.length = 0
      products.push(...reordered)
    }

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


// GET /api/products/facets?category=slug
//
// Returns the filter facets that make sense for a given category context —
// which collections it uses, which scent families, which tiers, and the
// min/max price range of what's currently in stock. Storefront consumes
// this to render family-appropriate filter rows without the frontend
// needing to know perfume-vs-candle-vs-bath-salt specifics.
//
// A tiny materialised view would be faster long-term; for a catalogue
// this size (tens of products, not thousands) a per-request aggregate is
// perfectly fine and always returns live data.
router.get('/facets', async (req, res, next) => {
  try {
    const { category, search } = req.query

    const where = { status: 'ACTIVE' }
    if (category && category !== 'all') {
      if (category.length > 20) {
        where.categoryId = category
      } else {
        where.category = { slug: { equals: category, mode: 'insensitive' } }
      }
    }
    const searchFilter = buildSearchWhere(search)
    if (searchFilter) where.AND = searchFilter

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        family: true,
        scentFamily: true,
        collections: { select: { collection: { select: { slug: true, name: true } } } },
        variants: { select: { price: true } },
        // Pull every ProductAttributeValue a product carries, along with its
        // definition — we group by definition below to produce the generic
        // attribute facet rows (wax type, vessel, burn time, etc.).
        attributeValues: {
          select: {
            value: true,
            definition: {
              select: { key: true, label: true, family: true, dataType: true, isFilterable: true, displayOrder: true, unit: true },
            },
          },
        },
      },
    })

    // Collections: unique by slug, preserving the first name we saw. The
    // order doesn't need to match displayOrder here — the storefront fetches
    // the full collection list separately anyway, this payload just lists
    // the ones the current category actually populates.
    const collectionsBySlug = new Map()
    for (const p of products) {
      for (const link of p.collections) {
        if (!collectionsBySlug.has(link.collection.slug)) {
          collectionsBySlug.set(link.collection.slug, link.collection.name)
        }
      }
    }

    // Scent families appear as compound values ("Floral · Oriental"); split
    // on the middle-dot so the facet UI shows each atomic family as its
    // own filter chip.
    const scentFamilySet = new Set()
    for (const p of products) {
      if (!p.scentFamily) continue
      p.scentFamily
        .split(/[·,/]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => scentFamilySet.add(s))
    }

    // Price range: min of the cheapest variant, max of the most expensive.
    let min = Infinity
    let max = 0
    for (const p of products) {
      for (const v of p.variants) {
        const price = Number(v.price)
        if (!Number.isFinite(price)) continue
        if (price < min) min = price
        if (price > max) max = price
      }
    }
    if (min === Infinity) min = 0

    const priceBuckets = PRICE_BUCKETS
      .map((b) => ({ id: b.id, min: b.min, max: b.max, count: products.filter((p) => p.variants.some((v) => inBucket(Number(v.price), b))).length }))
      .filter((b) => b.count > 0)

    // What families are represented — lets the storefront decide whether to
    // show scent-family chips at all (perfumes only, really).
    const families = [...new Set(products.map((p) => p.family).filter(Boolean))]

    // Generic attribute facets. One row per filterable AttributeDefinition
    // that at least one product in this category actually has a value for.
    // Skipping defs with no values keeps the UI clean — a "Wax Type" row
    // with nothing to pick is just noise under the Perfumes category.
    const attrByKey = new Map()
    for (const p of products) {
      for (const av of p.attributeValues) {
        const def = av.definition
        if (!def?.isFilterable) continue
        if (!attrByKey.has(def.key)) {
          attrByKey.set(def.key, {
            key: def.key,
            label: def.label,
            family: def.family,
            dataType: def.dataType,
            unit: def.unit || null,
            displayOrder: def.displayOrder || 0,
            values: new Set(),
          })
        }
        if (av.value) attrByKey.get(def.key).values.add(av.value)
      }
    }
    const attributes = [...attrByKey.values()]
      .filter((a) => a.values.size > 0)
      .map((a) => ({ ...a, values: [...a.values].sort() }))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))

    res.json({
      category: category || null,
      productCount: products.length,
      families,
      collections: [...collectionsBySlug.entries()].map(([slug, name]) => ({ slug, name })),
      scentFamilies: [...scentFamilySet].sort(),
      attributes,
      priceRange: { min, max },
      priceBuckets,
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
router.get('/low-stock', requirePerm('products', 'read'), async (req, res, next) => {
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
router.post('/', requirePerm('products', 'write'), upload.array('images', 10), async (req, res, next) => {
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
          brand: brand || "TOCA",
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
router.patch('/:id', requirePerm('products', 'write'), upload.array('images', 10), async (req, res, next) => {
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
router.delete('/:id', requirePerm('products', 'delete'), async (req, res, next) => {
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
