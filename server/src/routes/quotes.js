import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../lib/prisma.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { generateQuotePDF } from '../lib/quoteService.js'
import { DateTime } from 'luxon'

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
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } })
        if (!variant) throw new Error(`Product variant ${item.variantId} not found`)
        
        const price = Number(variant.price)
        totalAmount += price * item.quantity
        quoteItems.push({
          variantId: variant.id,
          quantity: item.quantity,
          priceAtQuote: price
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
router.post('/admin/:id/convert', requireAdmin, async (req, res, next) => {
  try {
    const quoteId = req.params.id
    const result = await prisma.$transaction(async (tx) => {
       const quote = await tx.quote.findUnique({
         where: { id: quoteId },
         include: { items: true, customer: { include: { addresses: true } } }
       })

       if (!quote) throw new Error('Quote not found')
       if (quote.status === 'converted') throw new Error('Quote already converted')

       // 1. Create Order
       const order = await tx.order.create({
         data: {
           customerId: quote.customerId,
           quoteId: quote.id,
           totalAmount: quote.totalAmount,
           status: 'paid', // Assuming B2B approval implies payment agreement
           paymentStatus: 'paid',
           shippingCost: 0, // Manual adjustment if needed
           items: {
             create: quote.items.map(i => ({
               variantId: i.variantId,
               quantity: i.quantity,
               priceAtPurchase: i.priceAtQuote
             }))
           }
         }
       })

       // 2. Mark Quote as Converted
       await tx.quote.update({
         where: { id: quoteId },
         data: { status: 'converted' }
       })

       return order
    })
    res.json(result)
  } catch (err) { next(err) }
})

export default router
