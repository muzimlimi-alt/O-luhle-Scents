// One-off PIM Phase 1 backfill: generates a unique slug for every product
// that doesn't have one, and seeds the new Brand table from the distinct
// existing Product.brand strings, linking each product's brandId.
//
// Safe to re-run: every step only touches rows that still need it.
//
// Usage: node scripts/backfill_pim_phase1.js

import prisma from '../src/lib/prisma.js'
import { slugify, generateUniqueProductSlug } from '../src/lib/slug.js'

async function backfillSlugs() {
  const products = await prisma.product.findMany({
    where: { slug: null },
    select: { id: true, name: true }
  })

  let count = 0
  for (const product of products) {
    const slug = await generateUniqueProductSlug(product.name, product.id)
    await prisma.product.update({ where: { id: product.id }, data: { slug } })
    count++
  }
  console.log(`[backfill] Assigned slugs to ${count} product(s).`)
}

async function backfillBrands() {
  const products = await prisma.product.findMany({
    where: { brand: { not: null }, brandId: null },
    select: { id: true, brand: true }
  })

  const distinctBrandNames = [...new Set(products.map(p => p.brand.trim()).filter(Boolean))]
  let created = 0

  for (const name of distinctBrandNames) {
    let brand = await prisma.brand.findUnique({ where: { name } })
    if (!brand) {
      const baseSlug = slugify(name) || 'brand'
      let slug = baseSlug
      let suffix = 2
      while (await prisma.brand.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${suffix++}`
      }
      brand = await prisma.brand.create({ data: { name, slug } })
      created++
    }

    await prisma.product.updateMany({
      where: { brand: name, brandId: null },
      data: { brandId: brand.id }
    })
  }
  console.log(`[backfill] Created ${created} brand(s), linked ${products.length} product(s).`)
}

async function main() {
  await backfillSlugs()
  await backfillBrands()
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('[backfill] Failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
