// One-off: populates MediaAsset/ProductMedia from every product's existing
// `images` JSON array, so historical products show up in the Media Library
// (alt-text editing) immediately, without touching the legacy column.
//
// Safe to re-run — syncProductMedia only adds/removes what's actually missing.
//
// Usage: node scripts/backfill_media_library.js

import prisma from '../src/lib/prisma.js'
import { syncProductMedia } from '../src/lib/mediaService.js'

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, images: true } })

  let count = 0
  for (const product of products) {
    let filenames = []
    try { filenames = JSON.parse(product.images || '[]') } catch { filenames = [] }
    if (!Array.isArray(filenames) || filenames.length === 0) continue

    await prisma.$transaction(tx => syncProductMedia(tx, product.id, filenames))
    count++
  }
  console.log(`[backfill] Synced media records for ${count} product(s).`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('[backfill] Failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
