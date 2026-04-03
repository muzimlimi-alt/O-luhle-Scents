import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const logs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  })
  console.log('--- RECENT AUDIT LOGS ---')
  logs.forEach(log => {
    console.log(`[${log.createdAt.toISOString()}] ${log.action}`)
    console.log(JSON.stringify(log.metadata, null, 2))
    console.log('---')
  })
  await prisma.$disconnect()
}

main().catch(console.error)
