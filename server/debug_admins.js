import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const search = '';
    const role = '';
    const status = '';
    const sortBy = 'name';
    const sortOrder = 'asc';
    const skip = 0;
    const take = 10;

    const where = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        } : {},
        role ? { role } : {},
        status ? { isActive: status === 'active' } : {}
      ]
    };

    console.log('Query "where" clause:', JSON.stringify(where, null, 2));

    const users = await prisma.adminUser.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take
    });

    console.log('Users found:', JSON.stringify(users, null, 2));
    console.log('Total count:', await prisma.adminUser.count({ where }));

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
