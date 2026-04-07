import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    const res = await prisma.product.findMany({
      where: { isActive: true },
      include: { 
          category: true,
          supplier: true,
          variants: { include: { inventory: true } } 
      },
      take: 2
    });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('QUERY FAILED:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
