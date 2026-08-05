import prisma from './prisma.js'
import { postManualAdjustmentJournal } from './accountingService.js'

async function requireBankAccount(tx, bankAccountId) {
  const account = await tx.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!account) throw Object.assign(new Error('Bank account not found'), { status: 404 })
  return account
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
