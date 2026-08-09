import prisma from '../lib/prisma.js'

// Idempotent — upserts by code, safe to re-run. Seeds the full recommended
// structure now (Finance Phase 1 only posts to a subset of these) so a later
// phase (AP, Banking, Tax, Fixed Assets, Budgeting) doesn't need a second
// migration just to add accounts.
const ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Cash', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1010', name: 'Bank', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1150', name: 'VAT Input (Recoverable)', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1200', name: 'Inventory', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1400', name: 'Fixed Assets', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1450', name: 'Accumulated Depreciation', type: 'ASSET', normalBalance: 'CREDIT' }, // contra-asset

  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2100', name: 'VAT Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2200', name: 'Customer Deposits', type: 'LIABILITY', normalBalance: 'CREDIT' },

  // Equity
  { code: '3000', name: 'Owner Equity', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT' },

  // Revenue
  { code: '4000', name: 'Product Sales', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '4010', name: 'Shipping Revenue', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '4800', name: 'Discounts Given', type: 'REVENUE', normalBalance: 'DEBIT' }, // contra-revenue, same pattern as 4900
  { code: '4900', name: 'Sales Returns & Allowances', type: 'REVENUE', normalBalance: 'DEBIT' },

  // Expenses
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5100', name: 'Courier Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5200', name: 'Merchant Fees', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5300', name: 'Marketing', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5400', name: 'Salaries', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5500', name: 'Packaging', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5600', name: 'Rent', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5700', name: 'Utilities', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5800', name: 'Depreciation Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5900', name: 'Loss/Gain on Asset Disposal', type: 'EXPENSE', normalBalance: 'DEBIT' } // a gain posts as a credit
]

async function seed() {
  console.log('Seeding chart of accounts...')

  for (const account of ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      update: { name: account.name, type: account.type, normalBalance: account.normalBalance },
      create: { ...account, isSystem: true }
    })
  }

  console.log(`Chart of accounts seeded successfully (${ACCOUNTS.length} accounts).`)
}

seed()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
