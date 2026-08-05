import prisma from '../lib/prisma.js'
import configStore from '../lib/configStore.js'

// Idempotent (upsert by name) — seeds one BankAccount, the GL-side
// counterpart to the bank_* GlobalSetting keys already used to show
// customers EFT instructions (see orders.js getPublicBankDetails). That
// display flow is untouched; this just gives the same real-world account a
// structured row to reconcile against, linked to the existing 1010 Bank
// chart-of-accounts entry.
const KEY_MAP = {
  bank_name: 'bankName',
  bank_holder: 'accountHolder',
  bank_account: 'accountNumber',
  bank_branch: 'branchCode',
  bank_account_type: 'accountType',
  bank_swift: 'swift'
}

async function seed() {
  console.log('Seeding default bank account...')

  const fields = {}
  for (const [settingKey, field] of Object.entries(KEY_MAP)) {
    const value = await configStore.get(settingKey, '')
    fields[field] = value ? value : null
  }

  const name = 'Primary Business Account'
  await prisma.bankAccount.upsert({
    where: { name },
    update: { ...fields, chartAccountCode: '1010' },
    create: { name, ...fields, chartAccountCode: '1010', isDefault: true }
  })

  console.log('Default bank account seeded successfully.')
}

seed()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
