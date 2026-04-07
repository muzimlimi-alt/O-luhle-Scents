import prisma from './src/lib/prisma.js';

async function test() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { 
        category: true,
        supplier: true,
        variants: { include: { inventory: true } } 
      },
      take: 2
    });
    console.log('Success:', products.length);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
