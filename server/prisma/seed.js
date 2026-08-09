import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const categoryData = [
  { name: 'Signature Collection', slug: 'signature' },
  { name: 'Premium Collection', slug: 'premium' },
  { name: 'Essentials', slug: 'essentials' }
]

const productData = [
  { 
    name: 'Zale',
    brand: 'TOCA',
    categorySlug: 'premium',
    description: 'A bold, captivating blend of oud and amber.',
    variants: [
      { size: '50ml', price: 1100, quantity: 15 },
      { size: '100ml', price: 2000, quantity: 8 }
    ]
  },
  { 
    name: 'Mika',
    brand: 'TOCA',
    categorySlug: 'premium',
    description: 'Warm spice meets soft vanilla undertones.',
    variants: [
      { size: '50ml', price: 1100, quantity: 12 }
    ]
  },
  { 
    name: 'Luna',
    brand: 'TOCA',
    categorySlug: 'signature',
    description: 'Dreamy night jasmine with powdery iris.',
    variants: [
      { size: '50ml', price: 900, quantity: 20 },
      { size: '100ml', price: 1500, quantity: 5 }
    ]
  }
]

async function main() {
  console.log('🏛️  Initializing PostgreSQL Fulfillment Engine...')

  // Clear data in order
  await prisma.inventoryLog.deleteMany({})
  await prisma.inventory.deleteMany({})
  await prisma.productVariant.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.category.deleteMany({})
  await prisma.adminUser.deleteMany({})
  
  console.log('🎨 Seeding classification layer...')
  const categories = {}
  for (const cat of categoryData) {
    const created = await prisma.category.create({ data: cat })
    categories[cat.slug] = created.id
  }

  console.log('🏺 Orchestrating luxury catalogue...')
  for (const p of productData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        brand: p.brand,
        description: p.description,
        categoryId: categories[p.categorySlug],
        isActive: true,
        images: JSON.stringify(['placeholder.jpg']),
        primaryImage: 'placeholder.jpg'
      }
    })

    // Create Variants & Inventory
    for (const v of p.variants) {
      const sku = `OLS-${p.name.toUpperCase()}-${v.size.replace(/\s+/g, '')}`
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          size: v.size,
          price: v.price,
          sku: sku,
          inventory: {
            create: {
              quantity: v.quantity,
              lowStockThreshold: 5
            }
          }
        }
      })
    }
  }

  console.log('🔒 Initializing administrative portal...')
  const adminEmail = 'admin@toca.co.za'
  const passwordHash = await bcrypt.hash('adminPassword123', 12)
  await prisma.adminUser.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: 'TOCA Admin',
      role: 'ADMIN',
      isActive: true
    }
  })

  console.log('✅ Synchronized Successfully. Admin: ' + adminEmail)
}

main()
  .catch((e) => {
    console.error('❌ Synchronous Synchronization Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
