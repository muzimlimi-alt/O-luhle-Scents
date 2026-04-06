import prisma from './src/lib/prisma.js'

async function check() {
  const order = await prisma.order.findUnique({
    where: { id: 'eeeded37-39a0-4a39-9e37-8201aa08ba97' },
    include: { items: true }
  })
  console.log('Order Details:', JSON.stringify(order, null, 2))
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
