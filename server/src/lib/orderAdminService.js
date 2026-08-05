import prisma from './prisma.js'
import { adjustStock } from './inventoryService.js'
import { validateCoupon, incrementCouponUsage } from './couponService.js'
import { resolveTaxRate, calculateTax } from './taxService.js'
import { nextOrderNumber } from './orderNumberService.js'
import { postSaleRecognitionJournal, postCashReceiptJournal, postOrderPaidJournals, postRefundJournal } from './accountingService.js'

export const MANUAL_PAYMENT_METHODS = ['manual_eft', 'manual_cash', 'manual_card']

// Admin-initiated order creation (phone/WhatsApp/in-person sales) — the
// counterpart to the public checkout in orders.js. Unlike checkout, this
// represents an already-confirmed sale, so stock is decremented directly
// (via adjustStock, ledgered) rather than going through the reservation/
// expiry dance built for unpaid public carts.
export async function createAdminOrder({
  customerId,
  newCustomer,
  items,
  shippingAddressId,
  billingAddressId,
  shippingCost = 0,
  couponCode,
  paymentMethod,
  paymentReference,
  milestones,
  notes,
  adminUserId,
}) {
  if (!items?.length) throw Object.assign(new Error('At least one line item is required'), { status: 400 })

  const isMilestonePlan = paymentMethod === 'milestone_plan'
  if (!isMilestonePlan && !MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
    throw Object.assign(new Error('Invalid payment method'), { status: 400 })
  }
  if (isMilestonePlan && (!milestones?.length)) {
    throw Object.assign(new Error('A milestone plan needs at least one installment'), { status: 400 })
  }

  const variantIds = items.map(i => i.variantId)
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true, inventory: true }
  })
  if (variants.length !== new Set(variantIds).size) {
    throw Object.assign(new Error('One or more selected variants no longer exist'), { status: 400 })
  }

  let subtotal = 0
  const finalItems = items.map(cartItem => {
    const variant = variants.find(v => v.id === cartItem.variantId)
    const quantity = parseInt(cartItem.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`Invalid quantity for ${variant.product.name}`), { status: 400 })
    }
    if ((variant.inventory?.quantity || 0) - (variant.inventory?.reserved || 0) < quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${variant.product.name} (${variant.size})`), { status: 400 })
    }

    const price = Number(variant.price)
    subtotal += price * quantity
    return {
      variantId: variant.id,
      quantity,
      priceAtPurchase: price,
      productNameSnapshot: variant.product.name,
      variantLabelSnapshot: variant.size,
      skuSnapshot: variant.sku,
      costAtPurchase: variant.costPrice,
      packagingCostAtPurchase: variant.packagingCost,
      labellingCostAtPurchase: variant.labellingCost
    }
  })

  let appliedCoupon = null
  let discountAmount = 0
  if (couponCode) {
    appliedCoupon = await validateCoupon(couponCode, subtotal)
    discountAmount = appliedCoupon?.discountAmount || 0
  }

  const taxRate = await resolveTaxRate(null)
  const taxAmount = calculateTax(taxRate, subtotal - discountAmount)
  const totalAmount = subtotal - discountAmount + taxAmount + Number(shippingCost || 0)

  return prisma.$transaction(async (tx) => {
    // 1. Resolve customer
    let resolvedCustomerId = customerId
    if (!resolvedCustomerId) {
      if (!newCustomer?.email) throw Object.assign(new Error('A customer or new-customer email is required'), { status: 400 })
      const existing = await tx.customer.findUnique({ where: { email: newCustomer.email.toLowerCase() } })
      const customer = existing || await tx.customer.create({
        data: { email: newCustomer.email.toLowerCase(), name: newCustomer.name || null, phone: newCustomer.phone || null }
      })
      resolvedCustomerId = customer.id
    }

    // 2. Create the order + items
    const order = await tx.order.create({
      data: {
        orderNumber: await nextOrderNumber(tx),
        customerId: resolvedCustomerId,
        shippingAddressId: shippingAddressId || null,
        billingAddressId: billingAddressId || null,
        totalAmount,
        shippingCost,
        couponId: appliedCoupon?.coupon.id || null,
        discountAmount,
        taxRateId: taxRate?.id || null,
        taxAmount,
        status: isMilestonePlan ? 'processing' : 'paid',
        paymentStatus: isMilestonePlan ? 'unpaid' : 'paid',
        notes: notes || null,
        items: { create: finalItems }
      },
      include: { items: true }
    })

    if (appliedCoupon) await incrementCouponUsage(tx, appliedCoupon.coupon.id)

    // 3. Decrement stock now — this is a confirmed sale, not a held cart.
    for (const item of finalItems) {
      await adjustStock(tx, {
        variantId: item.variantId,
        delta: -item.quantity,
        changeType: 'SALE',
        reason: `Admin-created order ${order.id.split('-')[0].toUpperCase()}`,
        referenceId: order.id,
        productName: item.productNameSnapshot,
        variantSize: item.variantLabelSnapshot
      })
    }

    // 4. Record payment or set up the installment schedule
    if (isMilestonePlan) {
      await tx.paymentMilestone.createMany({
        data: milestones.map(m => ({
          orderId: order.id,
          label: m.label,
          amountDue: m.amountDue,
          dueDate: m.dueDate ? new Date(m.dueDate) : null
        }))
      })

      // Sale is confirmed now (stock already decremented above) even though
      // cash arrives later in installments — recordPayment posts only the
      // cash-receipt journal for each one, not a repeated sale journal.
      await postSaleRecognitionJournal(tx, order)
    } else {
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          paymentMethod,
          paymentStatus: 'COMPLETE',
          transactionReference: paymentReference || null,
          amount: totalAmount,
          paidAt: new Date()
        }
      })

      await postOrderPaidJournals(tx, order, payment)
    }

    await tx.auditLog.create({
      data: {
        adminUserId,
        action: 'CREATE_ADMIN_ORDER',
        entity: 'Order',
        entityId: order.id,
        details: { paymentMethod, totalAmount }
      }
    })

    return order
  })
}

// Records a manual payment against an existing order (EFT confirmation, cash,
// etc). Settles the next open PaymentMilestone if the order has one.
export async function recordPayment(orderId, { method, amount, reference, adminUserId }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
        paymentMilestones: { where: { status: 'PENDING' }, orderBy: { dueDate: 'asc' } }
      }
    })
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

    const payment = await tx.payment.create({
      data: {
        orderId,
        paymentMethod: method,
        paymentStatus: 'COMPLETE',
        transactionReference: reference || null,
        amount,
        paidAt: new Date()
      }
    })

    // Idempotent — a no-op if the sale was already recognized (milestone
    // creation, or an earlier payment against this same order); guarantees
    // AR always has a debit to draw the cash-receipt journal down against,
    // even for a manual payment against an order that reached here directly
    // (e.g. cash on delivery) without going through createAdminOrder first.
    await postSaleRecognitionJournal(tx, order)
    await postCashReceiptJournal(tx, order, payment)

    const nextMilestone = order.paymentMilestones[0]
    if (nextMilestone) {
      await tx.paymentMilestone.update({
        where: { id: nextMilestone.id },
        data: { status: 'PAID', paidAt: new Date(), paymentId: payment.id }
      })
    }

    const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) + Number(amount)
    const paymentStatus = totalPaid >= Number(order.totalAmount) ? 'paid' : 'partially_paid'
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus, status: paymentStatus === 'paid' && order.status === 'processing' ? 'paid' : order.status }
    })

    await tx.auditLog.create({
      data: { adminUserId, action: 'RECORD_PAYMENT', entity: 'Order', entityId: orderId, details: { method, amount } }
    })

    return { payment, order: updated }
  })
}

// Records a refund (bookkeeping only — no PayFast refund API integration
// exists to call) and recomputes the order's payment status from cumulative
// refunded amount vs. totalAmount.
export async function issueRefund(orderId, { amount, method, returnItemId, notes, adminUserId }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { refunds: true } })
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

    const refund = await tx.refund.create({
      data: { orderId, returnItemId: returnItemId || null, amount, method, notes: notes || null, adminUserId }
    })

    await postRefundJournal(tx, refund, order)

    const totalRefunded = order.refunds.reduce((sum, r) => sum + Number(r.amount), 0) + Number(amount)
    const paymentStatus = totalRefunded >= Number(order.totalAmount) ? 'refunded' : 'partially_refunded'
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus } })

    await tx.auditLog.create({
      data: { adminUserId, action: 'ISSUE_REFUND', entity: 'Order', entityId: orderId, details: { amount, method } }
    })

    return refund
  })
}
