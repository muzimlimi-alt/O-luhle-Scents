import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { buildSignature, buildPaymentPayload } from '../utils/payfast.js'

import { calculateShipping } from '../lib/shippingService.js'

const router = Router()

// GET /api/shipping/estimate
router.get('/shipping/estimate', async (req, res, next) => {
  try {
    const { country = 'South Africa', postalCode, subtotal } = req.query
    const cost = await calculateShipping(country, postalCode || '', subtotal || 0)
    res.json({ cost })
  } catch (err) { next(err) }
})

// POST /api/orders  — create order + return PayFast payment data
router.post('/', async (req, res, next) => {
  try {
    const { items, contact, shipping, shippingMethod } = req.body

    // 1. Basic validation
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' })
    if (!contact?.email) return res.status(400).json({ error: 'Email required' })

    // 2. Fetch variants and validate stock
    const variantIds = items.map(i => i.variantId).filter(Boolean)
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true, inventory: true }
    })

    if (variants.length !== variantIds.length) {
      return res.status(400).json({ error: 'One or more items are no longer available.' })
    }

    let subtotal = 0
    const finalItems = items.map(cartItem => {
      const variant = variants.find(v => v.id === cartItem.variantId)
      if (!variant) throw new Error('Variant not found')
      
      // Stock check
      if (variant.inventory.quantity < cartItem.quantity) {
        throw Object.assign(new Error(`Insufficent stock for ${variant.product.name}`), { status: 400 })
      }

      const price = Number(variant.price)
      subtotal += price * cartItem.quantity

      return {
        variantId: variant.id,
        quantity: cartItem.quantity,
        priceAtPurchase: price
      }
    })

    // Dynamic Shipping
    const shippingCost = await calculateShipping(shipping.country || 'South Africa', shipping.postalCode || '', subtotal)
    const totalAmount = subtotal + shippingCost

    // 3. Create/Update Customer & Store Order in Transaction
    const order = await prisma.$transaction(async (tx) => {
      // Find or create customer
      let customer = await tx.customer.findUnique({ where: { email: contact.email.toLowerCase() } })
      if (!customer) {
        customer = await tx.customer.create({
          data: { email: contact.email.toLowerCase(), name: shipping.firstName + ' ' + shipping.lastName, phone: contact.phone }
        })
      }

      // Create address
      const address = await tx.address.create({
        data: {
          customerId: customer.id,
          street: shipping.street,
          city: shipping.city,
          province: shipping.province,
          postalCode: shipping.postalCode,
          country: shipping.country || 'South Africa',
          isDefault: false
        }
      })

      // Create Order
      return tx.order.create({
        data: {
          customerId: customer.id,
          shippingAddressId: address.id,
          totalAmount: totalAmount,
          shippingCost: shippingCost,
          status: 'pending',
          paymentStatus: 'unpaid',
          notes: req.body.notes || '',
          items: {
            create: finalItems
          }
        }
      })
    })

    // 4. Build PayFast data using centralized utility
    const { payfastUrl, payfastData } = buildPaymentPayload({
      id: order.id,
      totalAmount: order.totalAmount,
      email: contact.email,
      shippingAddress: { 
        firstName: shipping.firstName, 
        lastName: shipping.lastName 
      }
    })

    res.status(201).json({ orderId: order.id, payfastUrl, payfastData })
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message })
    next(err)
  }
})


// GET /api/orders/:id  — order confirmation lookup
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { 
        items: { include: { variant: { include: { product: true } } } }, 
        shippingAddress: true 
      },
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
    const { status, paymentStatus } = req.query
    const where = {}
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { shippingAddress: true, items: true, customer: true },
    })
    res.json(orders)
  } catch (err) {
    next(err)
  }
})

import { fulfillOrder } from '../lib/logisticsService.js'
import { sendWhatsAppNotification } from '../lib/invoiceService.js'

// PATCH /api/orders/:id/fulfill — admin: fulfill and ship
router.patch('/:id/fulfill', requireAdmin, async (req, res, next) => {
  try {
    const { trackingNumber, courierKey, estimatedDelivery } = req.body
    if (!trackingNumber || !courierKey) {
      return res.status(400).json({ error: 'Tracking number and courier are required' })
    }

    const order = await fulfillOrder(req.params.id, {
      trackingNumber,
      courierKey,
      estimatedDelivery
    })

    // Send WhatsApp notification
    await sendWhatsAppNotification(order.id, 'SHIPPED')

    res.json(order)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/orders/:id/status — admin: update order status
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
