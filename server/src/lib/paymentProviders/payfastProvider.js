import prisma from '../prisma.js'
import { buildPaymentPayload } from '../../utils/payfast.js'
import { RESERVATION_HOLD_MINUTES } from '../inventoryService.js'

export const key = 'payfast'
export const displayName = 'PayFast'

// Fixed, short hold — PayFast confirms near-instantly via webhook, unlike a
// bank transfer which can take days to clear (see manualEftProvider.js).
export async function reservationHoldMinutes() {
  return RESERVATION_HOLD_MINUTES
}

// No-op — PayFast's Payment row isn't created until routes/webhooks.js's
// ITN handler confirms success, exactly as before this refactor. Kept as an
// explicit function (not simply omitted from the registry) so every
// provider has the same shape and orders.js never needs to special-case
// "this one doesn't do anything here".
export async function onOrderCreated(_tx, _order, _context) {}

// Builds the redirect payload the frontend auto-submits to PayFast. Byte-
// for-byte the same call orders.js made inline before this refactor.
export function buildCheckoutResponse(order, context) {
  const { payfastUrl, payfastData } = buildPaymentPayload({
    id: order.id,
    totalAmount: order.totalAmount,
    email: context.contact.email,
    shippingAddress: {
      firstName: context.shipping.firstName,
      lastName: context.shipping.lastName
    }
  })

  // Fire-and-forget: a trace that the redirect was actually built, so an
  // order that never gets a Payment row (ITN never arrives) still has SOME
  // record it reached this point — otherwise there's no way to tell "the
  // customer never got a PayFast redirect" apart from "they did, but the
  // ITN never landed" after the fact. Runs post-commit (this function has
  // no transaction — the order already exists), so it uses prisma directly.
  prisma.auditLog.create({
    data: {
      adminUserId: null,
      action: 'PAYFAST_CHECKOUT_INITIATED',
      entity: 'Order',
      entityId: order.id,
      details: { amount: payfastData.amount, m_payment_id: payfastData.m_payment_id }
    }
  }).catch(e => console.error('[PayFast] audit log write failed:', e.message))

  return { orderId: order.id, payfastUrl, payfastData }
}
