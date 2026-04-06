import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin() {
  const email = 'admin@oluhle.com';
  const password = 'admin123';

  console.log('--- Database Connectivity Diagnostics ---');
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!admin) {
      console.log('[-] Admin user not found in database.');
      // List all admins to see who is there
      const allAdmins = await prisma.adminUser.findMany();
      console.log('[!] Existing admins:', allAdmins.map(a => a.email));
      return;
    }

    console.log('[+] Admin user found:', admin.email);

    const valid = await bcrypt.compare(password, admin.passwordHash);
    console.log(valid ? '[+] Password is valid' : '[-] Password is invalid');

    if (valid) {
      // Test update
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { lastLogin: new Date() }
      });
      console.log('[+] Last login updated successfully');
    }

  } catch (err) {
    console.error('[CRITICAL] Diagnostic Failure:', err);
    if (err.code) console.log('Prisma Error Code:', err.code);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
