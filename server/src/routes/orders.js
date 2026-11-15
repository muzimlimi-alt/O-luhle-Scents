import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { asciiFilename } from '../lib/uploadNames.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { sendNewsletterConfirmation } from '../utils/email.js'
import { recordConsent } from '../lib/consentService.js'

import { calculateShipping } from '../lib/shippingService.js'
import { reserveStock, InsufficientStockError } from '../lib/inventoryService.js'
import { validateCoupon, incrementCouponUsage } from '../lib/couponService.js'
import { resolveTaxRate, calculateTax } from '../lib/taxService.js'
import { nextOrderNumber } from '../lib/orderNumberService.js'
import { uploadProofMiddleware } from '../lib/eftUpload.js'
import { uploadProof } from '../lib/eftPaymentService.js'
import { getPaymentProvider } from '../lib/paymentProviders/index.js'
import { getPublicBankDetails, getDepositConfig, bankAccountToPublicShape } from '../lib/paymentProviders/manualEftProvider.js'

const router = Router()

// ── Checkout newsletter opt-in helper ─────────────────────────────────────────
// Called fire-and-forget after order response is sent. Never throws.
async function handleCheckoutNewsletterOptIn(email) {
  try {
    const token   = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days

    const sub = await prisma.subscriber.upsert({
      where:  { email },
      create: { email, status: 'active', source: 'checkout', unsubscribeToken: token, tokenExpiresAt: expires },
      update: {
        status: 'active',       // re-activate if previously unsubscribed
        source: 'checkout',
      },
    })

    // Only send a confirmation email to brand-new subscribers (their token === what we generated)
    if (sub.unsubscribeToken === token) {
      sendNewsletterConfirmation(email, token).catch(e =>
        console.warn('[Newsletter/Checkout] Confirmation email failed:', e.message)
      )
    }
  } catch (err) {
    console.warn('[Newsletter/Checkout] Opt-in upsert failed:', err.message)
  }
}

// GET /api/orders/eft/bank-details — public: only the safe settings subset
// needed to render checkout instructions, never the full GlobalSetting table.
router.get('/eft/bank-details', async (req, res, next) => {
  try {
    res.json(await getPublicBankDetails())
  } catch (err) { next(err) }
})

// GET /api/orders/eft/deposit-config — public: whether checkout should offer
// a deposit option for Manual EFT, and at what percentage.
router.get('/eft/deposit-config', async (req, res, next) => {
  try {
    res.json(await getDepositConfig())
  } catch (err) { next(err) }
})

// GET /api/shipping/estimate
router.get('/shipping/estimate', async (req, res, next) => {
  try {
    const { country = 'South Africa', postalCode, subtotal } = req.query
    const cost = await calculateShipping(country, postalCode || '', subtotal || 0)
    res.json({ cost })
  } catch (err) { next(err) }
})

// POST /api/orders/preview — public: live price breakdown for the checkout
// summary (subtotal/discount/tax/shipping/total) before the customer commits
// to a payment redirect. Reuses the same couponService/taxService/
// shippingService the real order creation below uses, so the numbers shown
// here can never drift from what actually gets charged.
router.post('/preview', async (req, res, next) => {
  try {
    const { items, couponCode, shipping } = req.body
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' })

    const variantIds = items.map(i => i.variantId).filter(Boolean)
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true }
    })
    if (variants.length !== variantIds.length) {
      return res.status(400).json({ error: 'One or more items are no longer available.' })
    }

    let subtotal = 0
    for (const cartItem of items) {
      const variant = variants.find(v => v.id === cartItem.variantId)
      subtotal += Number(variant.price) * cartItem.quantity
    }

    let discountAmount = 0
    let couponError = null
    let appliedCouponCode = null
    if (couponCode) {
      try {
        const result = await validateCoupon(couponCode, subtotal)
        discountAmount = result?.discountAmount || 0
        appliedCouponCode = result?.coupon.code || null
      } catch (err) {
        couponError = err.message
      }
    }

    const taxRate = await resolveTaxRate(shipping?.province)
    const taxAmount = calculateTax(taxRate, subtotal - discountAmount)
    const shippingCost = await calculateShipping(shipping?.country || 'South Africa', shipping?.postalCode || '', subtotal)
    const totalAmount = subtotal - discountAmount + taxAmount + shippingCost

    res.json({
      subtotal, discountAmount, taxAmount, shippingCost, totalAmount,
      couponCode: appliedCouponCode, couponError,
      taxRateName: taxRate?.name || null
    })
  } catch (err) { next(err) }
})

// POST /api/orders  — create order + return the chosen gateway's payment data
router.post('/', async (req, res, next) => {
  try {
    const { items, contact, shipping, shippingMethod, newsletterOptIn, paymentMethod = 'payfast', payDeposit } = req.body

    // 1. Basic validation
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' })
    if (!contact?.email) return res.status(400).json({ error: 'Email required' })
    const provider = getPaymentProvider(paymentMethod) // throws {status:400} for an unknown method

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
      if (!variant) throw Object.assign(new Error('Variant not found'), { status: 400 })
      
      // Stock check
      if ((variant.inventory?.quantity || 0) < cartItem.quantity) {
        throw Object.assign(new Error(`Insufficent stock for ${variant.product.name}`), { status: 400 })
      }

      const price = Number(variant.price)
      subtotal += price * cartItem.quantity

      return {
        variantId: variant.id,
        quantity: cartItem.quantity,
        priceAtPurchase: price,
        // Frozen at sale time — survives the product/variant being renamed
        // or deleted later, so the order and its invoice stay historically correct.
        productNameSnapshot: variant.product.name,
        variantLabelSnapshot: variant.size,
        skuSnapshot: variant.sku,
        costAtPurchase: variant.costPrice,
        packagingCostAtPurchase: variant.packagingCost,
        labellingCostAtPurchase: variant.labellingCost
      }
    })

    // Coupon (optional) — validated against expiry/usage-limit, same logic
    // the admin order-creation flow uses, so the two paths can't drift apart.
    let appliedCoupon = null
    let discountAmount = 0
    if (req.body.couponCode) {
      appliedCoupon = await validateCoupon(req.body.couponCode, subtotal)
      discountAmount = appliedCoupon?.discountAmount || 0
    }

    // Tax — 0 unless an admin has configured an active/default TaxRate, so
    // this preserves today's no-tax checkout until one exists.
    const taxRate = await resolveTaxRate(shipping.province)
    const taxAmount = calculateTax(taxRate, subtotal - discountAmount)

    // Dynamic Shipping
    const shippingCost = await calculateShipping(shipping.country || 'South Africa', shipping.postalCode || '', subtotal)
    const totalAmount = subtotal - discountAmount + taxAmount + shippingCost

    // 3. Create/Update Customer & Store Order in Transaction
    // Each provider decides its own hold length — manual EFT's is much
    // longer (a bank transfer can take days to clear, unlike PayFast's
    // near-instant confirmation). Both reuse the exact same
    // sweepExpiredReservations() cron (inventoryService.js) unchanged; only
    // the expiry differs.
    const holdMinutes = await provider.reservationHoldMinutes()
    const reservationExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000)

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
      const newOrder = await tx.order.create({
        data: {
          orderNumber: await nextOrderNumber(tx),
          customerId: customer.id,
          shippingAddressId: address.id,
          totalAmount: totalAmount,
          shippingCost: shippingCost,
          couponId: appliedCoupon?.coupon.id || null,
          discountAmount,
          taxRateId: taxRate?.id || null,
          taxAmount,
          status: 'pending',
          paymentStatus: 'unpaid',
          notes: req.body.notes || '',
          items: {
            create: finalItems
          }
        }
      })

      if (appliedCoupon) await incrementCouponUsage(tx, appliedCoupon.coupon.id)

      // Provider-specific setup at order-creation time — e.g. manual EFT
      // creates its Payment row immediately (unlike PayFast, whose Payment
      // row is only created once the webhook confirms success) so there's
      // somewhere to attach proof-of-payment from the moment the order is
      // placed. A no-op for providers (like PayFast) that don't need one.
      await provider.onOrderCreated(tx, newOrder, { contact, shipping, payDeposit: !!payDeposit })

      // Hold stock for every line item. This is the real guard against the
      // oversell race (the check above is just a fast, friendly rejection) —
      // an insufficient-stock failure here rolls back the order and any
      // earlier holds in this same request, atomically.
      for (const item of finalItems) {
        await reserveStock(tx, {
          variantId: item.variantId,
          quantity: item.quantity,
          orderId: newOrder.id,
          expiresAt: reservationExpiresAt
        })
      }

      return newOrder
    })

    // 4. Each provider builds whatever the frontend needs to hand the
    // customer off to it — a gateway redirect payload (PayFast) or bank
    // details + reference (manual EFT). Byte-for-byte the same responses
    // as before this refactor, just built by the provider instead of
    // inline here.
    const responseBody = await provider.buildCheckoutResponse(order, { contact, shipping })
    res.status(201).json(responseBody)

    // ── Newsletter opt-in (Instruction 3) ────────────────────────────────────
    // Fire-and-forget: response already sent, so this never blocks or crashes it
    if (newsletterOptIn && contact?.email) {
      handleCheckoutNewsletterOptIn(contact.email.trim().toLowerCase())
    }

    // Record the marketing-consent decision either way — true if they opted
    // in, false if they didn't — so there's a provable, timestamped answer
    // to "did this customer consent to marketing email," not just an inferred
    // one (POPIA audit finding F3).
    if (contact?.email) {
      recordConsent({
        customerId: order.customerId,
        subjectEmail: contact.email.trim().toLowerCase(),
        purpose: 'marketing_email',
        granted: Boolean(newsletterOptIn),
        method: 'checkout_form',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch((e) => console.warn('[Checkout] Consent record failed:', e.message))
    }

  } catch (err) {

    // Covers both validation failures (400) and provider.onOrderCreated
    // throwing a real user-facing condition — e.g. manualEftProvider's 503
    // when no active bank account is configured. Matches the err.status
    // pattern used elsewhere in this file (proof upload, tracking events)
    // rather than errorHandler.js's default, which masks 5xx messages.
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})


// GET /api/orders/:id  — order confirmation lookup
router.get('/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { variant: { include: { product: true } }, returnItems: true } },
        shippingAddress: true,
        logisticsEvents: { orderBy: { createdAt: 'desc' } },
        coupon: true,
        taxRate: true,
        payments: { include: { statusHistory: { orderBy: { createdAt: 'asc' } }, bankAccount: true } }
      },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // Each payment's own pinned bank account, mapped to the same safe public
    // shape as GET /eft/bank-details — so checkout-success.html/account.html
    // can show the account THIS payment (deposit or balance) was actually
    // shown against, not whatever's default right now. Raw BankAccount
    // fields (chartAccountCode, isDefault, timestamps) are never exposed.
    const payments = order.payments.map(({ bankAccount, ...payment }) => ({
      ...payment,
      bankDetails: bankAccount ? bankAccountToPublicShape(bankAccount) : null
    }))

    res.json({ ...order, payments })
  } catch (err) {
    next(err)
  }
})

// POST /api/orders/:id/proof — public: upload/replace proof of payment.
// Trusts the order's UUID the same way the public GET /:id above already
// does (unauthenticated order lookups have always worked this way on this
// storefront) — lets a guest checkout upload proof immediately without
// requiring an account. Logged-in customers get an equivalent ownership-
// checked route under /api/customers/me/orders/:id/proof.
router.post('/:id/proof', uploadProofMiddleware, async (req, res, next) => {
  try {
    const updated = await uploadProof(req.params.id, {
      filePath: req.file.path,
      fileName: asciiFilename(req.file.originalname),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      actorType: 'customer',
    })
    res.status(201).json({ eftVerificationStatus: updated.eftVerificationStatus })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
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

import { fulfillOrder, addTrackingEvent } from '../lib/logisticsService.js'
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
    // Every other status field in the app is lowercase (pending/paid/...) —
    // normalize here so a stray uppercase value from an older client can't
    // slip a mismatched-casing status back in.
    const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled']
    const status = String(req.body.status || '').toLowerCase()
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` })
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'UPDATE_ORDER_STATUS', entity: 'Order', entityId: order.id, details: { status } }
    })

    res.json(order)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/orders/:id/notes — admin: set internal notes
router.patch('/:id/notes', requireAdmin, async (req, res, next) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { internalNotes: req.body.internalNotes ?? null },
    })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// POST /api/orders/:id/tracking-events — admin: append a tracking event
router.post('/:id/tracking-events', requireAdmin, async (req, res, next) => {
  try {
    const { status, message, location, advanceOrderStatus } = req.body
    if (!status?.trim()) return res.status(400).json({ error: 'status is required' })

    const event = await addTrackingEvent(req.params.id, { status: status.trim(), message, location, advanceOrderStatus: !!advanceOrderStatus })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'ADD_TRACKING_EVENT', entity: 'Order', entityId: req.params.id, details: { status } }
    })

    res.status(201).json(event)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
