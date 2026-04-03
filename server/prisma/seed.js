import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const categoryData = [
  { name: 'Women', slug: 'women' },
  { name: 'Men', slug: 'men' },
  { name: 'Bag', slug: 'bag' },
  { name: 'Shoes', slug: 'shoes' },
  { name: 'Watches', slug: 'watches' },
]

const productData = [
  { name: 'Zale',             categorySlug: 'women',    price: 1100, price100ml: 2000, price50ml: 1100, description: 'A bold, captivating blend of oud and amber',           badge: 'Bestseller' },
  { name: 'Mika',             categorySlug: 'men',    price: 1100, price100ml: 2000, price50ml: 1100, description: 'Warm spice meets soft vanilla undertones',              badge: ''           },
  { name: 'Koah',             categorySlug: 'bag',    price: 1100, price100ml: 2000, price50ml: 1100, description: 'Deep woody fragrance with smoky leather accents',       badge: 'New'        },
  { name: 'Yugen',            categorySlug: 'shoes',  price: 900, price100ml: 1500, price50ml: 900,  description: 'Mysterious oriental with exotic floral heart',          badge: ''           },
  { name: "Antiqué",          categorySlug: 'watches',  price: 900, price100ml: 1500, price50ml: 900,  description: 'Timeless elegance with bergamot and sandalwood',        badge: 'Popular'    },
]

async function main() {
  console.log('Clearing old data...')
  await prisma.orderItem.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.category.deleteMany({})

  console.log('Seeding categories...')
  const createdCategories = {}
  for (const cat of categoryData) {
    const created = await prisma.category.create({ data: cat })
    createdCategories[cat.slug] = created.id
  }

  console.log('Seeding products...')
  for (let i = 0; i < productData.length; i++) {
    const p = productData[i]
    const { categorySlug, ...rest } = p
    await prisma.product.create({
      data: {
        ...rest,
        sku: `OLS-${p.name.toUpperCase().replace(/\s+/g, '-')}-${i+1}`,
        categoryId: createdCategories[categorySlug],
        images: JSON.stringify(['placeholder.jpg']),
        primaryImage: 'placeholder.jpg',
        colors: JSON.stringify(['Black', 'Gold']),
        tags: JSON.stringify(['Fashion', 'Premium']),
        createdBy: 'System Seed',
        active: true
      }
    })
  }

  const adminEmail = 'admin@oluhle.com'
  const passwordHash = await bcrypt.hash('adminPassword123', 12)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      phone: '0123456789'
    }
  })
  console.log('Admin user ready:', adminEmail)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
