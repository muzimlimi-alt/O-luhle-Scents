import { postOrderPaidJournals, postSaleRecognitionJournal, postCashReceiptJournal, round2 } from './accountingService.js'

// Called with the SAME transaction as the caller's own confirmation logic
// (PayFast's ITN handler in routes/webhooks.js, manual EFT's admin verify
// in eftPaymentService.js — and, later, Ozow/Peach's webhooks), so an order
// can never end up "paid" without its GL entries.
//
// Deliberately scoped to ONLY the two steps identical across every existing
// confirmation path — reservation consumption stays with each caller.
// PayFast's webhook needs a defensive fallback (direct inventory decrement)
// for orders placed before the reservation system existed; manual EFT was
// introduced after reservations already existed, so no manual-EFT order can
// predate them and it never needed that fallback. Folding reservation
// consumption in here would paper over that real difference instead of
// removing genuine duplication.
export async function confirmOrderPaid(tx, order, payment) {
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'paid', paymentStatus: 'paid' }
  })
  await postOrderPaidJournals(tx, order, payment)
}

// Manual EFT's admin-verify path calls this instead of confirmOrderPaid
// directly, since a verified EFT payment might be a deposit rather than
// full settlement (Partial Payments phase). `totalPaid` is the caller's
// own sum of COMPLETE payments across the whole order, including this one.
//
// Fully paid: identical to the single-shot case — confirmOrderPaid already
// handles "this payment completes the order" correctly whether it's the
// only payment or the final installment (postSaleRecognitionJournal is
// idempotent, postCashReceiptJournal only ever posts this payment's own
// amount), so nothing there needs to change.
//
// Still partial: post the same two journals confirmOrderPaid would have
// (sale recognition idempotently, cash receipt for this payment's amount),
// but leave the order at paymentStatus 'partially_paid' / status 'pending'
// — reservation consumption, invoicing, and notifications all wait for the
// balance. The caller (eftPaymentService.js) is responsible for extending
// the stock hold and spawning the balance Payment row.
export async function recordEftPaymentReceived(tx, order, payment, totalPaid) {
  if (totalPaid >= Number(order.totalAmount) - 0.005) {
    await confirmOrderPaid(tx, order, payment)
    return { fullyPaid: true }
  }

  await postSaleRecognitionJournal(tx, order)
  await postCashReceiptJournal(tx, order, payment)
  await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'partially_paid' } })

  return { fullyPaid: false, remainingBalance: round2(Number(order.totalAmount) - totalPaid) }
}
