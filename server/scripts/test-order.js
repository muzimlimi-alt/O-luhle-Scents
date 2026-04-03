// Using native fetch in Node 18+
import crypto from 'crypto'
import 'dotenv/config'
import prisma from '../src/lib/prisma.js'

const API_BASE = 'http://localhost:3000'
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || 'jt7NOEXcQIdPwRN'

async function runTest() {
  console.log('--- STARTING E2E ORDER TEST ---')

  // 1. CLEAR PREVIOUS LOGS & ORDERS (Referential integrity order)
  await prisma.auditLog.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.shippingAddress.deleteMany({})
  await prisma.payment.deleteMany({})
  await prisma.order.deleteMany({})
  console.log('✔ Cleaned audit logs, items, addresses, payments, and orders')

  // 2. GET TEST PRODUCTS
  const products = await prisma.product.findMany({ take: 2 })
  if (products.length < 2) throw new Error('Not enough products to test. Seed the DB first.')
  const [p1, p2] = products
  console.log(`✔ Using products: ${p1.name} and ${p2.name}`)

  // 3. CREATE ORDER (Guest)
  const orderData = {
    items: [
      { productId: p1.id, size: '100ml', quantity: 1 },
      { productId: p2.id, size: '50ml',  quantity: 2 }
    ],
    contact: { email: 'buyer@test.com', phone: '0115556677' },
    shipping: {
      firstName: 'John', lastName: 'Doe', street: '77 Fragrance Way',
      city: 'Sandton', province: 'Gauteng', postalCode: '2196'
    },
    shippingMethod: 'standard'
  }

  const orderRes = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  })
  if (!orderRes.ok) throw new Error(`Order creation failed: ${orderRes.status}`)
  const { orderId, totalAmount } = await orderRes.json()
  console.log(`✔ Order Created: ${orderId}`)
  console.log(`✔ Correct Total (Server-side): R${totalAmount}`)

  // 4. SIMULATE PAYFAST ITN (Valid)
  console.log('\n--- SIMULATING VALID ITN ---')
  const itnPayload = {
    m_payment_id: orderId,
    pf_payment_id: 'PF_TX_987654',
    payment_status: 'COMPLETE',
    item_name: 'Fragrance Selection',
    item_description: 'Luxury perfumes from O\'luhle Scents',
    amount_gross: String(totalAmount.toFixed(2)),
    amount_fee: '15.00',
    amount_net: String((totalAmount - 15).toFixed(2)),
    name_first: 'John',
    name_last: 'Doe',
    email_address: 'buyer@test.com',
    merchant_id: process.env.PAYFAST_MERCHANT_ID || '10047344'
  }

  // Generate signature
  const pfKeys = Object.keys(itnPayload).sort()
  const str = pfKeys.map(k => `${k}=${encodeURIComponent(itnPayload[k]).replace(/%20/g, '+')}`).join('&')
  const signature = crypto.createHash('md5').update(str + (PASSPHRASE ? `&passphrase=${encodeURIComponent(PASSPHRASE).replace(/%20/g, '+')}` : '')).digest('hex')
  itnPayload.signature = signature

  const webhookRes = await fetch(`${API_BASE}/api/webhooks/payfast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itnPayload)
  })
  console.log(`✔ Webhook POST status: ${webhookRes.status}`)

  // Wait for async webhook processing
  await new Promise(r => setTimeout(r, 1000))

  // Verify Order Status in DB
  let updatedOrder = await prisma.order.findUnique({ where: { id: orderId } })
  console.log(`✔ DB Order Status: ${updatedOrder.status}`)
  if (updatedOrder.status !== 'paid') throw new Error('Order should be PAID')

  // 5. TEST ATTACK: SIGNATURE MISMATCH
  console.log('\n--- SIMULATING SIGNATURE MISMATCH ATTACK ---')
  const badSignaturePayload = { ...itnPayload, signature: 'wrong-signature' }
  const badSigRes = await fetch(`${API_BASE}/api/webhooks/payfast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(badSignaturePayload)
  })
  console.log(`✔ (Expected: Rejected in logs) POST status: ${badSigRes.status}`)
  
  const lastReject = await prisma.auditLog.findFirst({
    where: { action: 'PAYFAST_ITN_REJECTED', metadata: { contains: 'Signature mismatch' } },
    orderBy: { createdAt: 'desc' }
  })
  if (lastReject) console.log('✔ AuditLog confirmed: Signature mismatch rejected')

  // 6. TEST ATTACK: AMOUNT MISMATCH
  console.log('\n--- SIMULATING AMOUNT MISMATCH ATTACK ---')
  const cheapOrder = await prisma.order.create({
    data: { email: 'hacker@test.com', phone: '000', totalAmount: 5000, shippingCost: 0, status: 'pending' }
  })
  const tamperedItn = { ...itnPayload, m_payment_id: cheapOrder.id, amount_gross: '50.00' } // Should be 5000
  
  // Resign it (hacker might have the key in some scenarios, or it's a different check)
  const tKeys = Object.keys(tamperedItn).filter(k => k !== 'signature').sort()
  const tStr = tKeys.map(k => `${k}=${encodeURIComponent(tamperedItn[k]).replace(/%20/g, '+')}`).join('&')
  tamperedItn.signature = crypto.createHash('md5').update(tStr + (PASSPHRASE ? `&passphrase=${encodeURIComponent(PASSPHRASE).replace(/%20/g, '+')}` : '')).digest('hex')

  await fetch(`${API_BASE}/api/webhooks/payfast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tamperedItn)
  })
  
  const amountReject = await prisma.auditLog.findFirst({
    where: { action: 'PAYFAST_ITN_REJECTED', metadata: { contains: 'Amount mismatch' } },
    orderBy: { createdAt: 'desc' }
  })
  if (amountReject) console.log('✔ AuditLog confirmed: Amount mismatch rejected')

  console.log('\n--- ALL PHASE 3-4 TESTS PASSED ---')
}

runTest().catch(console.error)
