// Multi-category seed + backfill.
//
// 1. Seeds three product CATEGORIES (Perfumes / Scented Candles /
//    Scented Bath Salts). Bath salts seeds inactive-but-present as a
//    coming-soon placeholder — storefront shows the tile with a badge.
// 2. Seeds four COLLECTIONS (Premium / Signature / Classic / Essentials)
//    corresponding to the perfume ranges currently tracked as free-text
//    Product.collection values.
// 3. Backfills product_collections from Product.collection strings so the
//    new join table reflects the existing merchandising.
// 4. Reassigns every existing Product (currently PERFUME family) to the
//    new Perfumes category. Legacy category rows ("Signature Collection"
//    etc.) are left in place but deactivated — anything still linking to
//    them by slug keeps working, nothing new picks them up.
// 5. Seeds CANDLE and BATH_SALT attribute definitions so the family-aware
//    admin UI can render category-specific product forms.
//
// Idempotent: every step is upsert/skip-if-done. Safe to re-run.
//
// Usage: node scripts/seed_multicategory.js

import prisma from '../src/lib/prisma.js'

// ── Categories: the three TOCA product lines ──────────────────────────────
const CATEGORIES = [
  {
    slug: 'perfume',
    name: 'Perfumes',
    description:
      'Extrait de parfum — the highest concentration in perfumery. Crafted with rare ingredients for depth, projection and all-day longevity.',
    displayOrder: 1,
    isActive: true,
  },
  {
    slug: 'candles',
    name: 'Scented Candles',
    description:
      'Soy-wax candles infused with premium parfum oils. Sculpted to captivate, designed to be admired.',
    displayOrder: 2,
    isActive: true,
  },
  {
    slug: 'bath-salts',
    name: 'Scented Bath Salts',
    description: 'Hand-crafted bath rituals, scented with signature TOCA fragrances. Coming soon.',
    displayOrder: 3,
    // Placeholder category — kept inactive until the catalogue arrives, so
    // the shop filter doesn't show an empty category page. Storefront tile
    // reads the isActive flag to render a Coming Soon badge.
    isActive: false,
  },
]

// ── Collections: the perfume merchandising ranges ─────────────────────────
const COLLECTIONS = [
  {
    slug: 'premium',
    name: 'Premium',
    description: 'Our most exclusive and distinguished creations.',
    displayOrder: 1,
  },
  {
    slug: 'signature',
    name: 'Signature',
    description: 'Distinctive fragrances of remarkable character.',
    displayOrder: 2,
  },
  {
    slug: 'classic',
    name: 'Classic',
    description: 'Timeless elegance for every occasion.',
    displayOrder: 3,
  },
  {
    slug: 'essentials',
    name: 'Essentials',
    description: 'Accessible luxury, uncompromising quality.',
    displayOrder: 4,
  },
]

// ── Attribute definitions per family ───────────────────────────────────────
// Only family-specific attributes that aren't already first-class columns
// on Product/ProductVariant (name, description, price, size, etc. live on
// the main tables; these capture what *varies by family*).
const CANDLE_ATTRIBUTES = [
  { key: 'wax_type', label: 'Wax Type', dataType: 'ENUM', options: ['Soy', 'Beeswax', 'Coconut', 'Paraffin', 'Blend'], isFilterable: true, displayOrder: 1 },
  { key: 'vessel_type', label: 'Vessel', dataType: 'ENUM', options: ['Glass Jar', 'Tumbler', 'Tin', 'Ceramic', 'Bouquet Arrangement'], isFilterable: true, displayOrder: 2 },
  { key: 'burn_time_hours', label: 'Burn Time', dataType: 'NUMBER', unit: 'hours', displayOrder: 3 },
  { key: 'wick_type', label: 'Wick Type', dataType: 'ENUM', options: ['Cotton', 'Wood', 'Multi-wick'], displayOrder: 4 },
  { key: 'candle_count', label: 'Candles in Arrangement', dataType: 'TEXT', displayOrder: 5 },
  { key: 'fragrance_profile', label: 'Fragrance Profile', dataType: 'TEXT', isFilterable: true, displayOrder: 6 },
]

const BATH_SALT_ATTRIBUTES = [
  { key: 'salt_weight_grams', label: 'Weight', dataType: 'NUMBER', unit: 'g', appliesToVariant: true, displayOrder: 1 },
  { key: 'scent_profile', label: 'Scent Profile', dataType: 'TEXT', isFilterable: true, displayOrder: 2 },
  { key: 'key_ingredients', label: 'Key Ingredients', dataType: 'TEXT', displayOrder: 3 },
  { key: 'usage_instructions', label: 'Usage', dataType: 'TEXT', displayOrder: 4 },
  { key: 'packaging_type', label: 'Packaging', dataType: 'ENUM', options: ['Jar', 'Pouch', 'Box', 'Refill'], displayOrder: 5 },
]

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function seedCategories() {
  const created = []
  for (const cat of CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { slug: cat.slug } })
    if (existing) {
      // Leave isActive alone if an admin has already toggled it — only
      // refresh the human-facing name/description fields.
      await prisma.category.update({
        where: { id: existing.id },
        data: { name: cat.name, description: cat.description, displayOrder: cat.displayOrder },
      })
      created.push({ ...existing, name: cat.name })
    } else {
      const row = await prisma.category.create({ data: cat })
      created.push(row)
    }
  }
  console.log(`[categories] ${created.length} present (perfume/candles/bath-salts).`)
  return Object.fromEntries(created.map((c) => [c.slug, c.id]))
}

async function seedCollections() {
  const created = []
  for (const col of COLLECTIONS) {
    const existing = await prisma.collection.findUnique({ where: { slug: col.slug } })
    if (existing) {
      await prisma.collection.update({
        where: { id: existing.id },
        data: { name: col.name, description: col.description, displayOrder: col.displayOrder },
      })
      created.push(existing)
    } else {
      const row = await prisma.collection.create({ data: col })
      created.push(row)
    }
  }
  console.log(`[collections] ${created.length} present (premium/signature/classic/essentials).`)
  return Object.fromEntries(created.map((c) => [c.slug, c.id]))
}

async function backfillProductCollections(collectionIdBySlug) {
  // Every product that has a non-null Product.collection string gets a
  // matching ProductCollection row (idempotent via the composite PK).
  const products = await prisma.product.findMany({
    where: { collection: { not: null } },
    select: { id: true, collection: true },
  })
  let linked = 0
  for (const p of products) {
    const slug = slugify(p.collection)
    const collectionId = collectionIdBySlug[slug]
    if (!collectionId) continue
    const existing = await prisma.productCollection.findUnique({
      where: { productId_collectionId: { productId: p.id, collectionId } },
    })
    if (existing) continue
    await prisma.productCollection.create({ data: { productId: p.id, collectionId } })
    linked++
  }
  console.log(`[product_collections] linked ${linked} new product→collection relation(s).`)
}

async function reassignPerfumeProductsToPerfumeCategory(perfumeCategoryId) {
  // Every PERFUME-family product currently pointed at a legacy category
  // (or at nothing) gets moved to the new Perfumes category.
  const result = await prisma.product.updateMany({
    where: { family: 'PERFUME', NOT: { categoryId: perfumeCategoryId } },
    data: { categoryId: perfumeCategoryId },
  })
  console.log(`[category_reassign] ${result.count} perfume product(s) moved to Perfumes category.`)
}

async function deactivateLegacyCategories(keepSlugs) {
  // Legacy Signature/Premium/Essentials categories stay in the table for
  // referential integrity on old ?cat= URLs, but are hidden from the
  // dynamic storefront nav by flipping isActive.
  const result = await prisma.category.updateMany({
    where: { slug: { notIn: keepSlugs }, isActive: true },
    data: { isActive: false },
  })
  if (result.count > 0) {
    console.log(`[legacy_categories] deactivated ${result.count} legacy category row(s).`)
  }
}

async function seedAttributeDefinitions(family, defs) {
  let created = 0
  for (const def of defs) {
    const existing = await prisma.attributeDefinition.findUnique({ where: { key: def.key } })
    const payload = {
      key: def.key,
      label: def.label,
      family,
      dataType: def.dataType,
      unit: def.unit ?? null,
      options: def.options ? def.options : null,
      appliesToVariant: !!def.appliesToVariant,
      isFilterable: !!def.isFilterable,
      displayOrder: def.displayOrder ?? 0,
    }
    if (existing) {
      await prisma.attributeDefinition.update({ where: { id: existing.id }, data: payload })
    } else {
      await prisma.attributeDefinition.create({ data: payload })
      created++
    }
  }
  console.log(`[attributes:${family}] seeded ${defs.length} definition(s) (${created} new).`)
}

async function main() {
  console.log('🌿 TOCA multi-category seed starting…')

  const categoryIds = await seedCategories()
  const collectionIds = await seedCollections()
  await backfillProductCollections(collectionIds)
  await reassignPerfumeProductsToPerfumeCategory(categoryIds.perfume)
  await deactivateLegacyCategories(Object.keys(categoryIds))
  await seedAttributeDefinitions('CANDLE', CANDLE_ATTRIBUTES)
  await seedAttributeDefinitions('BATH_SALT', BATH_SALT_ATTRIBUTES)

  console.log('✅ Multi-category seed complete.')
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
