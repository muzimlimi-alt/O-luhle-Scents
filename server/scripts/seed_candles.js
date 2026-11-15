// Candle seed — walks the two TOCA candle catalogues (Flame & Bloom and
// Gourmet Candles) through the catalogue import pipeline:
//
//   CatalogueSource -> CatalogueImport -> ExtractedProduct (curated data)
//     -> approve -> importApprovedProduct() -> DRAFT Product + Variant.
//
// Products land as DRAFT so an admin still has to flip them to ACTIVE —
// same guarantee the normal review workflow gives.
//
// Idempotent: existing rows (matched by name+family dedupe) are skipped.
//
// Usage: node scripts/seed_candles.js

import prisma from '../src/lib/prisma.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { importApprovedProduct } from '../src/lib/catalogueExtractor.js'
import { generateUniqueCollectionSlug } from '../src/lib/slug.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

// Curated per-tier candle data. Parsed-by-hand from the two PDFs so the
// seed is deterministic regardless of pdftotext layout drift.
const FLAME_AND_BLOOM = {
  sourceName: 'Flame & Bloom — Desire First',
  sourceDescription:
    'TOCA bouquet-style candles infused with premium parfum oils. Sculptural arrangements designed to be admired.',
  pdfBasename: 'TOCA_Flame_and_Bloom_Desire_First_A5_v4.pdf',
  collection: {
    name: 'Flame & Bloom',
    description:
      'Bouquet-style candle arrangements — sculpted to captivate, infused with parfum oils, designed to be admired.',
    displayOrder: 10,
  },
  tiers: [
    {
      name: 'Lumière de TOCA',
      variantLabel: 'Mini Bouquet',
      price: 350,
      description:
        'A moment of beauty, chosen simply because it speaks to you — the smallest TOCA gesture, meant for your coffee table or workspace.',
      attributes: { tier: 'Mini Bouquet', candleCount: '1' },
    },
    {
      name: 'Signature',
      variantLabel: '12–14 candles',
      price: 800,
      description:
        'The beauty of being alive — a modest arrangement that still commands a room.',
      attributes: { tier: 'Signature', candleCount: '12–14' },
    },
    {
      name: 'Exquisite',
      variantLabel: '29–32 candles',
      price: 1750,
      description:
        'An exclusive statement fragrance for the pleasure of standing out — true beauty never fits in, nor does an unforgettable fragrance.',
      attributes: { tier: 'Exquisite', candleCount: '29–32' },
    },
    {
      name: 'Luxe',
      variantLabel: '42–45 candles',
      price: 2500,
      description:
        'Designed to command attention — the largest and most dramatic TOCA Flame & Bloom arrangement.',
      attributes: { tier: 'Luxe', candleCount: '42–45' },
    },
  ],
}

const GOURMET = {
  sourceName: 'Gourmet Candles',
  sourceDescription:
    'Dessert-inspired decorative candles crafted from soy wax and infused with premium parfum oils. The art of indulgence, designed to be desired.',
  pdfBasename: 'TOCA_Gourmet_Candles_Final_7_Page_A5.pdf',
  collection: {
    name: 'Gourmet',
    description:
      'Dessert-inspired decorative candles — the art of indulgence, designed to be desired.',
    displayOrder: 11,
  },
  tiers: [
    {
      name: 'Gourmet Petite',
      variantLabel: 'Petite',
      price: 350,
      description:
        'An introduction to the art of indulgence. Small in scale, never in impact — beautiful enough for your coffee table, irresistible enough to collect.',
      attributes: { tier: 'Petite' },
    },
    {
      name: 'Gourmet Grande',
      variantLabel: 'Grande',
      price: 500,
      description:
        'For those who believe beauty deserves more than a passing glance. The grande-scale TOCA dessert candle.',
      attributes: { tier: 'Grande' },
    },
  ],
}

function normaliseName(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim()
}

function dedupeHash({ sourceName, name, family }) {
  const payload = `${sourceName}::${normaliseName(name)}::${family}`
  return crypto.createHash('sha256').update(payload).digest('hex')
}

async function ensureSource({ sourceName, sourceDescription }) {
  const existing = await prisma.catalogueSource.findFirst({ where: { name: sourceName } })
  if (existing) return existing
  return prisma.catalogueSource.create({
    data: { name: sourceName, description: sourceDescription, sourceType: 'pdf' },
  })
}

async function ensureImport({ source, pdfBasename }) {
  // One IMPORTED catalogue import per source for the seed; if one already
  // exists we keep it so re-seed is a no-op on the import side.
  const existing = await prisma.catalogueImport.findFirst({
    where: { sourceId: source.id, originalFilename: pdfBasename },
  })
  if (existing) return existing

  // Copy the source PDF into uploads/catalogues so the file is retrievable
  // later via the admin UI (same folder admin_catalogue.js writes to).
  const uploadDir = path.join(__dirname, '../uploads/catalogues')
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
  const stamp = Date.now()
  const storedName = `${stamp}_${pdfBasename.replace(/\s+/g, '_')}`
  const src = path.join(rootDir, pdfBasename)
  const dest = path.join(uploadDir, storedName)
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    try {
      fs.copyFileSync(src, dest)
    } catch (err) {
      console.warn(`[seed_candles] Could not copy ${pdfBasename} into uploads: ${err.message}`)
    }
  }

  return prisma.catalogueImport.create({
    data: {
      sourceId: source.id,
      originalFilename: pdfBasename,
      storageKey: storedName,
      status: 'AWAITING_REVIEW',
      processedAt: new Date(),
    },
  })
}

async function ensureExtracted({ sourceName, imp, tier, candlesCategoryId, collectionId }) {
  const hash = dedupeHash({ sourceName, name: tier.name, family: 'CANDLE' })
  const existing = await prisma.extractedProduct.findFirst({
    where: { importId: imp.id, dedupeHash: hash },
  })
  if (existing) {
    // Backfill a missing collection link on a previously-seeded row so
    // re-running the seed after adding the collection fields picks it up.
    if (!existing.suggestedCollectionId && collectionId) {
      return prisma.extractedProduct.update({
        where: { id: existing.id },
        data: { suggestedCollectionId: collectionId },
      })
    }
    return existing
  }
  return prisma.extractedProduct.create({
    data: {
      importId: imp.id,
      name: tier.name,
      description: tier.description,
      family: 'CANDLE',
      suggestedCategoryId: candlesCategoryId,
      suggestedCollectionId: collectionId || null,
      priceHint: tier.price,
      variantsJson: [{ size: tier.variantLabel, price: tier.price, uom: 'unit' }],
      attributesJson: tier.attributes,
      imagesJson: null,
      dedupeHash: hash,
    },
  })
}

async function ensureCollection(spec) {
  if (!spec.collection) return null
  const existing = await prisma.collection.findFirst({ where: { name: spec.collection.name } })
  if (existing) return existing
  const slug = await generateUniqueCollectionSlug(spec.collection.name)
  return prisma.collection.create({
    data: {
      name: spec.collection.name,
      slug,
      description: spec.collection.description || null,
      displayOrder: spec.collection.displayOrder ?? 0,
      isActive: true,
    },
  })
}

// Links an already-imported Product to the catalogue's Collection when the
// first seed run happened before the collection fields existed on the spec.
// Idempotent: the composite PK on product_collections makes a re-run a no-op.
async function ensureProductCollectionLink(extracted, collection) {
  if (!collection) return
  if (!extracted.importedProductId) return
  await prisma.productCollection.upsert({
    where: {
      productId_collectionId: {
        productId: extracted.importedProductId,
        collectionId: collection.id,
      },
    },
    update: {},
    create: { productId: extracted.importedProductId, collectionId: collection.id },
  })
}

async function approveAndImport(extracted) {
  if (extracted.status === 'IMPORTED') return { skipped: true }
  if (extracted.status !== 'APPROVED') {
    await prisma.extractedProduct.update({
      where: { id: extracted.id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    })
  }
  const product = await importApprovedProduct(extracted.id)
  return { productId: product.id }
}

async function processCatalogue(spec) {
  const candlesCategory = await prisma.category.findUnique({ where: { slug: 'candles' } })
  if (!candlesCategory) {
    throw new Error("Candles category not found. Run seed_multicategory.js first.")
  }

  const collection = await ensureCollection(spec)
  const source = await ensureSource(spec)
  const imp = await ensureImport({ source, pdfBasename: spec.pdfBasename })

  let imported = 0
  let skipped = 0
  for (const tier of spec.tiers) {
    const extracted = await ensureExtracted({
      sourceName: spec.sourceName,
      imp,
      tier,
      candlesCategoryId: candlesCategory.id,
      collectionId: collection?.id || null,
    })
    const result = await approveAndImport(extracted)
    // Products seeded before the collection field existed already live in
    // the DB — link them to the Collection now so the facet UI populates.
    const refreshed = await prisma.extractedProduct.findUnique({ where: { id: extracted.id } })
    await ensureProductCollectionLink(refreshed, collection)
    if (result.skipped) skipped++
    else imported++
  }

  // Mark the import IMPORTED once every tier has a live product.
  const stillOpen = await prisma.extractedProduct.count({
    where: { importId: imp.id, status: { notIn: ['IMPORTED', 'REJECTED'] } },
  })
  if (stillOpen === 0) {
    await prisma.catalogueImport.update({
      where: { id: imp.id },
      data: { status: 'IMPORTED', importedAt: new Date() },
    })
  }

  console.log(`[${spec.sourceName}] ${imported} new → DRAFT product(s); ${skipped} already imported.`)
}

async function main() {
  console.log('🕯️  Seeding candle catalogues…')
  await processCatalogue(FLAME_AND_BLOOM)
  await processCatalogue(GOURMET)
  console.log('✅ Candle seed complete. Review new DRAFT products under Products.')
}

main()
  .catch((err) => {
    console.error('❌ Candle seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
