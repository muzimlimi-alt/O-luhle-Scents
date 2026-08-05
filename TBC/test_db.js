import prisma from './src/lib/prisma.js';

async function test() {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { 
        category: true,
        supplier: true,
        variants: { include: { inventory: true } } 
      },
      take: 2
    });
    console.log('Success! Products found in DB:', products.length);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
