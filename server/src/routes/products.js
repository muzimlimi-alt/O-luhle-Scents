import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requirePerm, getAdminFromRequest } from '../middleware/auth.js'
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

// Orders that count as a sale — same rule as REVENUE_STATUSES in lib/financeService.js.
const SALES_STATUSES = ['paid', 'shipped', 'delivered']
const RANKED_SORTS = ['price-low', 'price-high', 'bestselling', 'newest', 'favourites']
const PAIRING_LIMIT = 4

async function unitsSoldByProduct(productIds) {
  const rows = await prisma.orderItem.findMany({
    where: { order: { status: { in: SALES_STATUSES } }, variant: { productId: { in: productIds } } },
    select: { quantity: true, variant: { select: { productId: true } } },
  })
  const sold = new Map()
  for (const r of rows) {
    const id = r.variant?.productId
    if (id) sold.set(id, (sold.get(id) || 0) + r.quantity)
  }
  return sold
}

// Cost and supplier data are internal; strip them from anything a visitor sees.
function publicProduct(p) {
  const { supplier, supplierId, internalName, alternativeSuppliers, ...rest } = p
  return {
    ...rest,
    variants: (p.variants || []).map(({ costPrice, packagingCost, labellingCost, ...v }) => v),
  }
}

async function withCurrency(p, currency) {
  const variants = await Promise.all((p.variants || []).map(async (v) => ({
    ...v,
    originalPrice: v.price,
    price: await convertPrice(v.price, currency),
    currency,
  })))
  return { ...p, variants }
}

// Concentration/longevity follow the product type; only recomputed when the
// type actually changes, so catalogue data isn't overwritten on every save.
const TYPE_PROFILES = {
  'Extrait de Parfum': { oilConcentration: '20–40%', longevity: '10–24 hours' },
  'Parfum': { oilConcentration: '20–40%', longevity: '10–24 hours' },
  'Eau de Parfum': { oilConcentration: '15–20%', longevity: '6–10 hours' },
  'Eau de Toilette': { oilConcentration: '5–15%', longevity: '3–6 hours' },
  'Eau de Cologne': { oilConcentration: '2–4%', longevity: '1–2 hours' },
  'Eau Fraîche': { oilConcentration: '1–3%', longevity: '1–2 hours' },
  'Eau de Senteur': { oilConcentration: null, longevity: 'Short, depends on solvents' },
  'Splash & Aftershave': { oilConcentration: null, longevity: '1–3 hours' },
}
const SCENT_CHARACTERISTICS = {
  Floral: 'Sweet, Soft, Feminine',
  Citrus: 'Fresh, Bright, Uplifting',
  Fresh: 'Fresh, Bright, Uplifting',
  Fruity: 'Sweet, Juicy, Fun',
  Woody: 'Warm, Masculine, Deep',
  Oriental: 'Warm, Exotic, Sensual',
  Aquatic: 'Clean, Fresh, Airy',
  Herbal: 'Fresh, Herbal, Clean',
  Chypre: 'Complex, Structured, Timeless',
}
const typeProfile = (type) => TYPE_PROFILES[type] || { oilConcentration: null, longevity: null }
const blankToNull = (v) => (v === undefined ? undefined : (String(v).trim() || null))
// Note lists arrive as JSON arrays; an empty list is stored as null so the
// storefront doesn't render an empty scent pyramid.
function normaliseNotes(v) {
  if (v === undefined) return undefined
  if (!v) return null
  try {
    const parsed = JSON.parse(v)
    if (Array.isArray(parsed)) return parsed.length ? JSON.stringify(parsed) : null
  } catch {}
  return String(v).trim() || null
}
const parseBool = (v) => (v === undefined ? undefined : v === true || v === 'true')
const parseOrder = (v) => (v === undefined || v === '' ? undefined : (parseInt(v, 10) || 0))
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
      featured,
      tags,
      currency = 'ZAR',
      page = 1,
      limit = 10
    } = req.query

    const pageNum = Math.max(parseInt(page) || 1, 1)
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 200)
    const skip = (pageNum - 1) * limitNum

    // Signed-in admins see every status by default; everyone else only sees active.
    const isAdmin = !!(await getAdminFromRequest(req))
    const where = isAdmin ? {} : { status: 'ACTIVE' }
    if (featured === 'true') where.isFeatured = true

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

    // Price, sales and merchandising sorts depend on related data Prisma can't
    // order by directly: rank the matching ids first, then hydrate that page.
    let orderedIds = null
    if (RANKED_SORTS.includes(sort)) {
      const matching = await prisma.product.findMany({
        where,
        select: { id: true, createdAt: true, launchDate: true, isFeatured: true, featuredOrder: true, variants: { select: { price: true } } },
      })
      const sold = sort === 'bestselling' || sort === 'favourites' ? await unitsSoldByProduct(matching.map((p) => p.id)) : new Map()
      const ranked = matching.map((p) => {
        const prices = p.variants.map((v) => Number(v.price)).filter(Number.isFinite)
        return {
          id: p.id,
          minPrice: prices.length ? Math.min(...prices) : null,
          newness: (p.launchDate || p.createdAt).getTime(),
          sold: sold.get(p.id) || 0,
          featured: p.isFeatured,
          featuredOrder: p.featuredOrder,
        }
      })
      const byNewest = (a, b) => b.newness - a.newness
      const bySales = (a, b) => b.sold - a.sold || byNewest(a, b)
      const comparators = {
        'price-low': (a, b) => a.minPrice - b.minPrice,
        'price-high': (a, b) => b.minPrice - a.minPrice,
        newest: byNewest,
        bestselling: bySales,
        // Hand-picked favourites first (in their set order), then best sellers.
        favourites: (a, b) => (b.featured - a.featured) || (a.featured && b.featured ? a.featuredOrder - b.featuredOrder : 0) || bySales(a, b),
      }
      const list = sort.startsWith('price') ? ranked.filter((p) => p.minPrice !== null) : ranked
      list.sort(comparators[sort])
      orderedIds = list.slice(skip, skip + limitNum).map((p) => p.id)
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: orderedIds ? { id: { in: orderedIds } } : where,
        include: {
          category: true,
          supplier: isAdmin,
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

    const formattedProducts = await Promise.all(products.map(async (p) => {
      const converted = await withCurrency(p, currency)
      return isAdmin ? converted : publicProduct(converted)
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

    const isAdmin = !!(await getAdminFromRequest(req))
    if (!product || (product.status !== 'ACTIVE' && !isAdmin)) {
      return res.status(404).json({ error: 'Scent not found' })
    }

    const converted = await withCurrency(product, currency)

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
        ...publicProduct(r),
        price: await convertPrice(minPrice, currency),
        currency
      }
    }))

    res.json({
      ...(isAdmin ? converted : publicProduct(converted)),
      related: formattedRelated
    })
  } catch (err) { next(err) }
})

// GET /api/products/:id/pairings — "Complete the Scent Experience".
// Curated pairings first (shown in both directions), then other-category
// products that share this product's scent family. Real data only.
router.get('/:id/pairings', async (req, res, next) => {
  try {
    const { currency = 'ZAR' } = req.query
    const id = req.params.id
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, categoryId: true, scentFamily: true, status: true },
    })
    if (!product || product.status !== 'ACTIVE') return res.json({ products: [] })

    const include = { category: true, variants: { include: { inventory: true }, orderBy: { price: 'asc' } } }
    const links = await prisma.productPairing.findMany({
      where: { OR: [{ productId: id }, { pairedProductId: id }] },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    const curatedIds = [...new Set(links.map((l) => (l.productId === id ? l.pairedProductId : l.productId)))]
    const curatedRows = curatedIds.length
      ? await prisma.product.findMany({ where: { id: { in: curatedIds }, status: 'ACTIVE' }, include })
      : []
    const curatedById = new Map(curatedRows.map((p) => [p.id, p]))
    const curated = curatedIds.map((pid) => curatedById.get(pid)).filter(Boolean)

    let automatic = []
    if (product.scentFamily && curated.length < PAIRING_LIMIT) {
      const candidates = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          id: { notIn: [id, ...curatedIds] },
          ...(product.categoryId ? { categoryId: { not: product.categoryId } } : {}),
          scentFamily: { equals: product.scentFamily, mode: 'insensitive' },
        },
        include,
        orderBy: { createdAt: 'desc' },
      })
      // One per category first so the suggestions span product types.
      const seen = new Set()
      const firstPerCategory = []
      const rest = []
      for (const c of candidates) {
        if (seen.has(c.categoryId)) rest.push(c)
        else { seen.add(c.categoryId); firstPerCategory.push(c) }
      }
      automatic = [...firstPerCategory, ...rest]
    }

    const picked = [
      ...curated.map((p) => ({ p, reason: 'curated' })),
      ...automatic.map((p) => ({ p, reason: 'scentFamily' })),
    ].slice(0, PAIRING_LIMIT)

    const products = await Promise.all(picked.map(async ({ p, reason }) => ({
      ...publicProduct(await withCurrency(p, currency)),
      pairingReason: reason,
    })))
    res.json({ products })
  } catch (err) { next(err) }
})

// GET /api/products/:id/pairings/curated — admin: the hand-picked pairing ids.
router.get('/:id/pairings/curated', requirePerm('products', 'read'), async (req, res, next) => {
  try {
    const id = req.params.id
    const links = await prisma.productPairing.findMany({
      where: { OR: [{ productId: id }, { pairedProductId: id }] },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    res.json({ productIds: [...new Set(links.map((l) => (l.productId === id ? l.pairedProductId : l.productId)))] })
  } catch (err) { next(err) }
})

// PUT /api/products/:id/pairings — admin: replace this product's curated pairings.
router.put('/:id/pairings', requirePerm('products', 'write'), async (req, res, next) => {
  try {
    const id = req.params.id
    if (!Array.isArray(req.body.productIds)) {
      return res.status(400).json({ error: 'productIds must be an array' })
    }
    const productIds = [...new Set(req.body.productIds.map(String))].filter((pid) => pid !== id).slice(0, 12)
    const [self, found] = await Promise.all([
      prisma.product.findUnique({ where: { id }, select: { id: true } }),
      prisma.product.count({ where: { id: { in: productIds } } }),
    ])
    if (!self) return res.status(404).json({ error: 'Product not found' })
    if (found !== productIds.length) return res.status(400).json({ error: 'One or more paired products do not exist' })

    await prisma.$transaction(async (tx) => {
      await tx.productPairing.deleteMany({ where: { OR: [{ productId: id }, { pairedProductId: id }] } })
      if (productIds.length) {
        await tx.productPairing.createMany({
          data: productIds.map((pid, i) => ({ productId: id, pairedProductId: pid, sortOrder: i })),
        })
      }
      await tx.auditLog.create({
        data: { adminUserId: req.adminId, action: 'UPDATE_PRODUCT_PAIRINGS', entity: 'Product', entityId: id, details: { productIds } },
      })
    })
    res.json({ productIds })
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
      metaTitle, metaDescription, attributes, isFeatured, featuredOrder
    } = req.body

    const { oilConcentration, longevity } = typeProfile(type)
    const characteristic = SCENT_CHARACTERISTICS[scentFamily] || null

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
          type: blankToNull(type),
          oilConcentration,
          longevity,
          scentFamily: blankToNull(scentFamily),
          characteristic,
          topNotes: normaliseNotes(topNotes),
          heartNotes: normaliseNotes(heartNotes),
          baseNotes: normaliseNotes(baseNotes),
          isFeatured: parseBool(isFeatured) ?? false,
          featuredOrder: parseOrder(featuredOrder) ?? 0,
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
      metaTitle, metaDescription, slug: requestedSlug, attributes, isFeatured, featuredOrder
    } = req.body

    const previous = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!previous) return res.status(404).json({ error: 'Product not found' })

    // Derived fields only change when their source field changes — otherwise
    // every admin save would overwrite catalogue-sourced values.
    const nextType = blankToNull(type)
    const nextScentFamily = blankToNull(scentFamily)
    const typeChanged = nextType !== undefined && nextType !== previous.type
    const scentChanged = nextScentFamily !== undefined && nextScentFamily !== previous.scentFamily
    const { oilConcentration, longevity } = typeChanged ? typeProfile(nextType) : {}
    const characteristic = scentChanged ? (SCENT_CHARACTERISTICS[nextScentFamily] || null) : undefined

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
          type: nextType,
          oilConcentration,
          longevity,
          scentFamily: nextScentFamily,
          characteristic,
          topNotes: normaliseNotes(topNotes),
          heartNotes: normaliseNotes(heartNotes),
          baseNotes: normaliseNotes(baseNotes),
          isFeatured: parseBool(isFeatured),
          featuredOrder: parseOrder(featuredOrder),
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

    const TRACKED_FIELDS = ['name', 'brand', 'status', 'family', 'slug', 'categoryId', 'supplierId', 'brandId', 'isFeatured', 'featuredOrder']
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
