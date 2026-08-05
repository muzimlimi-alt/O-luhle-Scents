import prisma from '../server/src/lib/prisma.js';

async function main() {
  try {
    const categoryId = 'd58ee63e-8ea2-4c25-99f2-0a5c51469071';
    console.log(`Deleting category ID: ${categoryId}`);

    const deleted = await prisma.category.delete({
      where: { id: categoryId }
    });

    console.log('Successfully deleted category:', deleted);
  } catch (err) {
    console.error('Error deleting category:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
