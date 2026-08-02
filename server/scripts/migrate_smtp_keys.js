// One-off migration: copies legacy smtp_* GlobalSetting rows (written by the
// old Config.jsx form) onto the EMAIL_* keys that configStore/email.js
// actually read, then removes the legacy rows. Safe to run more than once —
// once the smtp_* rows are gone there is nothing left to migrate.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const KEY_MAP = {
  smtp_host: 'EMAIL_HOST',
  smtp_port: 'EMAIL_PORT',
  smtp_user: 'EMAIL_USER',
  smtp_pass: 'EMAIL_PASS',
}

async function main() {
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    const legacy = await prisma.globalSetting.findUnique({ where: { key: oldKey } })
    if (!legacy) continue

    await prisma.globalSetting.upsert({
      where: { key: newKey },
      update: { value: legacy.value, group: 'general' },
      create: { key: newKey, value: legacy.value, group: 'general' },
    })

    await prisma.globalSetting.delete({ where: { key: oldKey } })
    console.log(`  Migrated ${oldKey} -> ${newKey}`)
  }

  console.log('SMTP key migration complete.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
