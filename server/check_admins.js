import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkAdmins() {
  try {
    const admins = await prisma.adminUser.findMany({
      select: {
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true
      }
    });
    console.log('--- ADMIN USERS ---');
    console.log(JSON.stringify(admins, null, 2));
  } catch (error) {
    console.error('Error fetching admins:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmins();
