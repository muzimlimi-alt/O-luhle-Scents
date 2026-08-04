import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../lib/prisma.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { generateQuotePDF } from '../lib/quoteService.js'
import { DateTime } from 'luxon'
import { adjustStock } from '../lib/inventoryService.js'
import { MANUAL_PAYMENT_METHODS } from '../lib/orderAdminService.js'

const router = Router()

// POST /api/quotes — public: RFQ submit
router.post('/', async (req, res, next) => {
  try {
    const { contact, items, notes } = req.body
    if (!items?.length) return res.status(400).json({ error: 'RFQ must contain items' })

    const quoteNumber = `QS-${DateTime.now().toFormat('yyyyMMdd')}-${uuidv4().substring(0, 4).toUpperCase()}`
    
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find/Create Customer
      let customer = await tx.customer.findUnique({ where: { email: contact.email.toLowerCase() } })
      if (!customer) {
        customer = await tx.customer.create({
          data: { email: contact.email.toLowerCase(), name: contact.name, phone: contact.phone }
        })
      }

      // 2. Resolve Prices
      let totalAmount = 0
      const quoteItems = []
      for (const item of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true }
        })
        if (!variant) throw new Error(`Product variant ${item.variantId} not found`)

        const price = Number(variant.price)
        totalAmount += price * item.quantity
        quoteItems.push({
          variantId: variant.id,
          quantity: item.quantity,
          priceAtQuote: price,
          productNameSnapshot: variant.product.name,
          variantLabelSnapshot: variant.size,
          skuSnapshot: variant.sku
        })
      }

      // 3. Create Quote
      return tx.quote.create({
        data: {
          quoteNumber,
          customerId: customer.id,
          status: 'draft',
          totalAmount,
          notes,
          expiryDate: DateTime.now().plus({ days: 30 }).toJSDate(),
          items: { create: quoteItems }
        }
      })
    })

    res.status(201).json(result)
  } catch (err) { next(err) }
})

// GET /api/admin/ops/quotes — admin: list
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } }
    })
    res.json(quotes)
  } catch (err) { next(err) }
})

// PATCH /api/admin/ops/quotes/:id/status — admin: update
router.patch('/admin/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body
    const quote = await prisma.quote.update({
      where: { id: req.params.id },
      data: { status }
    })
    
    if (status === 'approved') {
       await generateQuotePDF(quote.id)
    }
    
    res.json(quote)
  } catch (err) { next(err) }
})

// POST /api/admin/ops/quotes/:id/convert — admin: quote to order
//
// Historically this force-set the new order to paid/paid with no Payment
// row ever created — a real data-integrity gap (an order claiming to be
// paid with zero payment history). Now: pass { paymentMethod, paymentReference }
// to record a real payment and mark it paid immediately; omit them and the
// order is created as an honest "processing / unpaid" B2B order instead —
// never a fabricated "paid" status. Either way, stock is decremented (this
// didn't happen at all before).
router.post('/admin/:id/convert', requireAdmin, async (req, res, next) => {
  try {
    const quoteId = req.params.id
    const { paymentMethod, paymentReference } = req.body || {}
    if (paymentMethod && !MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: `paymentMethod must be one of: ${MANUAL_PAYMENT_METHODS.join(', ')}` })
    }

    const result = await prisma.$transaction(async (tx) => {
       const quote = await tx.quote.findUnique({
         where: { id: quoteId },
         include: { items: { include: { variant: { include: { product: true } } } }, customer: { include: { addresses: true } } }
       })

       if (!quote) throw Object.assign(new Error('Quote not found'), { status: 404 })
       if (quote.status === 'converted') throw Object.assign(new Error('Quote already converted'), { status: 400 })

       // 1. Create Order
       const order = await tx.order.create({
         data: {
           customerId: quote.customerId,
           quoteId: quote.id,
           totalAmount: quote.totalAmount,
           status: paymentMethod ? 'paid' : 'processing',
           paymentStatus: paymentMethod ? 'paid' : 'unpaid',
           shippingCost: 0, // Manual adjustment if needed
           items: {
             create: quote.items.map(i => ({
               variantId: i.variantId,
               quantity: i.quantity,
               priceAtPurchase: i.priceAtQuote,
               // Carry the quote's own snapshot forward rather than re-reading
               // the live product — a converted order should describe exactly
               // what was quoted, not whatever the catalogue says today.
               productNameSnapshot: i.productNameSnapshot,
               variantLabelSnapshot: i.variantLabelSnapshot,
               skuSnapshot: i.skuSnapshot,
               costAtPurchase: i.variant?.costPrice
             }))
           }
         }
       })

       // 2. Decrement stock — a confirmed B2B sale, same as any other order.
       for (const item of quote.items) {
         if (!item.variantId) continue
         await adjustStock(tx, {
           variantId: item.variantId,
           delta: -item.quantity,
           changeType: 'SALE',
           reason: `Quote ${quote.quoteNumber} converted to Order ${order.id.split('-')[0].toUpperCase()}`,
           referenceId: order.id,
           productName: item.productNameSnapshot || item.variant?.product?.name,
           variantSize: item.variantLabelSnapshot || item.variant?.size
         })
       }

       // 3. Record a real payment if one was provided at conversion time.
       if (paymentMethod) {
         await tx.payment.create({
           data: {
             orderId: order.id,
             paymentMethod,
             paymentStatus: 'COMPLETE',
             transactionReference: paymentReference || null,
             amount: quote.totalAmount,
             paidAt: new Date()
           }
         })
       }

       // 4. Mark Quote as Converted
       await tx.quote.update({
         where: { id: quoteId },
         data: { status: 'converted' }
       })

       return order
    })
    res.json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
