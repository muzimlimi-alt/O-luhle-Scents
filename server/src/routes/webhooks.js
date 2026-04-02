import { Router } from 'express'
import crypto from 'crypto'
import https from 'https'
import prisma from '../lib/prisma.js'

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
      console.error('PayFast webhook: invalid signature')
      return res.status(400).send('Invalid signature')
    }

    // 2. Verify with PayFast servers that this ITN is legitimate
    const sandbox = process.env.PAYFAST_SANDBOX === 'true'
    const verifyHost = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'
    const queryString = Object.entries(pfData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    const verifyResult = await httpsGet(`https://${verifyHost}/eng/query/validate?${queryString}`)

    if (verifyResult !== 'VALID') {
      console.error('PayFast webhook: ITN validation failed', verifyResult)
      return res.status(400).send('ITN validation failed')
    }

    // 3. Update order status
    const orderId = pfData.m_payment_id
    if (pfData.payment_status === 'COMPLETE') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          payfastPaymentId: pfData.pf_payment_id,
        },
      })
      console.log(`Order ${orderId} marked as PAID`)
    } else if (pfData.payment_status === 'CANCELLED') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      })
    }

    res.status(200).send('OK')
  } catch (err) {
    console.error('PayFast webhook error:', err)
    res.status(500).send('Server error')
  }
})

export default router
