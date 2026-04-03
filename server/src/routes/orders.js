import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { buildSignature } from '../utils/payfast.js'

const router = Router()

const SHIPPING_COSTS = { standard: 99, express: 199 }

// PayFast signature generation is now handled in utils/payfast.js

// POST /api/orders  — create order + return PayFast payment data
router.post('/', async (req, res, next) => {
  try {
    console.log('--- New Order Request ---')
    console.log('Payload:', JSON.stringify(req.body, null, 2))
    const { items, contact, shipping, shippingMethod } = req.body

    // --- Validate inputs ---
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' })
    if (!contact?.email || !contact?.phone) return res.status(400).json({ error: 'Contact info required' })
    if (!shipping?.firstName || !shipping?.lastName || !shipping?.street ||
        !shipping?.city || !shipping?.province || !shipping?.postalCode) {
      return res.status(400).json({ error: 'Complete shipping address required' })
    }
    if (!SHIPPING_COSTS[shippingMethod]) {
      return res.status(400).json({ error: 'Invalid shipping method' })
    }

    // --- Look up products from DB (never trust frontend prices) ---
    const productIds = items.map(i => parseInt(i.productId || i.id)).filter(id => !isNaN(id))
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    })

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable' })
    }

    // --- Build order items with server-side prices ---
    let subtotal = 0
    const orderItems = items.map(item => {
      if (!['100ml', '50ml'].includes(item.size)) throw Object.assign(new Error('Invalid size'), { status: 400 })
      const productId = parseInt(item.productId || item.id)
      const product = products.find(p => p.id === productId)
      if (!product) throw new Error('Product not found in available list')
      const unitPrice = item.size === '100ml' ? product.price100ml : product.price50ml
      const quantity = parseInt(item.quantity || item.qty) || 0
      subtotal += unitPrice * quantity
      return { productId: product.id, size: item.size, qty: quantity, unitPrice }
    })

    const shippingCost = SHIPPING_COSTS[shippingMethod]
    const total = subtotal + shippingCost

    // --- Persist order ---
    const order = await prisma.order.create({
      data: {
        email: contact.email.toLowerCase().trim(),
        phone: contact.phone.trim(),
        subtotal,
        shippingCost,
        total,
        shippingMethod,
        items: { create: orderItems },
        shippingAddress: {
          create: {
            firstName: shipping.firstName,
            lastName:  shipping.lastName,
            street:    shipping.street,
            apartment: shipping.apartment || '',
            city:      shipping.city,
            province:  shipping.province,
            postalCode: shipping.postalCode,
          },
        },
      },
    })

    // --- Build PayFast payment data ---
    const sandbox = process.env.PAYFAST_SANDBOX === 'true'
    const payfastUrl = sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process'

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500'
    const serverUrl   = process.env.SERVER_URL   || 'http://localhost:3000'

    const payfastData = {
      merchant_id:   process.env.PAYFAST_MERCHANT_ID,
      merchant_key:  process.env.PAYFAST_MERCHANT_KEY,
      return_url:    `${frontendUrl}/checkout-success.html?order=${order.id}`,
      cancel_url:    `${frontendUrl}/checkout.html`,
      notify_url:    `${serverUrl}/api/webhooks/payfast`,
      name_first:    shipping.firstName,
      name_last:     shipping.lastName,
      email_address: contact.email,
      m_payment_id:  order.id,
      amount:        total.toFixed(2),
      item_name:     "Oluhle Scents Order",
    }

    payfastData.signature = buildSignature(
      payfastData,
      process.env.PAYFAST_PASSPHRASE || null,
      false
    )

    res.status(201).json({ orderId: order.id, payfastUrl, payfastData })
  } catch (err) {
    next(err)
  }
})

// GET /api/orders/:id  — order confirmation lookup
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } }, shippingAddress: true },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// GET /api/orders  — admin: list all orders
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { shippingAddress: true, items: true },
    })
    res.json(orders)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/orders/:id/status  — admin: update order status
router.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const validStatuses = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    const { status } = req.body
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` })
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

export default router
