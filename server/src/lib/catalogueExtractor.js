// Catalogue extraction worker: turns a stored PDF into ExtractedProduct rows.
//
// Design choices:
// * Uses poppler's `pdftotext -layout` as the extraction primitive — same
//   tool admins use locally; no runtime Node PDF parser dependency.
// * The parser is deliberately permissive: the review workflow exists
//   because PDF text extraction is noisy. We over-extract and let the
//   admin correct / reject rather than silently drop ambiguous rows.
// * Dedupe hash = SHA-256 of (normalised name + family + source name).
//   Prevents re-importing identical rows when the same catalogue is
//   uploaded twice.
//
// The extractor only STAGES rows (status = PENDING). Nothing becomes a
// live Product until an admin approves and imports via the review UI.

import { execFile } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import path from 'path'
import prisma from './prisma.js'

const execFileAsync = promisify(execFile)

// Resolve pdftotext without assuming it's on PATH. Admins who installed
// poppler via winget get a per-user install that isn't on the system PATH
// until the shell is restarted — this fallback lets the server pick it up
// on first boot without them having to log out/in.
const POPPLER_WINGET_FALLBACK = path.join(
  process.env.LOCALAPPDATA || '',
  'Microsoft',
  'WinGet',
  'Packages',
  'oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'poppler-25.07.0',
  'Library',
  'bin',
  'pdftotext.exe'
)

const PDFTOTEXT = process.env.PDFTOTEXT_PATH || POPPLER_WINGET_FALLBACK || 'pdftotext'

async function pdfToText(pdfPath) {
  // -layout preserves column structure, which the Officina Del Toca
  // catalogues use heavily (price tables, variant tables).
  const { stdout } = await execFileAsync(PDFTOTEXT, ['-layout', pdfPath, '-'], {
    maxBuffer: 20 * 1024 * 1024,
  })
  return stdout
}

function normaliseName(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim()
}

function dedupeHash({ sourceName, name, family }) {
  const payload = `${sourceName}::${normaliseName(name)}::${family || 'UNKNOWN'}`
  return crypto.createHash('sha256').update(payload).digest('hex')
}

// Price-line parser — "R2,500" or "R1 500" or "R350" (South African Rand).
function parsePriceToken(token) {
  if (!token) return null
  const cleaned = token.replace(/\s/g, '').replace(/[,\s]/g, '')
  const m = cleaned.match(/^R?([0-9]+(?:\.[0-9]+)?)$/)
  if (!m) return null
  const value = Number(m[1])
  return Number.isFinite(value) ? value : null
}

// Heuristic PERFUME extractor. The Officina Del Toca catalogue has a
// consistent per-fragrance block: NAME \n Extrait de Parfum · <Collection> …
// \n Scent Family: … \n <description> \n TOP … HEART … BASE …
// \n Volume Size Price \n 100ml … 50ml …
function extractPerfumes(text) {
  const lines = text.split(/\r?\n/)
  const products = []
  // A heading is an uppercase (A-Z + spaces + ÉÈ…) line of >=3 chars followed
  // within ~6 lines by "Extrait de Parfum". Scanning line-by-line keeps the
  // code simple vs. a stateful FSM.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!/^[A-ZÀ-ÿ'& ]{3,}$/.test(line)) continue
    const window = lines.slice(i + 1, i + 7).join(' ')
    if (!/Extrait de Parfum/i.test(window)) continue

    const name = line.trim()
    const block = lines.slice(i, i + 25).join('\n')

    // Collection follows "Extrait de Parfum · <Collection>"
    const collectionMatch = block.match(/Extrait de Parfum\s*·\s*([A-Za-z]+)\s*Collection/)
    const scentFamilyMatch = block.match(/Scent Family:\s*([^\n]+)/)
    const topMatch = block.match(/TOP\s+([^\n]+)/)
    const heartMatch = block.match(/HEART\s+([^\n]+)/)
    const baseMatch = block.match(/BASE\s+([^\n]+)/)

    const variants = []
    for (const m of block.matchAll(/(\d{2,3})ml\s+(?:Full|Travel)\s+Size\s+R\s*([0-9,]+)/gi)) {
      const price = parsePriceToken(m[2])
      if (price != null) variants.push({ size: `${m[1]}ml`, price })
    }

    const description = (() => {
      // Prose paragraph is the line after "Scent Family:" and before "TOP".
      const sfIdx = block.indexOf('Scent Family')
      const topIdx = block.indexOf('TOP ')
      if (sfIdx === -1 || topIdx === -1 || topIdx < sfIdx) return null
      const snippet = block.slice(sfIdx, topIdx)
      const afterNewline = snippet.split('\n').slice(1).join(' ').trim()
      return afterNewline || null
    })()

    products.push({
      name,
      family: 'PERFUME',
      description,
      attributesJson: {
        collection: collectionMatch?.[1] || null,
        scentFamily: scentFamilyMatch?.[1]?.trim() || null,
        topNotes: topMatch?.[1]?.trim() || null,
        heartNotes: heartMatch?.[1]?.trim() || null,
        baseNotes: baseMatch?.[1]?.trim() || null,
      },
      variantsJson: variants,
      priceHint: variants.length ? Math.min(...variants.map((v) => v.price)) : null,
      pageReference: null,
    })
  }
  return dedupeByName(products)
}

// Candle catalogues are less structured — Flame & Bloom and Gourmet Candles
// are brochure-style with tier names, candle counts and prices scattered. A
// name/price-pair pass picks up the tier rows and nothing else. The review
// UI lets admins fix the rest.
function extractCandles(text) {
  const products = []
  // Tier heading + R-price pair on same or next line. Covers both:
  //   "Lumière de TOCA   Mini Bouquet   R350"
  //   "LUMIÈRE DE TOCA\nMINI BOUQUET\nR350"
  const tierRegex = /([A-ZÀ-ÿ][A-ZÀ-ÿ'&\- ]{2,40})\s+(Mini Bouquet|\d{1,3}[–-]\d{1,3}\s*candles|CANDLES|Petite|Grande|MINI BOUQUET)\s+R\s*([0-9,]+)/gi
  for (const m of text.matchAll(tierRegex)) {
    const name = m[1].trim()
    const variantLabel = m[2].trim()
    const price = parsePriceToken(m[3])
    if (price == null) continue
    products.push({
      name,
      family: 'CANDLE',
      description: null,
      attributesJson: {
        tier: variantLabel,
      },
      variantsJson: [{ size: variantLabel, price }],
      priceHint: price,
      pageReference: null,
    })
  }
  return dedupeByName(products)
}

function dedupeByName(products) {
  const seen = new Map()
  for (const p of products) {
    const key = normaliseName(p.name)
    if (!seen.has(key)) seen.set(key, p)
  }
  return Array.from(seen.values())
}

// Which extractor to run given the family hint stored on the CatalogueSource.
// UNKNOWN sources fall through to the perfume extractor since that's the
// most structured and least likely to produce garbage on arbitrary text.
function extractorFor(familyHint) {
  if (familyHint === 'CANDLE') return extractCandles
  if (familyHint === 'PERFUME') return extractPerfumes
  return extractPerfumes
}

/**
 * Run extraction for one CatalogueImport. Writes ExtractedProduct rows and
 * transitions the CatalogueImport state machine. Idempotent per import: if
 * the same import is processed twice, dedupeHash collisions guarantee no
 * duplicate ExtractedProduct rows.
 */
export async function runExtraction(importId, { familyHint, pdfPath, sourceName }) {
  await prisma.catalogueImport.update({
    where: { id: importId },
    data: { status: 'PROCESSING' },
  })

  let text
  try {
    text = await pdfToText(pdfPath)
  } catch (err) {
    await prisma.catalogueImport.update({
      where: { id: importId },
      data: {
        status: 'FAILED',
        errorMessage: `pdftotext failed: ${err.message}`,
        processedAt: new Date(),
      },
    })
    throw err
  }

  const extractor = extractorFor(familyHint)
  const extracted = extractor(text)

  let created = 0
  for (const row of extracted) {
    const hash = dedupeHash({ sourceName, name: row.name, family: row.family })
    const existing = await prisma.extractedProduct.findFirst({
      where: { importId, dedupeHash: hash },
    })
    if (existing) continue
    await prisma.extractedProduct.create({
      data: {
        importId,
        name: row.name,
        description: row.description ?? null,
        family: row.family,
        priceHint: row.priceHint ?? null,
        variantsJson: row.variantsJson ?? null,
        attributesJson: row.attributesJson ?? null,
        imagesJson: null,
        dedupeHash: hash,
        pageReference: row.pageReference ?? null,
      },
    })
    created++
  }

  await prisma.catalogueImport.update({
    where: { id: importId },
    data: {
      status: extracted.length > 0 ? 'AWAITING_REVIEW' : 'EXTRACTED',
      processedAt: new Date(),
    },
  })

  return { extracted: extracted.length, created }
}

/**
 * Promote a single approved ExtractedProduct into the live Product table.
 * Creates Product + ProductVariants (with starter Inventory rows at 0).
 * Attribute values on the extracted row become ProductAttributeValue entries
 * where a matching AttributeDefinition exists; unknown keys are stored on
 * the product's free-text columns (description, collection, notes).
 */
export async function importApprovedProduct(extractedProductId, { adminId } = {}) {
  const ep = await prisma.extractedProduct.findUnique({ where: { id: extractedProductId } })
  if (!ep) throw new Error('ExtractedProduct not found')
  if (ep.status !== 'APPROVED') throw new Error('Only APPROVED rows can be imported')

  const variants = Array.isArray(ep.variantsJson) ? ep.variantsJson : []
  const attributes = ep.attributesJson || {}
  const images = Array.isArray(ep.imagesJson) ? ep.imagesJson : []

  const { generateUniqueProductSlug } = await import('./slug.js')
  const slug = await generateUniqueProductSlug(ep.name)

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        name: ep.name,
        slug,
        description: ep.description,
        family: ep.family || 'PERFUME',
        status: 'DRAFT', // never auto-publish — admin flips to ACTIVE
        categoryId: ep.suggestedCategoryId || null,
        collection: attributes.collection || null,
        scentFamily: attributes.scentFamily || null,
        topNotes: attributes.topNotes || null,
        heartNotes: attributes.heartNotes || null,
        baseNotes: attributes.baseNotes || null,
        // Mirror the Products admin's images shape: JSON array string in
        // Product.images, plus a denormalised Product.primaryImage pointing
        // at the first filename. The product-detail page reads primaryImage
        // first for its hero, then images[] for the gallery.
        images: images.length > 0 ? JSON.stringify(images) : null,
        primaryImage: images[0] || null,
      },
    })

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      const sku = `TOCA-${slug.toUpperCase().slice(0, 12)}-${(v.size || i).toString().toUpperCase().replace(/\s+/g, '')}-${i + 1}`
      const variant = await tx.productVariant.create({
        data: {
          productId: p.id,
          size: String(v.size || `V${i + 1}`).slice(0, 20),
          price: v.price || 0,
          sku,
          volume: v.volume || 0,
          uom: v.uom || (ep.family === 'CANDLE' ? 'unit' : 'ml'),
        },
      })
      await tx.inventory.create({
        data: { variantId: variant.id, quantity: 0, reserved: 0 },
      })
    }

    if (ep.suggestedCollectionId) {
      await tx.productCollection.create({
        data: { productId: p.id, collectionId: ep.suggestedCollectionId },
      })
    }

    // Keep the new MediaAsset/ProductMedia tables in sync — same helper the
    // Products admin uses. Safe to skip when no images are present; the
    // Media Library just has nothing to mirror.
    if (images.length > 0) {
      const { syncProductMedia } = await import('./mediaService.js')
      await syncProductMedia(tx, p.id, images)
    }

    return p
  })

  await prisma.extractedProduct.update({
    where: { id: ep.id },
    data: {
      status: 'IMPORTED',
      importedProductId: product.id,
      importedAt: new Date(),
      reviewedByAdminId: adminId || null,
    },
  })

  return product
}
