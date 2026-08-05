import prisma from '../server/src/lib/prisma.js';

async function main() {
  try {
    const categoryName = "PW Test Category 1785756870368 EDITED";
    console.log(`Searching for category: "${categoryName}"`);

    const category = await prisma.category.findFirst({
      where: {
        OR: [
          { name: categoryName },
          { name: { contains: 'PW Test Category' } }
        ]
      },
      include: {
        products: true,
        children: true
      }
    });

    if (!category) {
      console.log('Category NOT found in database.');
      const allCategories = await prisma.category.findMany({ select: { id: true, name: true } });
      console.log('All categories in DB:', allCategories);
    } else {
      console.log('Found category:', category);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
