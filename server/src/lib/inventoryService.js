import prisma from './prisma.js'

export const RESERVATION_HOLD_MINUTES = 30

export class InsufficientStockError extends Error {
  constructor(variantId) {
    super(`Insufficient stock for variant ${variantId}`)
    this.name = 'InsufficientStockError'
    this.status = 400
    this.variantId = variantId
  }
}

// Atomically holds `quantity` units of a variant against an order, guarding
// against the checkout oversell race: the UPDATE only succeeds if enough
// unreserved stock exists, so two concurrent checkouts for the last unit
// cannot both win.
export async function reserveStock(tx, { variantId, quantity, orderId, expiresAt }) {
  const updated = await tx.$executeRaw`
    UPDATE inventory SET reserved = reserved + ${quantity}
    WHERE variant_id = ${variantId}::uuid AND quantity - reserved >= ${quantity}
  `
  if (updated === 0) throw new InsufficientStockError(variantId)

  return tx.inventoryReservation.create({
    data: { variantId, orderId, quantity, expiresAt }
  })
}

// Pushes an order's active reservations further into the future — used when
// a deposit is verified, so sweepExpiredReservations (which only acts on
// reservations whose expiresAt has already passed) leaves the order alone
// until the new deadline instead of cancelling it while a balance payment
// is still outstanding. Only ever extends: the `expiresAt: { lt }` guard
// means a reservation whose original hold already runs later than the
// proposed balance-payment window (e.g. a deposit verified minutes after
// checkout, while most of the original 72h EFT hold is still unused) is
// left untouched rather than having its expiry pulled forward.
export async function extendReservationExpiry(tx, orderId, expiresAt) {
  return tx.inventoryReservation.updateMany({
    where: { orderId, consumedAt: null, releasedAt: null, expiresAt: { lt: expiresAt } },
    data: { expiresAt }
  })
}

// Called on successful payment: moves a held reservation into a real sale —
// physical stock actually leaves the building, so `quantity` drops alongside
// `reserved`, and the sale is ledgered.
export async function consumeReservation(tx, reservation, { productName, variantSize } = {}) {
  await tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { consumedAt: new Date() }
  })

  await tx.inventory.update({
    where: { variantId: reservation.variantId },
    data: {
      quantity: { decrement: reservation.quantity },
      reserved: { decrement: reservation.quantity }
    }
  })

  await tx.inventoryLog.create({
    data: {
      variantId: reservation.variantId,
      changeType: 'SALE',
      quantityChanged: -reservation.quantity,
      reason: `Sale from Order ${reservation.orderId.split('-')[0].toUpperCase()}`,
      referenceId: reservation.orderId
    }
  })

  await checkLowStockAndNotify(tx, reservation.variantId, productName, variantSize)
}

// Called when a hold expires unused (abandoned checkout) or an order is
// cancelled before payment: gives the stock back without touching physical
// quantity, since nothing was ever actually removed from the shelf.
export async function releaseReservation(tx, reservation) {
  await tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { releasedAt: new Date() }
  })

  await tx.inventory.update({
    where: { variantId: reservation.variantId },
    data: { reserved: { decrement: reservation.quantity } }
  })
}

// The only path allowed to change on-hand quantity outside a sale: purchase
// receiving, manual corrections, and damage write-offs. Always ledgered.
export async function adjustStock(tx, { variantId, delta, changeType, reason, referenceId, productName, variantSize }) {
  const inventory = await tx.inventory.findUnique({ where: { variantId } })
  if (!inventory) throw new Error(`No inventory row for variant ${variantId}`)

  const nextQuantity = inventory.quantity + delta
  if (nextQuantity < 0) {
    throw Object.assign(new Error('Adjustment would take stock negative'), { status: 400 })
  }

  await tx.inventory.update({
    where: { variantId },
    data: { quantity: nextQuantity }
  })

  await tx.inventoryLog.create({
    data: {
      variantId,
      changeType,
      quantityChanged: delta,
      reason,
      referenceId
    }
  })

  await checkLowStockAndNotify(tx, variantId, productName, variantSize)

  return nextQuantity
}

async function checkLowStockAndNotify(tx, variantId, productName, variantSize) {
  const updated = await tx.inventory.findUnique({ where: { variantId } })
  if (!updated || updated.quantity > updated.lowStockThreshold) return

  if (!productName || !variantSize) {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true }
    })
    productName = productName || variant?.product?.name || 'Aromatic Formulation'
    variantSize = variantSize || variant?.size || ''
  }

  await tx.notification.create({
    data: {
      type: 'LOW_STOCK',
      message: `Critically Low: ${productName} (${variantSize}) stock is now at ${updated.quantity} units.`
    }
  })
}

// Cron sweep: releases expired holds and cancels the orders they belonged to
// (unless the order already paid in the meantime). Runs every few minutes —
// see server/src/index.js.
export async function sweepExpiredReservations() {
  const expired = await prisma.inventoryReservation.findMany({
    where: { expiresAt: { lt: new Date() }, consumedAt: null, releasedAt: null }
  })

  const orderIds = [...new Set(expired.map(r => r.orderId))]
  let releasedCount = 0
  let cancelledCount = 0

  for (const orderId of orderIds) {
    const reservations = expired.filter(r => r.orderId === orderId)
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } })
      if (!order) return

      for (const reservation of reservations) {
        // Re-check under the transaction in case payment landed between the
        // findMany above and now.
        const fresh = await tx.inventoryReservation.findUnique({ where: { id: reservation.id } })
        if (!fresh || fresh.consumedAt || fresh.releasedAt) continue
        await releaseReservation(tx, fresh)
        releasedCount++
      }

      if (order.paymentStatus !== 'paid' && order.status !== 'cancelled') {
        // A PayFast checkout that reached the gateway (PAYFAST_CHECKOUT_INITIATED
        // audit entry — see payfastProvider.js) but never got a Payment row is
        // exactly the failure mode that silently lost a real payment in this
        // system before (a rejected/undelivered ITN): the reservation just
        // expires and the order vanishes with no trace. Still cancel (the
        // reservation genuinely can't hold forever), but raise a loud
        // notification instead of doing this silently, so an admin can check
        // PayFast's own dashboard for that reference before it's written off.
        const [existingPayment, checkoutInitiated] = await Promise.all([
          tx.payment.findFirst({ where: { orderId } }),
          tx.auditLog.findFirst({ where: { entity: 'Order', entityId: orderId, action: 'PAYFAST_CHECKOUT_INITIATED' } }),
        ])
        if (!existingPayment && checkoutInitiated) {
          await tx.notification.create({
            data: {
              type: 'PAYFAST_ITN_NOT_RECEIVED',
              message: `Order ${order.orderNumber}: customer was redirected to PayFast but no payment confirmation ever arrived. Cancelling and releasing stock — verify with PayFast before assuming this sale genuinely failed.`
            }
          })
        }

        await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled' } })
        // Without this, an auto-cancelled order's admin-dashboard Audit Trail
        // is silently empty — there's otherwise no record anywhere of why
        // the order disappeared, which is especially confusing for a
        // PayFast order where no Payment row was ever created either (that
        // only happens once the webhook confirms success).
        await tx.auditLog.create({
          data: {
            adminUserId: null,
            action: 'AUTO_CANCEL_UNPAID_ORDER',
            entity: 'Order',
            entityId: orderId,
            details: {
              reason: 'Stock reservation hold expired before payment was confirmed',
              paymentStatus: order.paymentStatus
            }
          }
        })
        cancelledCount++
      }
    })
  }

  return { releasedCount, cancelledCount }
}
