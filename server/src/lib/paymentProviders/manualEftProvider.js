import prisma from '../prisma.js'
import configStore from '../configStore.js'
import { resolveDefaultBankAccount } from '../bankingService.js'
import { sendEftInstructions } from '../../utils/email.js'
import { round2 } from '../accountingService.js'

export const key = 'manual_eft'
export const displayName = 'Manual EFT'

// Maps a BankAccount row to the flat shape the storefront/email template
// already expect (unchanged since the GlobalSetting-based version this
// replaces) — so nothing downstream of this needs to change. Exported so
// paymentReminderService.js can build the same shape from an order's
// pinned Payment.bankAccount without duplicating this mapping.
export function bankAccountToPublicShape(account) {
  if (!account) return { bank_name: '', bank_holder: '', bank_account: '', bank_branch: '', bank_account_type: '', bank_swift: '' }
  return {
    bank_name: account.bankName || '',
    bank_holder: account.accountHolder || '',
    bank_account: account.accountNumber || '',
    bank_branch: account.branchCode || '',
    bank_account_type: account.accountType || '',
    bank_swift: account.swift || ''
  }
}

// Also used by routes/orders.js's GET /eft/bank-details (public,
// pre-checkout instructions endpoint) — resolves whichever BankAccount is
// currently flagged default. Safe to return empty strings if none is
// configured; this is informational, not a purchase action.
export async function getPublicBankDetails() {
  return bankAccountToPublicShape(await resolveDefaultBankAccount())
}

// A bank transfer can take days to clear, unlike PayFast's near-instant
// confirmation — admin-tunable via the eft_reservation_hours GlobalSetting
// (default 72h), same as before this refactor.
export async function reservationHoldMinutes() {
  return Number(await configStore.get('eft_reservation_hours', '72')) * 60
}

// Also used by routes/orders.js's GET /eft/deposit-config (checkout.html
// reads this to decide whether to offer a deposit option at all).
export async function getDepositConfig() {
  return {
    enabled: (await configStore.get('eft_deposit_enabled', 'false')) === 'true',
    percentage: Number(await configStore.get('eft_deposit_percentage', '50'))
  }
}

// Manual EFT gets its Payment row created immediately (unlike PayFast,
// whose Payment row is only created once the webhook confirms success) so
// there's somewhere to attach proof-of-payment and track verification
// status from the moment the order is placed. Also pins bankAccountId to
// whichever account is currently default — so the instructions this order
// shows stay correct even if the default changes later (see
// buildCheckoutResponse below, which reads this pinned value back).
//
// context.payDeposit (Partial Payments phase): if the customer chose to pay
// only a deposit and deposits are currently enabled, this Payment's amount
// is the deposit portion, not the full order total. The balance becomes a
// second Payment row, created once the deposit is verified — see
// eftPaymentService.js's verifyPayment/recordEftPaymentReceived.
export async function onOrderCreated(tx, order, context = {}) {
  const bankAccount = await resolveDefaultBankAccount(tx)
  if (!bankAccount) {
    throw Object.assign(new Error('Manual EFT is temporarily unavailable — no active bank account is configured.'), { status: 503 })
  }

  let amount = order.totalAmount
  if (context.payDeposit) {
    const { enabled, percentage } = await getDepositConfig()
    if (enabled) amount = round2(Number(order.totalAmount) * percentage / 100)
  }

  const eftPayment = await tx.payment.create({
    data: {
      orderId: order.id,
      paymentMethod: 'manual_eft',
      paymentStatus: 'PENDING',
      amount,
      eftVerificationStatus: 'PENDING_PROOF',
      bankAccountId: bankAccount.id,
    }
  })
  await tx.paymentStatusHistory.create({
    data: { paymentId: eftPayment.id, status: 'PENDING_PROOF', actorType: 'system', note: 'Order placed, awaiting EFT payment' }
  })
}

// No gateway redirect — respond with bank details and the order's own
// reference, and fire the instructions email (fire-and-forget, exactly as
// before this refactor). Reads the account pinned at checkout time (not
// today's default) so instructions never drift from what was promised.
// amountDue reflects this specific payment (deposit or full) — distinct
// from `amount`, which stays the order's full total.
export async function buildCheckoutResponse(order, _context) {
  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, paymentMethod: 'manual_eft' },
    include: { bankAccount: true }
  })
  const bankDetails = bankAccountToPublicShape(payment?.bankAccount)
  sendEftInstructions(order.id, bankDetails, payment?.amount).catch(e => console.error('[EFT] sendEftInstructions failed:', e.message))

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentMethod: 'manual_eft',
    bankDetails,
    reference: order.orderNumber,
    amount: order.totalAmount,
    amountDue: payment?.amount ?? order.totalAmount,
  }
}
