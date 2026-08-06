import prisma from './prisma.js'
import { postManualAdjustmentJournal } from './accountingService.js'

async function requireBankAccount(tx, bankAccountId) {
  const account = await tx.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!account) throw Object.assign(new Error('Bank account not found'), { status: 404 })
  return account
}

// The single place "which account is authoritative right now" gets decided —
// used both for checkout-time EFT instructions and the pre-checkout public
// bank-details endpoint. Accepts an optional tx client so callers can resolve
// it inside their own transaction (e.g. manualEftProvider.onOrderCreated).
export async function resolveDefaultBankAccount(client = prisma) {
  return client.bankAccount.findFirst({ where: { isActive: true, isDefault: true } })
}

// Atomic exclusivity: exactly one BankAccount can be isDefault at a time.
// Reactivates the target on purpose — marking an inactive account default
// should un-hide it, not leave the system with a default nobody can see.
export async function setDefaultBankAccount(bankAccountId) {
  return prisma.$transaction(async (tx) => {
    await requireBankAccount(tx, bankAccountId)
    await tx.bankAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    return tx.bankAccount.update({ where: { id: bankAccountId }, data: { isDefault: true, isActive: true } })
  })
}

// Deactivating the current default would silently break EFT checkout (no
// resolvable account) — same class of bug this phase exists to fix, so it's
// refused outright rather than left to happen by accident.
export async function setBankAccountActive(bankAccountId, isActive) {
  const account = await requireBankAccount(prisma, bankAccountId)
  if (!isActive && account.isDefault) {
    throw Object.assign(new Error('Cannot deactivate the default account — set another as default first.'), { status: 400 })
  }
  return prisma.bankAccount.update({ where: { id: bankAccountId }, data: { isActive } })
}

function dedupeKey({ date, description, amount, reference }) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.toISOString().slice(0, 10)}|${description.trim().toLowerCase()}|${Number(amount).toFixed(2)}|${reference || ''}`
}

// Bulk statement import (server/src/lib/bankStatementImport.js hands this
// already-mapped { date, description, amount, reference } rows). A single
// range query instead of one query per row — statements can be a few
// hundred lines. Dedup is a heuristic on (date, description, amount,
// reference), not a DB constraint: a hard unique constraint would wrongly
// reject two genuinely identical same-day transactions (e.g. two identical
// bank fees). Re-uploading an overlapping statement range is the expected
// way this gets used, so this dedup is the actual point of the feature.
export async function importBankTransactions(bankAccountId, rows) {
  await requireBankAccount(prisma, bankAccountId)
  if (!rows.length) return { imported: 0, skippedDuplicates: 0 }

  const dates = rows.map(r => r.date.getTime())
  const existing = await prisma.bankTransaction.findMany({
    where: { bankAccountId, date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates)) } }
  })
  const existingKeys = new Set(existing.map(dedupeKey))

  const toInsert = rows.filter(r => !existingKeys.has(dedupeKey(r)))
  if (toInsert.length) {
    await prisma.bankTransaction.createMany({
      data: toInsert.map(r => ({ bankAccountId, date: r.date, description: r.description, amount: r.amount, reference: r.reference }))
    })
  }

  return { imported: toInsert.length, skippedDuplicates: rows.length - toInsert.length }
}

// One row per bank-statement line, entered manually.
export async function createBankTransaction(bankAccountId, { date, description, amount, reference }) {
  await requireBankAccount(prisma, bankAccountId)
  return prisma.bankTransaction.create({
    data: {
      bankAccountId,
      date: new Date(date),
      description,
      amount,
      reference: reference || null
    }
  })
}

// Matching is a human judgment call, not a hard validation — no strict
// amount-equality requirement. Only checks the journal line actually belongs
// to the same GL account this bank account represents, and that neither
// side is already matched to something else.
export async function matchTransaction(transactionId, journalLineId) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.bankTransaction.findUnique({ where: { id: transactionId }, include: { bankAccount: true } })
    if (!transaction) throw Object.assign(new Error('Bank transaction not found'), { status: 404 })
    if (transaction.matchedJournalLineId) {
      throw Object.assign(new Error('This bank transaction is already matched'), { status: 400 })
    }

    const line = await tx.journalLine.findUnique({ where: { id: journalLineId }, include: { account: true } })
    if (!line) throw Object.assign(new Error('Journal line not found'), { status: 404 })
    if (line.account.code !== transaction.bankAccount.chartAccountCode) {
      throw Object.assign(new Error('That journal line was not posted to this bank account'), { status: 400 })
    }

    return tx.bankTransaction.update({
      where: { id: transactionId },
      data: { status: 'MATCHED', matchedJournalLineId: journalLineId }
    })
  })
}

export async function unmatchTransaction(transactionId) {
  const transaction = await prisma.bankTransaction.findUnique({ where: { id: transactionId } })
  if (!transaction) throw Object.assign(new Error('Bank transaction not found'), { status: 404 })

  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: { status: 'UNMATCHED', matchedJournalLineId: null }
  })
}

// "Explain this bank-only line" — posts the missing journal (e.g. a bank
// fee that was never recorded as an expense) and matches it to the
// transaction in one step.
export async function createAdjustmentAndMatch(transactionId, { offsetAccountCode, description, adminUserId }) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.bankTransaction.findUnique({ where: { id: transactionId }, include: { bankAccount: true } })
    if (!transaction) throw Object.assign(new Error('Bank transaction not found'), { status: 404 })
    if (transaction.matchedJournalLineId) {
      throw Object.assign(new Error('This bank transaction is already matched'), { status: 400 })
    }

    const journal = await postManualAdjustmentJournal(tx, {
      bankAccountChartCode: transaction.bankAccount.chartAccountCode,
      offsetAccountCode,
      amount: transaction.amount,
      description: description || transaction.description,
      postedByAdminId: adminUserId
    })

    const bankAccountRow = await tx.chartOfAccount.findUnique({ where: { code: transaction.bankAccount.chartAccountCode } })
    const bankLine = journal.lines.find(l => l.accountId === bankAccountRow.id)

    return tx.bankTransaction.update({
      where: { id: transactionId },
      data: { status: 'MATCHED', matchedJournalLineId: bankLine.id }
    })
  })
}

// The two unmatched lists — the whole point of reconciliation. Deliberately
// no "statement balance vs. book balance" figure here: that would imply a
// completeness guarantee (that every statement line was entered) this
// system can't verify, the same honesty stance financeService.js's
// costCoveragePercent and the Phase 1 GL_COGS_INCOMPLETE notification take.
export async function getReconciliation(bankAccountId, { from, to } = {}) {
  const bankAccount = await requireBankAccount(prisma, bankAccountId)
  const chartAccount = await prisma.chartOfAccount.findUnique({ where: { code: bankAccount.chartAccountCode } })

  const dateWhere = {}
  if (from) dateWhere.gte = new Date(from)
  if (to) dateWhere.lte = new Date(to)

  const unmatchedTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId,
      status: 'UNMATCHED',
      ...(from || to ? { date: dateWhere } : {})
    },
    orderBy: { date: 'asc' }
  })

  const unmatchedJournalLines = await prisma.journalLine.findMany({
    where: {
      accountId: chartAccount.id,
      matchedByBankTransaction: null,
      ...(from || to ? { journal: { date: dateWhere } } : {})
    },
    include: { journal: true },
    orderBy: { journal: { date: 'asc' } }
  })

  return { bankAccount, unmatchedTransactions, unmatchedJournalLines }
}
