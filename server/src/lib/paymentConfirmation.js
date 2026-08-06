import { postOrderPaidJournals } from './accountingService.js'

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
