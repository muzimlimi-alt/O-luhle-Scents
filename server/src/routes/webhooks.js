import { Router } from 'express'
import crypto from 'crypto'
import https from 'https'
import prisma from '../lib/prisma.js'
import { generateInvoice, sendWhatsAppNotification } from '../lib/invoiceService.js'

import { buildSignature, isPayfastIP, validateItnWithPayfast } from '../utils/payfast.js'

const router = Router()

// POST /api/webhooks/payfast  — Instant Transaction Notification (ITN)
router.post('/payfast', async (req, res) => {
  try {
    const pfData = req.body
    const pfIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress

    // 1. Security check: IP range (Wait: proxy might change this, but good for production)
    // if (!isPayfastIP(pfIp)) return res.status(403).send('Forbidden: Not a PayFast IP')

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
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { 
            items: { include: { variant: { include: { product: true } } } } 
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

        // 3c. Deduct Inventory & Log
        for (const item of order.items) {
          if (!item.variantId) continue

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
          
          // Create a Notification for low stock if needed
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
