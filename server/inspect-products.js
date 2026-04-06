import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const products = await p.product.findMany({ select: { name: true, images: true, primaryImage: true } })
  console.log(JSON.stringify(products, null, 2))
}
main().finally(() => p.$disconnect())
