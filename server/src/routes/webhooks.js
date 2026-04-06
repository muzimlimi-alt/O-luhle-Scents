import { Router } from 'express'
import crypto from 'crypto'
import https from 'https'
import prisma from '../lib/prisma.js'
import { generateInvoice, sendWhatsAppNotification } from '../lib/invoiceService.js'

const router = Router()


function generatePayfastSignature(data, passphrase) {
  const pairs = Object.entries(data)
    .filter(([k, v]) => k !== 'signature' && v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v).trim())}`)
    .join('&')

  const str = passphrase ? `${pairs}&passphrase=${encodeURIComponent(passphrase.trim())}` : pairs
  return crypto.createHash('md5').update(str).digest('hex')
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => resolve(data.trim()))
    }).on('error', reject)
  })
}

// POST /api/webhooks/payfast  — Instant Transaction Notification (ITN)
router.post('/payfast', async (req, res) => {
  try {
    const pfData = req.body

    // 1. Verify signature
    const expectedSig = generatePayfastSignature(pfData, process.env.PAYFAST_PASSPHRASE || null)
    if (pfData.signature !== expectedSig) {
      return res.status(400).send('Invalid signature')
    }

    // 2. Verify with PayFast servers
    const sandbox = process.env.PAYFAST_SANDBOX === 'true'
    const verifyHost = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'
    const queryString = Object.entries(pfData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    const verifyResult = await httpsGet(`https://${verifyHost}/eng/query/validate?${queryString}`)

    if (verifyResult !== 'VALID') {
      return res.status(400).send('ITN validation failed')
    }

    // 3. Process Success
    const orderId = pfData.m_payment_id
    if (pfData.payment_status === 'COMPLETE') {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true }
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

          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: { quantity: { decrement: item.quantity } }
          })

          await tx.inventoryLog.create({
            data: {
              variantId: item.variantId,
              changeType: 'SALE',
              quantityChanged: -item.quantity,
              reason: `Sale from Order ${orderId}`,
              referenceId: orderId
            }
          })
          
          // Create a Notification for low stock if needed
          const updatedInv = await tx.inventory.findUnique({ where: { variantId: item.variantId } })
          if (updatedInv.quantity <= updatedInv.lowStockThreshold) {
            await tx.notification.create({
              data: {
                type: 'LOW_STOCK',
                message: `Stock level for ${item.variantId} is low (${updatedInv.quantity})`
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
