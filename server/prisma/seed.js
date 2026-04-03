import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const products = [
  { id: 1,  name: 'Zale',             category: 'premium',    price100ml: 2000, price50ml: 1100, notes: 'A bold, captivating blend of oud and amber',           badge: 'Bestseller', image: 'products/zale.jpg' },
  { id: 2,  name: 'Mika',             category: 'premium',    price100ml: 2000, price50ml: 1100, notes: 'Warm spice meets soft vanilla undertones',              badge: '',           image: 'products/mika.jpg' },
  { id: 3,  name: 'Koah',             category: 'premium',    price100ml: 2000, price50ml: 1100, notes: 'Deep woody fragrance with smoky leather accents',       badge: 'New',        image: 'products/koah.jpg' },
  { id: 4,  name: 'Yugen',            category: 'signature',  price100ml: 1500, price50ml: 900,  notes: 'Mysterious oriental with exotic floral heart',          badge: '',           image: 'products/yugen.jpg' },
  { id: 5,  name: "Antiqué",          category: 'signature',  price100ml: 1500, price50ml: 900,  notes: 'Timeless elegance with bergamot and sandalwood',        badge: 'Popular',    image: 'products/antique.jpg' },
  { id: 6,  name: 'Edan',             category: 'signature',  price100ml: 1500, price50ml: 900,  notes: 'Fresh green notes grounded in earthy vetiver',          badge: '',           image: 'products/edan.jpg' },
  { id: 7,  name: 'Aurelia',          category: 'signature',  price100ml: 1500, price50ml: 900,  notes: 'Golden florals with a luminous musk finish',            badge: '',           image: 'products/aurelia.jpg' },
  { id: 8,  name: 'Il Piano',         category: 'signature',  price100ml: 1500, price50ml: 900,  notes: 'Harmonious blend of lavender, cedar and tonka',         badge: '',           image: 'products/ilpiano.jpg' },
  { id: 9,  name: 'Satin',            category: 'classic',    price100ml: 1200, price50ml: 700,  notes: 'Silky smooth rose and white musk composition',          badge: '',           image: 'products/satin.jpg' },
  { id: 10, name: 'Luna',             category: 'classic',    price100ml: 1200, price50ml: 700,  notes: 'Dreamy night jasmine with powdery iris',                badge: 'Bestseller', image: 'products/luna.jpg' },
  { id: 11, name: 'Absolute',         category: 'classic',    price100ml: 1200, price50ml: 700,  notes: 'Refined patchouli with sweet amber warmth',             badge: '',           image: 'products/absolute.jpg' },
  { id: 12, name: 'Sublime Rose Oud', category: 'essentials', price100ml: 1000, price50ml: 600,  notes: 'Damascena rose layered with rich oud',                  badge: '',           image: 'products/sublimerose.jpg' },
  { id: 13, name: 'Kairos',           category: 'essentials', price100ml: 1000, price50ml: 600,  notes: 'Citrus opening with deep amber base',                   badge: '',           image: 'products/kairos.jpg' },
  { id: 14, name: 'Assassin',         category: 'essentials', price100ml: 1000, price50ml: 600,  notes: 'Dark and seductive with black pepper and oud',          badge: 'New',        image: 'products/assassin.jpg' },
  { id: 15, name: 'Mi Amor',          category: 'essentials', price100ml: 1000, price50ml: 600,  notes: 'Passionate blend of tuberose, vanilla and musk',        badge: '',           image: 'products/miamor.jpg' },
  { id: 16, name: 'Eminence',         category: 'essentials', price100ml: 1000, price50ml: 600,  notes: 'Distinguished woody aromatic with saffron',             badge: '',           image: 'products/eminence.jpg' },
  { id: 17, name: 'Chypre Fruity',    category: 'essentials', price100ml: 1000, price50ml: 600,  notes: 'Vibrant fruits over classic oakmoss and bergamot',      badge: '',           image: 'products/chyprefruity.jpg' },
]

async function main() {
  console.log('Seeding products...')
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    })
  }
  console.log('Seeded ${products.length} products.')

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
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
