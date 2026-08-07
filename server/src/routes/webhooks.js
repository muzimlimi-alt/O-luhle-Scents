import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { generateInvoice, sendWhatsAppNotification } from '../lib/invoiceService.js'
import { sendOrderConfirmation } from '../utils/email.js'
import { consumeReservation, reserveStock, InsufficientStockError } from '../lib/inventoryService.js'
import { confirmOrderPaid } from '../lib/paymentConfirmation.js'
import { logWebhookAttempt } from '../lib/webhookLogService.js'

import { buildSignature, isPayfastIP, validateItnWithPayfast } from '../utils/payfast.js'

const router = Router()

// The actual business logic of confirming a PayFast payment, separated from
// the route handler's security checks (IP allowlist, signature, PayFast's
// own server-side validation) so it can be exercised directly in tests
// without needing to fake being PayFast's server — those three checks are
// the only part that genuinely requires real PayFast infrastructure;
// everything here is ours to get right and ours to verify.
export async function processPayfastPayment(pfData) {
  const orderId = pfData.m_payment_id

  if (pfData.payment_status !== 'COMPLETE') {
    return { outcome: 'IGNORED_NOT_COMPLETE', orderId }
  }

  // Reconcile paid amount against our own record before touching anything.
  // The signature check proves the ITN wasn't tampered with; this catches
  // PayFast-side discrepancies (partial payment, currency mismatch, wrong
  // amount). Checked outside the transaction so the mismatch notification
  // is never rolled back.
  const orderForCheck = await prisma.order.findUnique({ where: { id: orderId } })
  if (!orderForCheck) {
    return { outcome: 'ORDER_NOT_FOUND', orderId }
  }
  if (orderForCheck.paymentStatus === 'paid') {
    return { outcome: 'ALREADY_PAID', orderId }
  }

  const expected = Number(orderForCheck.totalAmount)
  const received = Number(pfData.amount_gross)
  // Number(undefined) is NaN, and every NaN comparison is false — a
  // missing/malformed amount_gross would otherwise silently pass this
  // check instead of failing it. Treat "can't parse the amount" as a
  // mismatch, not a pass.
  if (!Number.isFinite(received) || Math.abs(expected - received) > 0.01) {
    console.error(`[ITN] Amount mismatch on order ${orderId}: expected ${expected}, received ${received}`)
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_MISMATCH',
        message: `Order ${orderId}: expected R${expected.toFixed(2)}, PayFast reported R${received.toFixed(2)}.`
      }
    })
    return { outcome: 'AMOUNT_MISMATCH', orderId, expected, received }
  }

  let stockUnavailable = false

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        reservations: { where: { consumedAt: null, releasedAt: null } }
      }
    })

    if (!order || order.paymentStatus === 'paid') return

    // 3a. Create Payment record
    const payment = await tx.payment.create({
      data: {
        orderId: orderId,
        paymentMethod: 'PayFast',
        paymentStatus: 'COMPLETE',
        transactionReference: pfData.pf_payment_id,
        amount: Number(pfData.amount_gross),
        paidAt: new Date()
      }
    })

    // 3b. Order status + GL posting — shared with manual EFT's verify
    // (eftPaymentService.js) and, later, every other gateway's webhook.
    // Runs in this same transaction so the order can never end up
    // "paid" without its GL entries.
    await confirmOrderPaid(tx, order, payment)

    await tx.auditLog.create({
      data: {
        adminUserId: null,
        action: 'PAYFAST_PAYMENT_CONFIRMED',
        entity: 'Order',
        entityId: orderId,
        details: { paymentId: payment.id, amount: payment.amount.toString(), pfPaymentId: pfData.pf_payment_id }
      }
    })

    // 3c. Consume the stock held at checkout — moves reserved units into
    // an actual sale (decrements quantity + reserved together) and logs it.
    const reservedVariantIds = new Set(order.reservations.map(r => r.variantId))
    for (const reservation of order.reservations) {
      const item = order.items.find(i => i.variantId === reservation.variantId)
      await consumeReservation(tx, reservation, {
        productName: item?.variant?.product?.name,
        variantSize: item?.variant?.size
      })
    }

    // Any item with no still-active reservation at this point is either a
    // genuine pre-reservation-era order, or — now that we know ITN delivery
    // can be delayed past the checkout hold — a late notification arriving
    // after sweepExpiredReservations already released it. Either way, claim
    // stock through the same atomic, oversell-safe path checkout itself
    // uses (reserveStock's UPDATE ... WHERE quantity - reserved >= qty)
    // rather than decrementing directly with no availability check. The
    // payment is real and already recorded above regardless of what
    // happens here — a stock shortfall becomes a fulfillment problem for
    // an admin to resolve (backorder/refund), never a reason to oversell.
    for (const item of order.items) {
      if (!item.variantId || reservedVariantIds.has(item.variantId)) continue

      const productName = item.variant?.product?.name || 'Aromatic Formulation'

      try {
        const freshReservation = await reserveStock(tx, {
          variantId: item.variantId,
          quantity: item.quantity,
          orderId: order.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        })
        await consumeReservation(tx, freshReservation, { productName, variantSize: item.variant?.size })

        const updatedInv = await tx.inventory.findUnique({ where: { variantId: item.variantId } })
        if (updatedInv.quantity <= updatedInv.lowStockThreshold) {
          await tx.notification.create({
            data: {
              type: 'LOW_STOCK',
              message: `Critically Low: ${productName} (${item.variant?.size}) stock is now at ${updatedInv.quantity} units.`
            }
          })
        }
      } catch (err) {
        if (!(err instanceof InsufficientStockError)) throw err
        stockUnavailable = true
        await tx.notification.create({
          data: {
            type: 'STOCK_UNAVAILABLE_AFTER_PAYMENT',
            message: `Order ${order.orderNumber}: payment confirmed but insufficient stock remains for ${productName} (needed ${item.quantity}). Manual action needed — backorder or refund.`
          }
        })
      }
    }
  })

  // Post-transaction automation (non-blocking, order is already paid
  // regardless of whether these succeed).
  try {
    await generateInvoice(orderId)
    await sendWhatsAppNotification(orderId, 'paid')
    await sendOrderConfirmation(orderId)
  } catch (autoErr) {
    console.error('Post-payment automation failed:', autoErr)
  }

  console.log(`Order ${orderId} finalized and stock updated.`)
  return { outcome: 'ACCEPTED', orderId, stockUnavailable }
}

// POST /api/webhooks/payfast  — Instant Transaction Notification (ITN)
router.post('/payfast', async (req, res) => {
  const pfData = req.body
  // req.ip resolves correctly through the reverse proxy — see app.set('trust proxy', 1) in index.js
  const pfIp = req.ip

  try {
    // 1. Security check: IP range
    if (!isPayfastIP(pfIp)) {
      console.error(`[ITN] Rejected: ${pfIp} is not a PayFast IP`)
      await logWebhookAttempt({ provider: 'payfast', outcome: 'REJECTED_IP', sourceIp: pfIp, orderId: pfData?.m_payment_id, payload: pfData })
      return res.status(403).send('Forbidden: Not a PayFast IP')
    }

    // 2. Verify signature
    const expectedSig = buildSignature(pfData, process.env.PAYFAST_PASSPHRASE || null, true)
    if (pfData.signature !== expectedSig) {
      console.error('[ITN] Invalid signature')
      await logWebhookAttempt({ provider: 'payfast', outcome: 'REJECTED_SIGNATURE', sourceIp: pfIp, orderId: pfData?.m_payment_id, payload: pfData })
      return res.status(400).send('Invalid signature')
    }

    // 3. Verify with PayFast servers
    const isValid = await validateItnWithPayfast(pfData)
    if (!isValid) {
      console.error('[ITN] Validation failed with PayFast servers')
      await logWebhookAttempt({ provider: 'payfast', outcome: 'REJECTED_PAYFAST_VALIDATION', sourceIp: pfIp, orderId: pfData?.m_payment_id, payload: pfData })
      return res.status(400).send('ITN validation failed')
    }

    // 4. Process — see processPayfastPayment above
    const result = await processPayfastPayment(pfData)

    if (result.outcome === 'AMOUNT_MISMATCH') {
      await logWebhookAttempt({
        provider: 'payfast', outcome: 'REJECTED_AMOUNT_MISMATCH', sourceIp: pfIp, orderId: result.orderId, payload: pfData,
        errorMessage: `expected ${result.expected}, received ${result.received}`
      })
      return res.status(400).send('Amount mismatch')
    }

    await logWebhookAttempt({ provider: 'payfast', outcome: result.outcome, sourceIp: pfIp, orderId: result.orderId, payload: pfData })
    res.status(200).send('OK')
  } catch (err) {
    console.error('PayFast ITN Error:', err)
    await logWebhookAttempt({ provider: 'payfast', outcome: 'ERROR', sourceIp: pfIp, orderId: pfData?.m_payment_id, payload: pfData, errorMessage: err.message })
    res.status(500).send('Internal Server Error')
  }
})

export default router
