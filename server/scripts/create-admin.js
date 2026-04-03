import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@test.com'
  const password = 'admin123'
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'ADMIN',
        passwordHash: hashedPassword,
      },
      create: {
        email,
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: hashedPassword,
        role: 'ADMIN',
      },
    })
    console.log(`\n  ✅ SUCCESS: Created admin user:`)
    console.log(`     Email:    ${user.email}`)
    console.log(`     Password: ${password}\n`)
  } catch (err) {
    console.error(`\n  ❌ ERROR: Could not create admin user:`, err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
