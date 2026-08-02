import { Router } from 'express'
import crypto from 'crypto'
import https from 'https'
import prisma from '../lib/prisma.js'
import { generateInvoice, sendWhatsAppNotification } from '../lib/invoiceService.js'
import { consumeReservation } from '../lib/inventoryService.js'

import { buildSignature, isPayfastIP, validateItnWithPayfast } from '../utils/payfast.js'

const router = Router()

// POST /api/webhooks/payfast  — Instant Transaction Notification (ITN)
router.post('/payfast', async (req, res) => {
  try {
    const pfData = req.body
    // req.ip resolves correctly through the reverse proxy — see app.set('trust proxy', 1) in index.js
    const pfIp = req.ip

    // 1. Security check: IP range
    if (!isPayfastIP(pfIp)) {
      console.error(`[ITN] Rejected: ${pfIp} is not a PayFast IP`)
      return res.status(403).send('Forbidden: Not a PayFast IP')
    }

    // 2. Verify signature
    const expectedSig = buildSignature(pfData, process.env.PAYFAST_PASSPHRASE || null, true)
    if (pfData.signature !== expectedSig) {
      console.error('[ITN] Invalid signature')
      return res.status(400).send('Invalid signature')
    }

    // 3. Verify with PayFast servers
    const isValid = await validateItnWithPayfast(pfData)
    if (!isValid) {
      console.error('[ITN] Validation failed with PayFast servers')
      return res.status(400).send('ITN validation failed')
    }

    // 3. Process Success
    const orderId = pfData.m_payment_id
    if (pfData.payment_status === 'COMPLETE') {
      // Reconcile paid amount against our own record before touching anything.
      // The signature check proves the ITN wasn't tampered with; this catches
      // PayFast-side discrepancies (partial payment, currency mismatch, wrong
      // amount). Checked outside the transaction so the mismatch notification
      // is never rolled back.
      const orderForCheck = await prisma.order.findUnique({ where: { id: orderId } })
      if (orderForCheck && orderForCheck.paymentStatus !== 'paid') {
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
          return res.status(400).send('Amount mismatch')
        }
      }

      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { variant: { include: { product: true } } } },
            reservations: { where: { consumedAt: null, releasedAt: null } }
          }
        })

        if (!order || order.paymentStatus === 'paid') return

        // 3a. Update Order
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'paid',
            paymentStatus: 'paid'
          }
        })

        // 3b. Create Payment record
        await tx.payment.create({
          data: {
            orderId: orderId,
            paymentMethod: 'PayFast',
            paymentStatus: 'COMPLETE',
            transactionReference: pfData.pf_payment_id,
            amount: Number(pfData.amount_gross),
            paidAt: new Date()
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

        // Defensive fallback for orders placed before reservations existed
        // (no InventoryReservation row for the item): decrement directly.
        for (const item of order.items) {
          if (!item.variantId || reservedVariantIds.has(item.variantId)) continue

          const productName = item.variant?.product?.name || 'Aromatic Formulation'

          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: { quantity: { decrement: item.quantity } }
          })

          await tx.inventoryLog.create({
            data: {
              variantId: item.variantId,
              changeType: 'SALE',
              quantityChanged: -item.quantity,
              reason: `Sale from Order ${orderId.split('-')[0].toUpperCase()}`,
              referenceId: orderId
            }
          })

          const updatedInv = await tx.inventory.findUnique({ where: { variantId: item.variantId } })
          if (updatedInv.quantity <= updatedInv.lowStockThreshold) {
            await tx.notification.create({
              data: {
                type: 'LOW_STOCK',
                message: `Critically Low: ${productName} (${item.variant.size}) stock is now at ${updatedInv.quantity} units.`
              }
            })
          }
        }
      })
      
      // Post-transaction automation (Non-blocking)
      try {
        await generateInvoice(orderId)
        await sendWhatsAppNotification(orderId, 'paid')
      } catch (autoErr) {
        console.error('Post-payment automation failed:', autoErr)
      }

      console.log(`Order ${orderId} finalized and stock updated.`)
    }


    res.status(200).send('OK')
  } catch (err) {
    console.error('PayFast ITN Error:', err)
    res.status(500).send('Internal Server Error')
  }
})

export default router
