// One-off backfill: moves the hardcoded COURIERS map out of logisticsService.js
// into the new admin-configurable ShippingMethod table. Safe to run more than
// once — upserts on the unique `key`, never duplicates rows.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_METHODS = [
  { key: 'THE_COURIER_GUY', name: 'The Courier Guy', trackingUrlTemplate: 'https://portal.thecourierguy.co.za/track/' },
  { key: 'ARAMEX', name: 'Aramex', trackingUrlTemplate: 'https://www.aramex.com/track/results?shipmentNumber=' },
  { key: 'FEDEX', name: 'FedEx', trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr=' },
  { key: 'POST_OFFICE', name: 'SAPO', trackingUrlTemplate: 'https://trackmyparcel.co.za/track/' },
]

async function main() {
  for (const method of DEFAULT_METHODS) {
    await prisma.shippingMethod.upsert({
      where: { key: method.key },
      update: {},
      create: method,
    })
    console.log(`  Ensured shipping method: ${method.key}`)
  }
  console.log('Shipping method backfill complete.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
