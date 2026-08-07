// Finance Phase 1 — double-entry posting engine. The General Ledger
// (Journal + JournalLine) is the source of truth for money movement; every
// function here must be called with the SAME transaction client as the
// business event it represents (order paid, refund issued), so a payment can
// never succeed while its accounting entry silently fails to post.
import { resolveTaxRate, extractTaxFromInclusive } from './taxService.js'

export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

async function resolveAccountIds(tx, codes) {
  const uniqueCodes = [...new Set(codes)]
  const accounts = await tx.chartOfAccount.findMany({ where: { code: { in: uniqueCodes } } })
  const map = new Map(accounts.map(a => [a.code, a.id]))
  const missing = uniqueCodes.filter(c => !map.has(c))
  if (missing.length) {
    throw Object.assign(
      new Error(`Unknown chart of account code(s): ${missing.join(', ')} — has seed_chart_of_accounts.js been run?`),
      { status: 500 }
    )
  }
  return map
}

// Auto-provisions the calendar-month period a journal date falls in (OPEN),
// so no manual setup is required before posting can start. A period that has
// since been explicitly closed rejects new postings.
async function ensureOpenFiscalPeriod(tx, date) {
  const d = new Date(date)
  const label = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const startDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const endDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  let period = await tx.fiscalPeriod.findUnique({ where: { label } })
  if (!period) {
    try {
      period = await tx.fiscalPeriod.create({ data: { label, startDate, endDate } })
    } catch (err) {
      if (err.code === 'P2002') {
        period = await tx.fiscalPeriod.findUnique({ where: { label } })
      } else {
        throw err
      }
    }
  }

  if (period.status === 'CLOSED') {
    throw Object.assign(new Error(`Fiscal period ${label} is closed — cannot post journal`), { status: 400 })
  }
}

// Writes one balanced double-entry. `lines` is [{ accountCode, debit, credit, memo }] —
// each line must carry exactly one of debit/credit, and total debits must equal
// total credits. Journals are never edited or deleted after creation; a
// correction is a new journal that reverses the original.
export async function postJournal(tx, { sourceType, sourceId = null, date = new Date(), description, lines, postedByAdminId = null }) {
  if (!lines || lines.length === 0) {
    throw Object.assign(new Error(`postJournal requires at least one line (${description})`), { status: 500 })
  }

  const normalized = lines.map(l => ({
    accountCode: l.accountCode,
    debit: round2(l.debit || 0),
    credit: round2(l.credit || 0),
    memo: l.memo || null
  }))

  for (const l of normalized) {
    if (l.debit < 0 || l.credit < 0) {
      throw Object.assign(new Error(`Journal line for ${l.accountCode} cannot be negative (${description})`), { status: 500 })
    }
    if (l.debit > 0 && l.credit > 0) {
      throw Object.assign(new Error(`Journal line for ${l.accountCode} cannot have both a debit and a credit (${description})`), { status: 500 })
    }
    if (l.debit === 0 && l.credit === 0) {
      throw Object.assign(new Error(`Journal line for ${l.accountCode} has no amount (${description})`), { status: 500 })
    }
  }

  const totalDebit = round2(normalized.reduce((sum, l) => sum + l.debit, 0))
  const totalCredit = round2(normalized.reduce((sum, l) => sum + l.credit, 0))
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw Object.assign(
      new Error(`Journal does not balance: debits ${totalDebit} != credits ${totalCredit} (${description})`),
      { status: 500 }
    )
  }

  const accountMap = await resolveAccountIds(tx, normalized.map(l => l.accountCode))
  await ensureOpenFiscalPeriod(tx, date)

  const [{ nextval }] = await tx.$queryRawUnsafe("SELECT nextval('journal_number_seq') as nextval")
  const journalNumber = `JNL-${nextval}`

  return tx.journal.create({
    data: {
      journalNumber,
      date,
      description,
      sourceType,
      sourceId,
      postedByAdminId,
      lines: {
        create: normalized.map(l => ({
          accountId: accountMap.get(l.accountCode),
          debit: l.debit,
          credit: l.credit,
          memo: l.memo
        }))
      }
    },
    include: { lines: true }
  })
}

// Recognizes the sale (Debit AR / Credit Revenue+Shipping+VAT) and COGS —
// tied to when goods are considered sold/stock leaves the warehouse, which
// happens once per order regardless of how many installments later pay it
// off. Idempotent per order (checks for an existing ORDER_SALE journal for
// this order.id first) — callers don't need to know whether an earlier step
// already recognized the sale, only that it will exist by the time this
// returns. `order` must include `items` (for costAtPurchase).
export async function postSaleRecognitionJournal(tx, order) {
  const alreadyPosted = await tx.journal.findFirst({
    where: { sourceType: 'ORDER_SALE', sourceId: order.id },
    select: { id: true }
  })
  if (alreadyPosted) return

  const totalAmount = round2(order.totalAmount)
  const shippingCost = round2(order.shippingCost || 0)
  const taxAmount = round2(order.taxAmount || 0)
  // subtotal net of any coupon discount — totalAmount = subtotal - discount + tax + shipping
  // (see routes/orders.js), so this already excludes the discount without a
  // separate contra-revenue line.
  const goodsAmount = round2(totalAmount - shippingCost - taxAmount)

  const saleLines = [{ accountCode: '1100', debit: totalAmount, credit: 0, memo: `Order ${order.orderNumber}` }]
  if (goodsAmount > 0.001) saleLines.push({ accountCode: '4000', debit: 0, credit: goodsAmount, memo: `Order ${order.orderNumber}` })
  if (shippingCost > 0.001) saleLines.push({ accountCode: '4010', debit: 0, credit: shippingCost, memo: `Order ${order.orderNumber}` })
  if (taxAmount > 0.001) saleLines.push({ accountCode: '2100', debit: 0, credit: taxAmount, memo: `Order ${order.orderNumber}` })

  await postJournal(tx, {
    sourceType: 'ORDER_SALE',
    sourceId: order.id,
    description: `Sale recognized — Order ${order.orderNumber}`,
    lines: saleLines
  })

  // Cost data is only ever as accurate as OrderItem.costAtPurchase (the PIM
  // Phase 1 snapshot) — same honesty rule financeService.js applies via
  // costCoveragePercent: never post a COGS figure that's known to be partial.
  const items = order.items || []
  const hasFullCostData = items.length > 0 && items.every(i => i.costAtPurchase != null)
  if (hasFullCostData) {
    const cogsAmount = round2(items.reduce((sum, i) => sum + Number(i.costAtPurchase) * i.quantity, 0))
    if (cogsAmount > 0.001) {
      await postJournal(tx, {
        sourceType: 'ORDER_SALE',
        sourceId: order.id,
        description: `COGS — Order ${order.orderNumber}`,
        lines: [
          { accountCode: '5000', debit: cogsAmount, credit: 0, memo: `Order ${order.orderNumber}` },
          { accountCode: '1200', debit: 0, credit: cogsAmount, memo: `Order ${order.orderNumber}` }
        ]
      })
    }
  } else if (items.length > 0) {
    await tx.notification.create({
      data: {
        type: 'GL_COGS_INCOMPLETE',
        message: `Order ${order.orderNumber} posted to the GL without a COGS entry — one or more line items are missing cost data.`
      }
    })
  }
}

// Cash actually received against an order's Accounts Receivable balance —
// called once per payment (a milestone order calls this once per
// installment; a single-shot order calls it once, for the full amount).
export async function postCashReceiptJournal(tx, order, payment) {
  const paidAmount = round2(payment.amount ?? order.totalAmount)
  if (paidAmount <= 0) return

  await postJournal(tx, {
    sourceType: 'ORDER_PAYMENT',
    sourceId: payment.id,
    description: `Payment received — Order ${order.orderNumber}`,
    lines: [
      { accountCode: '1010', debit: paidAmount, credit: 0, memo: `Order ${order.orderNumber}` },
      { accountCode: '1100', debit: 0, credit: paidAmount, memo: `Order ${order.orderNumber}` }
    ]
  })
}

// Called from both the PayFast ITN handler (webhooks.js) and the manual EFT
// verification flow (eftPaymentService.js) — single source of truth so the
// two payment methods can never post different journal shapes for the same
// event. Only for orders paid in a single shot (sale recognition and cash
// receipt happen at the same moment); milestone/installment orders call
// postSaleRecognitionJournal once at confirmation and postCashReceiptJournal
// once per installment instead — see orderAdminService.js.
export async function postOrderPaidJournals(tx, order, payment) {
  await postSaleRecognitionJournal(tx, order)
  await postCashReceiptJournal(tx, order, payment)
}

// Finance Phase 4 — splits the refund proportionally into a sales-return
// portion and a reversal of the output VAT originally collected on THIS
// order (not today's default rate — the rate actually charged when the
// order was sold, derived from its own stored amounts, since a store's
// configured rate could change between the sale and the refund).
export async function postRefundJournal(tx, refund, order) {
  const amount = round2(refund.amount)
  if (amount <= 0) return

  const goodsAmount = round2(order.totalAmount - (order.shippingCost || 0) - (order.taxAmount || 0))
  const effectiveRate = goodsAmount > 0 && order.taxAmount > 0 ? Number(order.taxAmount) / goodsAmount : 0
  const { exTax, tax } = extractTaxFromInclusive(effectiveRate > 0 ? { rate: effectiveRate } : null, amount)

  const lines = [{ accountCode: '4900', debit: exTax, credit: 0, memo: `Refund for order ${order.orderNumber}` }]
  if (tax > 0.001) lines.push({ accountCode: '2100', debit: tax, credit: 0, memo: `Refund for order ${order.orderNumber}` })
  lines.push({ accountCode: '1010', debit: 0, credit: amount, memo: `Refund for order ${order.orderNumber}` })

  await postJournal(tx, {
    sourceType: 'REFUND',
    sourceId: refund.id,
    description: `Refund issued — Order ${order.orderNumber}`,
    lines
  })
}

// Purchase has no human-readable number (unlike Order.orderNumber) — mirrors
// the short-id convention admin_ops.js already uses in InventoryLog reasons.
const shortId = id => id.split('-')[0].toUpperCase()

// Finance Phase 2 — Accounts Payable, Phase 4 — Input VAT. Forms the
// liability at goods-received time (admin_ops.js PATCH /purchases/:id/
// receive), mirroring how postSaleRecognitionJournal forms Accounts
// Receivable at the sale side. `totalCost` is treated as VAT-INCLUSIVE (the
// real amount owed to the supplier, unchanged) and split — not added to —
// into ex-VAT Inventory cost + recoverable VAT Input, so AP still credits
// the full totalCost either way. Idempotent per purchase — safe alongside
// the route's own "already RECEIVED" guard. Always returns { taxAmount } so
// the caller can persist it on the Purchase row, even on the no-op paths
// (null/zero cost, or already posted) — the split is deterministic from
// totalCost, so recomputing it there is harmless.
export async function postPurchaseReceivedJournal(tx, purchase) {
  const totalCost = round2(purchase.totalCost || 0)
  if (totalCost <= 0) return { taxAmount: 0 }

  const taxRate = await resolveTaxRate(null)
  const { exTax, tax } = extractTaxFromInclusive(taxRate, totalCost)

  const alreadyPosted = await tx.journal.findFirst({
    where: { sourceType: 'PURCHASE_RECEIVE', sourceId: purchase.id },
    select: { id: true }
  })
  if (alreadyPosted) return { taxAmount: tax }

  const lines = [{ accountCode: '1200', debit: exTax, credit: 0, memo: `Purchase Order ${shortId(purchase.id)}` }]
  if (tax > 0.001) lines.push({ accountCode: '1150', debit: tax, credit: 0, memo: `Purchase Order ${shortId(purchase.id)}` })
  lines.push({ accountCode: '2000', debit: 0, credit: totalCost, memo: `Purchase Order ${shortId(purchase.id)}` })

  await postJournal(tx, {
    sourceType: 'PURCHASE_RECEIVE',
    sourceId: purchase.id,
    description: `Goods received — Purchase Order ${shortId(purchase.id)}`,
    lines
  })

  return { taxAmount: tax }
}

// Cash paid against a purchase's Accounts Payable balance — called once per
// SupplierPayment (a purchase may be settled in more than one payment).
export async function postSupplierPaymentJournal(tx, supplierPayment, purchase) {
  const amount = round2(supplierPayment.amount)
  if (amount <= 0) return

  await postJournal(tx, {
    sourceType: 'SUPPLIER_PAYMENT',
    sourceId: supplierPayment.id,
    description: `Supplier payment — Purchase Order ${shortId(purchase.id)}`,
    lines: [
      { accountCode: '2000', debit: amount, credit: 0, memo: `Purchase Order ${shortId(purchase.id)}` },
      { accountCode: '1010', debit: 0, credit: amount, memo: `Purchase Order ${shortId(purchase.id)}` }
    ]
  })
}

// Finance Phase 6 — reconciliation adjustment. Used when a bank statement
// line has no corresponding GL entry yet (a bank fee, interest, an
// unrecorded EFT) — posts the missing journal so it can then be matched to
// that statement line. `amount` is signed like BankTransaction.amount:
// positive = money in (debits the bank account / credits offsetAccountCode);
// negative = money out (credits the bank account / debits offsetAccountCode).
// Returns the created Journal (with lines) so the caller can pick out the
// bank-account-side line to match.
export async function postManualAdjustmentJournal(tx, { bankAccountChartCode, offsetAccountCode, amount, description, postedByAdminId = null }) {
  const signedAmount = round2(amount)
  if (signedAmount === 0) {
    throw Object.assign(new Error('Adjustment amount cannot be zero'), { status: 400 })
  }
  const absAmount = Math.abs(signedAmount)

  const lines = signedAmount > 0
    ? [
        { accountCode: bankAccountChartCode, debit: absAmount, credit: 0, memo: description },
        { accountCode: offsetAccountCode, debit: 0, credit: absAmount, memo: description }
      ]
    : [
        { accountCode: offsetAccountCode, debit: absAmount, credit: 0, memo: description },
        { accountCode: bankAccountChartCode, debit: 0, credit: absAmount, memo: description }
      ]

  return postJournal(tx, { sourceType: 'MANUAL', description, lines, postedByAdminId })
}

// Finance Phase 8 — gives the Phase 1-seeded EXPENSE chart accounts (Courier,
// Marketing, Packaging, etc.) an actual way to receive postings. Debit the
// expense account / Credit 1010 Bank (the single bank account, same scope
// call every prior phase has made).
export async function postExpenseJournal(tx, expense) {
  const amount = round2(expense.amount)
  if (amount <= 0) return

  await postJournal(tx, {
    sourceType: 'EXPENSE',
    sourceId: expense.id,
    date: expense.date,
    description: expense.description,
    lines: [
      { accountCode: expense.accountCode, debit: amount, credit: 0, memo: expense.description },
      { accountCode: '1010', debit: 0, credit: amount, memo: expense.description }
    ]
  })
}

// Finance Phase 11 — Fixed Assets. Straight-line depreciation only.
export async function postAssetAcquisitionJournal(tx, asset) {
  const amount = round2(asset.purchaseCost)
  if (amount <= 0) return

  await postJournal(tx, {
    sourceType: 'ASSET_ACQUISITION',
    sourceId: asset.id,
    date: asset.purchaseDate,
    description: `Asset acquired — ${asset.name}`,
    lines: [
      { accountCode: '1400', debit: amount, credit: 0, memo: asset.name },
      { accountCode: '1010', debit: 0, credit: amount, memo: asset.name }
    ]
  })
}

// Idempotency for a given asset+period is enforced by the caller creating a
// DepreciationEntry row first (unique on [assetId, period]) inside the same
// transaction — a unique-violation there means "already posted this period",
// checked before this ever runs (see admin_assets.js).
export async function postDepreciationJournal(tx, asset, period, amount) {
  const amt = round2(amount)
  if (amt <= 0) return

  await postJournal(tx, {
    sourceType: 'DEPRECIATION',
    sourceId: asset.id,
    description: `Depreciation — ${asset.name} (${period})`,
    lines: [
      { accountCode: '5800', debit: amt, credit: 0, memo: `${asset.name} — ${period}` },
      { accountCode: '1450', debit: 0, credit: amt, memo: `${asset.name} — ${period}` }
    ]
  })
}

// Clears the asset's original cost and accumulated depreciation off the
// books, records cash received (if any), and balances the difference to
// 5900 as a gain (credit) or loss (debit) — proceeds vs. net book value.
export async function postAssetDisposalJournal(tx, asset, proceeds, accumulatedDepreciation) {
  const proceedsAmt = round2(proceeds || 0)
  const accDep = round2(accumulatedDepreciation || 0)
  const purchaseCost = round2(asset.purchaseCost)
  const netBookValue = round2(purchaseCost - accDep)
  const gainLoss = round2(proceedsAmt - netBookValue) // positive = gain, negative = loss

  const lines = []
  if (proceedsAmt > 0.001) lines.push({ accountCode: '1010', debit: proceedsAmt, credit: 0, memo: `Disposal — ${asset.name}` })
  if (accDep > 0.001) lines.push({ accountCode: '1450', debit: accDep, credit: 0, memo: `Disposal — ${asset.name}` })
  lines.push({ accountCode: '1400', debit: 0, credit: purchaseCost, memo: `Disposal — ${asset.name}` })
  if (gainLoss > 0.001) lines.push({ accountCode: '5900', debit: 0, credit: gainLoss, memo: `Gain on disposal — ${asset.name}` })
  else if (gainLoss < -0.001) lines.push({ accountCode: '5900', debit: -gainLoss, credit: 0, memo: `Loss on disposal — ${asset.name}` })

  await postJournal(tx, {
    sourceType: 'ASSET_DISPOSAL',
    sourceId: asset.id,
    description: `Asset disposed — ${asset.name}`,
    lines
  })
}
