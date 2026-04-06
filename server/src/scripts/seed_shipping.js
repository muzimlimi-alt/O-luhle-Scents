import prisma from '../lib/prisma.js'

async function seed() {
  console.log('Seeding shipping zones...')
  
  const zones = [
    { name: 'Gauteng', country: 'South Africa', postalPattern: '0', baseRate: 100, freeAbove: 1500 },
    { name: 'Gauteng (alt)', country: 'South Africa', postalPattern: '1', baseRate: 100, freeAbove: 1500 },
    { name: 'Gauteng (alt-2)', country: 'South Africa', postalPattern: '2', baseRate: 100, freeAbove: 1500 },
    { name: 'National (SA)', country: 'South Africa', postalPattern: '', baseRate: 150, freeAbove: 2500 },
    { name: 'Default', country: '', postalPattern: '', baseRate: 450, freeAbove: 5000 }
  ]

  for (const z of zones) {
    await prisma.shippingZone.upsert({
      where: { name: z.name },
      update: z,
      create: z
    })
  }

  console.log('Shipping zones seeded successfully.')
}

seed()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
