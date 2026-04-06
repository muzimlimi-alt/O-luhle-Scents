
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@oluhle.com';
  const password = 'Oluhle@2024!';
  const passwordHash = await bcrypt.hash(password, 12);

  const updated = await prisma.adminUser.update({
    where: { email },
    data: { 
      passwordHash, 
      isActive: true,
      role: 'ADMIN'
    }
  });

  console.log('--- PASSWORD RESET SUCCESS ---');
  console.log(`Email: ${updated.email}`);
  console.log(`New Password: ${password}`);
  console.log('Status: Active');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
