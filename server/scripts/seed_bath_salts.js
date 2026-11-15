// Bath Salts seed — creates 6 luxury bath salt products under the
// Scented Bath Salts category with two size variants each (250g / 500g).
//
// Products land as ACTIVE. Idempotent: existing slugs are skipped.
//
// Usage: node scripts/seed_bath_salts.js

import prisma from '../src/lib/prisma.js'

const ATTR_IDS = {
  salt_weight_grams:  'd002333d-2282-43d7-abd8-330711e940fe',
  scent_profile:      '2e860a88-ff01-42b8-ba3c-0cddd57bdd02',
  key_ingredients:    '352758bf-bbc6-4f56-8ad0-94639e1d6591',
  usage_instructions: '8a45a137-92fa-4871-a137-663568434c98',
  packaging_type:     '2c87969f-066c-45e1-9cd3-e66c424b7f52',
}

const PRODUCTS = [
  {
    name: 'Sérénité',
    slug: 'serenite-bath-salts',
    description: 'A calming ritual of lavender and chamomile, enriched with Dead Sea minerals. Dissolves tension and invites tranquillity — the quietest luxury.',
    scentFamily: 'Floral',
    variants: [
      { size: '250g', price: 280, sku: 'BS-SER-250' },
      { size: '500g', price: 480, sku: 'BS-SER-500' },
    ],
    attributes: {
      scent_profile: 'Lavender, chamomile, white tea',
      key_ingredients: 'Dead Sea salt, Epsom salt, lavender essential oil, chamomile extract, vitamin E',
      usage_instructions: 'Add 2–3 tablespoons to warm running water. Soak for 15–20 minutes.',
      packaging_type: 'Jar',
    },
    weights: { '250g': '250', '500g': '500' },
  },
  {
    name: 'Velours',
    slug: 'velours-bath-salts',
    description: 'Rose petals meet Himalayan pink salt in a bath that softens skin and settles the mind. Indulgence distilled to its purest form.',
    scentFamily: 'Floral',
    variants: [
      { size: '250g', price: 320, sku: 'BS-VEL-250' },
      { size: '500g', price: 550, sku: 'BS-VEL-500' },
    ],
    attributes: {
      scent_profile: 'Damask rose, peony, soft musk',
      key_ingredients: 'Himalayan pink salt, rose petal extract, jojoba oil, rosehip oil',
      usage_instructions: 'Add 2–3 tablespoons to warm running water. Soak for 15–20 minutes.',
      packaging_type: 'Jar',
    },
    weights: { '250g': '250', '500g': '500' },
  },
  {
    name: 'Noir Absolu',
    slug: 'noir-absolu-bath-salts',
    description: 'Dark, magnetic, unapologetic. Activated charcoal and oud-infused salts for a detoxifying soak that commands the senses.',
    scentFamily: 'Oriental',
    variants: [
      { size: '250g', price: 350, sku: 'BS-NOI-250' },
      { size: '500g', price: 600, sku: 'BS-NOI-500' },
    ],
    attributes: {
      scent_profile: 'Oud, black amber, smoky vetiver',
      key_ingredients: 'Mediterranean sea salt, activated charcoal, oud fragrance oil, argan oil',
      usage_instructions: 'Add 2–3 tablespoons to warm running water. Soak for 15–20 minutes. May tint water — rinse tub after use.',
      packaging_type: 'Jar',
    },
    weights: { '250g': '250', '500g': '500' },
  },
  {
    name: 'Soleil',
    slug: 'soleil-bath-salts',
    description: 'Sun-warmed citrus groves captured in crystalline form. An invigorating soak that awakens and restores — morning light in a jar.',
    scentFamily: 'Fruity',
    variants: [
      { size: '250g', price: 280, sku: 'BS-SOL-250' },
      { size: '500g', price: 480, sku: 'BS-SOL-500' },
    ],
    attributes: {
      scent_profile: 'Bergamot, blood orange, neroli',
      key_ingredients: 'Epsom salt, sea salt, bergamot essential oil, sweet almond oil, orange peel extract',
      usage_instructions: 'Add 2–3 tablespoons to warm running water. Soak for 15–20 minutes.',
      packaging_type: 'Jar',
    },
    weights: { '250g': '250', '500g': '500' },
  },
  {
    name: 'Bois Sacré',
    slug: 'bois-sacre-bath-salts',
    description: 'Sacred wood and warm spice, grounded in ancient ritual. Sandalwood and cedarwood salts for a meditative, deeply warming soak.',
    scentFamily: 'Woody',
    variants: [
      { size: '250g', price: 320, sku: 'BS-BOI-250' },
      { size: '500g', price: 550, sku: 'BS-BOI-500' },
    ],
    attributes: {
      scent_profile: 'Sandalwood, cedarwood, warm cardamom',
      key_ingredients: 'Himalayan salt, sandalwood essential oil, cedarwood oil, shea butter micro-particles',
      usage_instructions: 'Add 2–3 tablespoons to warm running water. Soak for 15–20 minutes.',
      packaging_type: 'Jar',
    },
    weights: { '250g': '250', '500g': '500' },
  },
  {
    name: 'Éclat',
    slug: 'eclat-bath-salts',
    description: 'Eucalyptus and peppermint fused with mineral-rich salts. A revitalising ritual that clears, cools, and re-energises.',
    scentFamily: 'Herbal',
    variants: [
      { size: '250g', price: 280, sku: 'BS-ECL-250' },
      { size: '500g', price: 480, sku: 'BS-ECL-500' },
    ],
    attributes: {
      scent_profile: 'Eucalyptus, peppermint, green tea',
      key_ingredients: 'Dead Sea salt, eucalyptus essential oil, peppermint oil, green tea extract, coconut oil',
      usage_instructions: 'Add 2–3 tablespoons to warm running water. Soak for 15–20 minutes.',
      packaging_type: 'Pouch',
    },
    weights: { '250g': '250', '500g': '500' },
  },
]

async function main() {
  const category = await prisma.category.findUnique({ where: { slug: 'bath-salts' } })
  if (!category) throw new Error('Bath Salts category not found. Run seed_multicategory.js first.')

  let created = 0
  for (const spec of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { slug: spec.slug } })
    if (existing) {
      console.log('  skip (exists):', spec.name)
      continue
    }

    const product = await prisma.product.create({
      data: {
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        family: 'BATH_SALT',
        categoryId: category.id,
        status: 'ACTIVE',
        scentFamily: spec.scentFamily,
        brand: 'TOCA',
        type: 'Bath Salts',
        shortDescription: spec.description.split('.')[0] + '.',
        variants: {
          create: spec.variants.map((v) => ({
            size: v.size,
            price: v.price,
            sku: v.sku,
          })),
        },
      },
    })

    for (const [key, value] of Object.entries(spec.attributes)) {
      const defId = ATTR_IDS[key]
      if (!defId) continue
      await prisma.productAttributeValue.create({
        data: { productId: product.id, definitionId: defId, value: String(value) },
      })
    }

    const variants = await prisma.productVariant.findMany({ where: { productId: product.id } })
    for (const v of variants) {
      const weight = spec.weights[v.size]
      if (weight) {
        await prisma.variantAttributeValue.create({
          data: { variantId: v.id, definitionId: ATTR_IDS.salt_weight_grams, value: weight },
        })
      }
    }

    created++
    console.log('  created:', spec.name, '(' + spec.variants.length + ' variants)')
  }

  console.log('\n[bath_salts] ' + created + ' product(s) created as ACTIVE.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
