import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const cats = await prisma.category.findMany();
  console.log('CATEGORIES_JSON:' + JSON.stringify(cats));
}
main().catch(console.error).finally(() => prisma.$disconnect());
