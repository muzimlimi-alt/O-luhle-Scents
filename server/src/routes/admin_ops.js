import { Router } from 'express'
import fs from 'fs'
import bcrypt from 'bcryptjs'

import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import nodemailer from 'nodemailer'
import { adjustStock } from '../lib/inventoryService.js'
import { processReturn, RETURN_CONDITIONS } from '../lib/returnsService.js'
import { getFinanceSummary } from '../lib/financeService.js'
import { createAdminOrder, recordPayment, issueRefund } from '../lib/orderAdminService.js'
import { createExchange } from '../lib/exchangeService.js'
import { validateCoupon } from '../lib/couponService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = Router()

// ─── COUPONS ────────────────────────────────────────────────────────────────
router.get('/coupons', requireAdmin, async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(coupons)
  } catch (err) {
    next(err)
  }
})

router.post('/coupons', requireAdmin, async (req, res, next) => {
  try {
    const { code, discountType, value, expiryDate, usageLimit } = req.body
    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        value: parseFloat(value),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        usageLimit: parseInt(usageLimit) || null
      }
    })
    res.status(201).json(coupon)
  } catch (err) {
    next(err)
  }
})

// ─── SUPPLIERS ───────────────────────────────────────────────────────────────
router.get('/suppliers', requireAdmin, async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    })
    res.json(suppliers)
  } catch (err) {
    next(err)
  }
})

router.post('/suppliers', requireAdmin, async (req, res, next) => {
  try {
    const { name, contactEmail, phone } = req.body
    const supplier = await prisma.supplier.create({
      data: { name, contactEmail, phone }
    })
    res.status(201).json(supplier)
  } catch (err) {
    next(err)
  }
})

import { sendRestockNotification } from '../lib/supplierService.js'

// Restock Alert
router.post('/suppliers/restock-alert/:variantId', requireAdmin, async (req, res, next) => {
  try {
    const result = await sendRestockNotification(req.params.variantId)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})


// ─── MEDIA LIBRARY (PIM) ───────────────────────────────────────────────────────
// Alt text is the one piece of metadata a bare filename-array can't carry —
// see mediaService.js for how these records stay in sync with Product.images.
router.patch('/media/:id', requireAdmin, async (req, res, next) => {
  try {
    const { altText } = req.body
    const asset = await prisma.mediaAsset.update({
      where: { id: req.params.id },
      data: { altText: altText || null }
    })
    res.json(asset)
  } catch (err) { next(err) }
})

// ─── ATTRIBUTE DEFINITIONS (PIM) ──────────────────────────────────────────────
// Lets an admin define a family's attribute set (e.g. Candle -> Wax Type,
// Burn Time) without a developer or a migration. Consumed by ProductModal's
// family-aware attribute form.
const ATTRIBUTE_DATA_TYPES = ['TEXT', 'NUMBER', 'ENUM', 'BOOLEAN']

router.get('/attribute-definitions', requireAdmin, async (req, res, next) => {
  try {
    const { family } = req.query
    const definitions = await prisma.attributeDefinition.findMany({
      where: family ? { family } : undefined,
      orderBy: [{ family: 'asc' }, { displayOrder: 'asc' }]
    })
    res.json(definitions)
  } catch (err) { next(err) }
})

router.post('/attribute-definitions', requireAdmin, async (req, res, next) => {
  try {
    const { key, label, family, dataType, unit, options, appliesToVariant, isFilterable, displayOrder } = req.body
    if (!key?.trim() || !label?.trim() || !family) {
      return res.status(400).json({ error: 'key, label and family are required' })
    }
    if (!ATTRIBUTE_DATA_TYPES.includes(dataType)) {
      return res.status(400).json({ error: `dataType must be one of: ${ATTRIBUTE_DATA_TYPES.join(', ')}` })
    }

    const definition = await prisma.attributeDefinition.create({
      data: {
        key: key.trim().toLowerCase().replace(/\s+/g, '_'),
        label: label.trim(),
        family,
        dataType,
        unit: unit || null,
        options: dataType === 'ENUM' ? options : undefined,
        appliesToVariant: !!appliesToVariant,
        isFilterable: !!isFilterable,
        displayOrder: parseInt(displayOrder) || 0
      }
    })
    res.status(201).json(definition)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'An attribute with that key already exists' })
    next(err)
  }
})

router.patch('/attribute-definitions/:id', requireAdmin, async (req, res, next) => {
  try {
    const { label, unit, options, appliesToVariant, isFilterable, displayOrder } = req.body
    const definition = await prisma.attributeDefinition.update({
      where: { id: req.params.id },
      data: {
        label: label !== undefined ? label.trim() : undefined,
        unit: unit !== undefined ? (unit || null) : undefined,
        options: options !== undefined ? options : undefined,
        appliesToVariant: appliesToVariant !== undefined ? !!appliesToVariant : undefined,
        isFilterable: isFilterable !== undefined ? !!isFilterable : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined
      }
    })
    res.json(definition)
  } catch (err) { next(err) }
})

router.delete('/attribute-definitions/:id', requireAdmin, async (req, res, next) => {
  try {
    // Deleting a definition cascades to any ProductAttributeValue/VariantAttributeValue
    // rows already using it (see schema) — confirm intent client-side before calling.
    await prisma.attributeDefinition.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

// ─── PRODUCT SUPPLIERS (alternative suppliers) ────────────────────────────────
router.get('/products/:productId/suppliers', requireAdmin, async (req, res, next) => {
  try {
    const suppliers = await prisma.productSupplier.findMany({
      where: { productId: req.params.productId },
      include: { supplier: true },
      orderBy: { isPrimary: 'desc' }
    })
    res.json(suppliers)
  } catch (err) { next(err) }
})

router.post('/products/:productId/suppliers', requireAdmin, async (req, res, next) => {
  try {
    const { supplierId, supplierSku, leadTimeDays, minOrderQty, isPrimary } = req.body
    if (!supplierId) return res.status(400).json({ error: 'supplierId is required' })

    const productSupplier = await prisma.productSupplier.create({
      data: {
        productId: req.params.productId,
        supplierId,
        supplierSku: supplierSku || null,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays) : null,
        minOrderQty: minOrderQty ? parseInt(minOrderQty) : null,
        isPrimary: !!isPrimary
      },
      include: { supplier: true }
    })
    res.status(201).json(productSupplier)
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'That supplier is already linked to this product' })
    next(err)
  }
})

router.delete('/product-suppliers/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.productSupplier.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

// ─── PURCHASES ───────────────────────────────────────────────────────────────
router.get('/purchases', requireAdmin, async (req, res, next) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(purchases)
  } catch (err) {
    next(err)
  }
})

// POST /admin/ops/purchases — create a purchase order (status: PENDING)
router.post('/purchases', requireAdmin, async (req, res, next) => {
  try {
    const { supplierId, expectedDelivery, items = [] } = req.body
    if (!items.length) return res.status(400).json({ error: 'At least one line item is required' })

    const totalCost = items.reduce((sum, i) => sum + (parseFloat(i.costPrice) || 0) * (parseInt(i.quantity) || 0), 0)

    const purchase = await prisma.purchase.create({
      data: {
        supplierId: supplierId || null,
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
        totalCost,
        status: 'PENDING',
        items: {
          create: items.map(i => ({
            variantId: i.variantId,
            quantity: parseInt(i.quantity) || 0,
            costPrice: parseFloat(i.costPrice) || 0
          }))
        }
      },
      include: { supplier: true, items: { include: { variant: { include: { product: true } } } } }
    })

    res.status(201).json(purchase)
  } catch (err) { next(err) }
})

// PATCH /admin/ops/purchases/:id/receive — receive goods: increments stock
// for every line item (ledgered via adjustStock), updates variant cost price,
// and marks the purchase order RECEIVED. Full receive only — no partials yet.
router.patch('/purchases/:id/receive', requireAdmin, async (req, res, next) => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { variant: { include: { product: true } } } } }
    })
    if (!purchase) return res.status(404).json({ error: 'Purchase order not found' })
    if (purchase.status === 'RECEIVED') return res.status(400).json({ error: 'Purchase order already received' })

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        await adjustStock(tx, {
          variantId: item.variantId,
          delta: item.quantity,
          changeType: 'PURCHASE_RECEIVE',
          reason: `Received against Purchase Order ${purchase.id.split('-')[0].toUpperCase()}`,
          referenceId: purchase.id,
          productName: item.variant?.product?.name,
          variantSize: item.variant?.size
        })

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { costPrice: item.costPrice }
        })
      }

      return tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
        include: { supplier: true, items: { include: { variant: { include: { product: true } } } } }
      })
    })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'RECEIVE_PURCHASE_ORDER',
        entity: 'Purchase',
        entityId: purchase.id,
        details: { itemCount: purchase.items.length }
      }
    })

    res.json(updated)
  } catch (err) { next(err) }
})

// ─── RETURNS ─────────────────────────────────────────────────────────────────
// Customer Return -> Inspect -> Good Condition -> Return to Stock, OR
// Damaged -> Mark as Damaged (write-off, no restock). See returnsService.js.
router.post('/returns', requireAdmin, async (req, res, next) => {
  try {
    const { orderItemId, quantity, condition, note } = req.body
    const qty = parseInt(quantity)
    if (!orderItemId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'orderItemId and a positive quantity are required' })
    }
    if (!RETURN_CONDITIONS.includes(condition)) {
      return res.status(400).json({ error: `condition must be one of: ${RETURN_CONDITIONS.join(', ')}` })
    }

    const result = await processReturn({ orderItemId, quantity: qty, condition, note, adminUserId: req.adminId })

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'PROCESS_RETURN',
        entity: 'OrderItem',
        entityId: orderItemId,
        details: { quantity: qty, condition, restocked: result.restocked }
      }
    })

    res.status(201).json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.get('/returns', requireAdmin, async (req, res, next) => {
  try {
    const returns = await prisma.returnItem.findMany({
      include: {
        orderItem: { include: { order: true, variant: { include: { product: true } } } },
        adminUser: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(returns)
  } catch (err) { next(err) }
})

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
router.get('/payments', requireAdmin, async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { order: { include: { customer: true } } },
      orderBy: { paidAt: 'desc' }
    })
    res.json(payments)
  } catch (err) {
    next(err)
  }
})

// ─── INVENTORY ───────────────────────────────────────────────────────────────
router.get('/inventory', requireAdmin, async (req, res, next) => {
  try {
    const [inventory, incoming] = await Promise.all([
      prisma.inventory.findMany({
        include: {
          variant: {
            include: {
              product: { include: { supplier: true } }
            }
          }
        },
        orderBy: { quantity: 'asc' }
      }),
      prisma.purchaseItem.groupBy({
        by: ['variantId'],
        where: { purchase: { status: 'PENDING' } },
        _sum: { quantity: true }
      })
    ])

    const incomingByVariant = Object.fromEntries(incoming.map(i => [i.variantId, i._sum.quantity || 0]))

    res.json(inventory.map(i => ({
      ...i,
      available: i.quantity - i.reserved,
      incoming: incomingByVariant[i.variantId] || 0
    })))
  } catch (err) {
    next(err)
  }
})

router.get('/inventory/logs', requireAdmin, async (req, res, next) => {
  try {
    const { variantId } = req.query
    const logs = await prisma.inventoryLog.findMany({
      where: variantId ? { variantId } : undefined,
      include: {
        variant: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    res.json(logs)
  } catch (err) {
    next(err)
  }
})

// PATCH /admin/ops/inventory/:variantId/threshold — set the reorder level
router.patch('/inventory/:variantId/threshold', requireAdmin, async (req, res, next) => {
  try {
    const { lowStockThreshold } = req.body
    const value = parseInt(lowStockThreshold)
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: 'lowStockThreshold must be a non-negative number' })
    }

    const updated = await prisma.inventory.update({
      where: { variantId: req.params.variantId },
      data: { lowStockThreshold: value }
    })
    res.json(updated)
  } catch (err) { next(err) }
})

const ADJUSTMENT_TYPES = ['ADJUSTMENT_ADD', 'ADJUSTMENT_REMOVE', 'DAMAGED', 'CORRECTION']

// POST /admin/ops/inventory/:variantId/adjust — the only way to hand-change
// stock from the admin UI; always ledgered via adjustStock, never a raw write.
router.post('/inventory/:variantId/adjust', requireAdmin, async (req, res, next) => {
  try {
    const { quantityChange, changeType, reason } = req.body
    const delta = parseInt(quantityChange)
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: 'quantityChange must be a non-zero number' })
    }
    if (!ADJUSTMENT_TYPES.includes(changeType)) {
      return res.status(400).json({ error: `changeType must be one of: ${ADJUSTMENT_TYPES.join(', ')}` })
    }

    const nextQuantity = await prisma.$transaction((tx) => adjustStock(tx, {
      variantId: req.params.variantId,
      delta,
      changeType,
      reason: reason || null,
      referenceId: null
    }))

    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'ADJUST_INVENTORY',
        entity: 'ProductVariant',
        entityId: req.params.variantId,
        details: { delta, changeType, reason, nextQuantity }
      }
    })

    res.json({ variantId: req.params.variantId, quantity: nextQuantity })
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message })
    next(err)
  }
})

// ─── INVOICES ────────────────────────────────────────────────────────────────
router.get('/invoices', requireAdmin, async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(invoices)
  } catch (err) {
    next(err)
  }
})

router.get('/invoices/:id/pdf', requireAdmin, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { 
        order: {
          include: {
            customer: true,
            items: { include: { variant: { include: { product: true } } } }
          }
        }
      }
    })
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' })

    const buffer = await generateInvoicePDF(invoice.order, invoice)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=Invoice_${invoice.invoiceNumber}.pdf`,
      'Content-Length': buffer.length,
    })
    res.end(buffer)
  } catch (err) {
    next(err)
  }
})

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
router.get('/notifications', requireAdmin, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    res.json(notifications)
  } catch (err) {
    next(err)
  }
})

router.patch('/notifications/:id/read', requireAdmin, async (req, res, next) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true }
    })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.delete('/notifications/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})


// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
router.get('/audit-logs', requireAdmin, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { adminUser: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    res.json(logs)
  } catch (err) {
    next(err)
  }
})

// ─── ADMIN USERS ─────────────────────────────────────────────────────────────
router.get('/admin-users', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', status = '', sortBy = 'name', sortOrder = 'asc' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const where = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        } : {},
        role ? { role } : {},
        status ? { isActive: status === 'active' } : {}
      ]
    }

    const [users, total] = await Promise.all([
      prisma.adminUser.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, isActive: true, lastLogin: true, createdAt: true },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take
      }),
      prisma.adminUser.count({ where })
    ])

    res.json({ users, total, pages: Math.ceil(total / take) })
  } catch (err) {
    next(err)
  }
})

router.post('/admin-users', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'All fields are required' })
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already exists' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.adminUser.create({
      data: { name, email, role, passwordHash, isActive: true }
    })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'CREATE_ADMIN', entity: 'AdminUser', entityId: user.id, details: { email: user.email, role: user.role } }
    })

    res.status(201).json(user)
  } catch (err) { next(err) }
})

router.patch('/admin-users/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, role, isActive } = req.body
    const user = await prisma.adminUser.update({
      where: { id: req.params.id },
      data: { name, email, role, isActive }
    })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'UPDATE_ADMIN', entity: 'AdminUser', entityId: user.id, details: { name, email, role, isActive } }
    })

    res.json(user)
  } catch (err) { next(err) }
})

router.patch('/admin-users/:id/password', requireAdmin, async (req, res, next) => {
  try {
    const { password } = req.body
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.adminUser.update({
      where: { id: req.params.id },
      data: { passwordHash }
    })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'RESET_PASSWORD', entity: 'AdminUser', entityId: req.params.id }
    })

    res.json({ success: true })
  } catch (err) { next(err) }
})

router.delete('/admin-users/:id', requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.adminId) {
      return res.status(400).json({ error: 'You cannot delete your own administrative account' })
    }

    await prisma.adminUser.delete({ where: { id: req.params.id } })

    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'DELETE_ADMIN', entity: 'AdminUser', entityId: req.params.id }
    })

    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
router.get('/customers', requireAdmin, async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(customers)
  } catch (err) {
    next(err)
  }
})

// ─── BULK EMAIL ─────────────────────────────────────────────────────────────
router.post('/email/bulk', requireAdmin, async (req, res, next) => {
  try {
    const { subject, body } = req.body
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body required' })

    const customers = await prisma.customer.findMany({
      where: { email: { not: null } },
      select: { email: true }
    })

    const emails = customers.map(c => c.email)
    if (!emails.length) return res.status(400).json({ error: 'No customers found with email' })

    // Build transporter (Placeholder config)
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.example.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    // In production, use a queue (Bull/Redis). For now, simple loop or BCC.
    const mailOptions = {
      from: `"O'luhle Scents" <${process.env.EMAIL_USER}>`,
      bcc: emails,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #d4af37;">O'luhle Scents</h2>
          <div style="padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          <p style="font-size: 12px; color: #999; margin-top: 20px; text-align: center;">
            You are receiving this email as a registered customer of O'luhle Scents.
          </p>
        </div>
      `
    }

    // Attempt send
    try {
      await transporter.sendMail(mailOptions)
    } catch (sendErr) {
      console.error('Email send failed:', sendErr)
      // Mock success for dev if no SMTP config
      if (process.env.NODE_ENV !== 'production') {
        console.log('DEV MODE: Simulating email send to', emails.length, 'customers')
      } else {
        throw sendErr
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId, // From middleware
        action: 'SEND_BULK_EMAIL',
        entity: 'Customer',
        details: { subject, recipientCount: emails.length }
      }
    })

    res.json({ success: true, count: emails.length })
  } catch (err) {
    next(err)
  }
})

// ─── ABANDONED RECOVERY ───────────────────────────────────────────────────
router.post('/email/abandoned/:orderId', requireAdmin, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } }
    })

    if (!order || !order.customer?.email) return res.status(404).json({ error: 'Order not found' })

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    })

    const checkoutUrl = `${process.env.FRONTEND_URL}/checkout.html?recover=${order.id}`
    const itemsHtml = order.items.map(i => `<li>${i.variant.product.name} (${i.variant.size}) x ${i.quantity}</li>`).join('')

    const mailOptions = {
      from: `"O'luhle Scents" <${process.env.EMAIL_USER}>`,
      to: order.customer.email,
      subject: "Did you forget something luxury?",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d4af37;">O'luhle Scents</h2>
          <p>Hi ${order.customer.name || 'there'},</p>
          <p>We noticed you left some exquisite items in your cart. They are still reserved for you, but not for long!</p>
          <ul>${itemsHtml}</ul>
          <p>Total: <strong>R${Number(order.totalAmount).toLocaleString()}</strong></p>
          <div style="margin-top: 30px;">
            <a href="${checkoutUrl}" style="background: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Your Purchase</a>
          </div>
          <p style="margin-top: 40px; font-size: 12px; color: #999;">If you didn't mean to start this order, please ignore this email.</p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)
    await prisma.order.update({
      where: { id: order.id },
      data: { abandonedEmailSent: true }
    })

    res.json({ success: true })
  } catch (err) { next(err) }
})

import archiver from 'archiver'

// ─── INVOICES ───────────────────────────────────────────────────────────────
router.get('/invoices', requireAdmin, async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { order: { include: { customer: true } } },
      orderBy: { issuedDate: 'desc' }
    })
    res.json(invoices)
  } catch (err) { next(err) }
})

// GET individual PDF
router.get('/invoices/:id/pdf', requireAdmin, async (req, res, next) => {
  try {
    const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } })
    if (!inv || !inv.pdfUrl) return res.status(404).send('Invoice PDF not found')
    
    const filePath = path.join(__dirname, '../../../invoices', inv.pdfUrl)
    if (!fs.existsSync(filePath)) return res.status(404).send('File missing on server')
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=${inv.pdfUrl}`)
    fs.createReadStream(filePath).pipe(res)
  } catch (err) { next(err) }
})

// POST Bulk Invoices ZIP
router.post('/invoices/bulk-pdf', requireAdmin, async (req, res, next) => {
  try {
    const { ids } = req.body
    if (!ids || !ids.length) return res.status(400).send('No invoice IDs provided')

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids } }
    })

    const archive = archiver('zip', { zlib: { level: 9 } })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename=invoices_bulk.zip')
    
    archive.pipe(res)

    for (const inv of invoices) {
      const filePath = path.join(__dirname, '../../../invoices', inv.pdfUrl)
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: inv.pdfUrl })
      }
    }

    await archive.finalize()
  } catch (err) { next(err) }
})

import { generateMonthlyPerformanceReport } from '../lib/reportService.js'

// ─── EXECUTIVE REPORTS ──────────────────────────────────────────────────────
router.get('/reports/generate', requireAdmin, async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || 1
    const report = await generateMonthlyPerformanceReport(month)
    
    // Log in Audit
    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId,
        action: 'GENERATE_EXECUTIVE_REPORT',
        entity: 'BusinessStats',
        details: { monthOffset: month, revenue: report.totalRevenue }
      }
    })

    const filePath = path.join(__dirname, '../../../reports', report.fileName)
    if (!fs.existsSync(filePath)) return res.status(404).send('Report not found')
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=${report.fileName}`)
    fs.createReadStream(filePath).pipe(res)
  } catch (err) { next(err) }
})

// GET /admin/ops/reports/inventory-summary — live inventory health report:
// stock value/on-hand, low-stock and out-of-stock lists, and slow movers
// (in-stock variants with zero sales in the last 60 days).
router.get('/reports/inventory-summary', requireAdmin, async (req, res, next) => {
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const [inventory, sales, incoming] = await Promise.all([
      prisma.inventory.findMany({
        include: { variant: { include: { product: { include: { supplier: true } } } } }
      }),
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: sixtyDaysAgo }, status: { in: ['paid', 'processing', 'shipped', 'delivered'] } } },
        select: { variantId: true, quantity: true }
      }),
      prisma.purchaseItem.groupBy({
        by: ['variantId'],
        where: { purchase: { status: 'PENDING' } },
        _sum: { quantity: true }
      })
    ])

    const velocityMap = {}
    sales.forEach(s => { velocityMap[s.variantId] = (velocityMap[s.variantId] || 0) + s.quantity })
    const incomingByVariant = Object.fromEntries(incoming.map(i => [i.variantId, i._sum.quantity || 0]))

    const stockOnHand = inventory.reduce((sum, i) => sum + i.quantity, 0)
    const incomingStock = incoming.reduce((sum, i) => sum + (i._sum.quantity || 0), 0)
    const stockValue = inventory.reduce((sum, i) => sum + i.quantity * Number(i.variant?.costPrice || 0), 0)

    const lowStockItems = inventory
      .filter(i => i.quantity <= i.lowStockThreshold)
      .map(i => ({
        variantId: i.variantId,
        productName: i.variant?.product?.name,
        size: i.variant?.size,
        quantity: i.quantity,
        available: i.quantity - i.reserved,
        incoming: incomingByVariant[i.variantId] || 0,
        lowStockThreshold: i.lowStockThreshold,
        supplier: i.variant?.product?.supplier?.name || null
      }))

    const slowMoving = inventory
      .filter(i => i.quantity > 0 && !velocityMap[i.variantId])
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(i => ({
        variantId: i.variantId,
        productName: i.variant?.product?.name,
        size: i.variant?.size,
        quantity: i.quantity
      }))

    res.json({
      stockOnHand,
      incomingStock,
      stockValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: inventory.filter(i => i.quantity - i.reserved <= 0).length,
      lowStockItems,
      slowMoving,
      generatedAt: new Date()
    })
  } catch (err) { next(err) }
})

// GET /admin/ops/reports/finance-summary — revenue, COGS, gross profit and
// margin computed from OrderItem.costAtPurchase (see financeService.js).
// Cost data only exists for orders placed after PIM Phase 1 shipped, so the
// response always reports what fraction of items actually have it.
const FINANCE_PERIODS = ['7d', '30d', '90d', '365d', 'all']
router.get('/reports/finance-summary', requireAdmin, async (req, res, next) => {
  try {
    const period = FINANCE_PERIODS.includes(req.query.period) ? req.query.period : '30d'
    const summary = await getFinanceSummary(period)
    res.json(summary)
  } catch (err) { next(err) }
})

// ─── ORDER MANAGEMENT ────────────────────────────────────────────────────────
// Admin-initiated orders, payments, refunds — the admin-side counterpart to
// the public checkout in orders.js. See orderAdminService.js for the shared
// transaction logic.
router.post('/orders', requireAdmin, async (req, res, next) => {
  try {
    const order = await createAdminOrder({ ...req.body, adminUserId: req.adminId })
    res.status(201).json(order)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// GET /admin/ops/orders/:id — full detail view (admin-only; the public
// GET /api/orders/:id stays lean/safe since it has no auth). Everything an
// Order Details page needs in one round trip.
router.get('/orders/:id', requireAdmin, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        shippingAddress: true,
        billingAddress: true,
        coupon: true,
        taxRate: true,
        items: { include: { variant: { include: { product: true } }, returnItems: { include: { exchangeRequests: true, refunds: true } } } },
        payments: { orderBy: { createdAt: 'desc' } },
        invoices: { orderBy: { issuedDate: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        paymentMilestones: { orderBy: { dueDate: 'asc' } },
        logisticsEvents: { orderBy: { createdAt: 'desc' } },
        quote: true,
      }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'Order', entityId: order.id },
      include: { adminUser: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ ...order, auditLogs })
  } catch (err) { next(err) }
})

router.post('/orders/:id/payments', requireAdmin, async (req, res, next) => {
  try {
    const { method, amount, reference } = req.body
    const amt = parseFloat(amount)
    if (!method || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'method and a positive amount are required' })
    }
    const result = await recordPayment(req.params.id, { method, amount: amt, reference, adminUserId: req.adminId })
    res.status(201).json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/orders/:id/refunds', requireAdmin, async (req, res, next) => {
  try {
    const { amount, method, returnItemId, notes } = req.body
    const amt = parseFloat(amount)
    if (!method || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'method and a positive amount are required' })
    }
    const refund = await issueRefund(req.params.id, { amount: amt, method, returnItemId, notes, adminUserId: req.adminId })
    res.status(201).json(refund)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// ─── EXCHANGES ───────────────────────────────────────────────────────────────
router.post('/exchanges', requireAdmin, async (req, res, next) => {
  try {
    const { returnItemId, replacementVariantId } = req.body
    if (!returnItemId || !replacementVariantId) {
      return res.status(400).json({ error: 'returnItemId and replacementVariantId are required' })
    }
    const exchange = await createExchange({ returnItemId, replacementVariantId, adminUserId: req.adminId })
    res.status(201).json(exchange)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.get('/exchanges', requireAdmin, async (req, res, next) => {
  try {
    const exchanges = await prisma.exchangeRequest.findMany({
      include: {
        returnItem: { include: { orderItem: { include: { order: true } } } },
        replacementVariant: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(exchanges)
  } catch (err) { next(err) }
})

// ─── COUPONS: validation preview ─────────────────────────────────────────────
// Used by the Create Order flow to preview a discount before submitting —
// doesn't increment usedCount (that only happens once an order is actually
// created, via incrementCouponUsage).
router.post('/coupons/validate', requireAdmin, async (req, res, next) => {
  try {
    const { code, subtotal } = req.body
    const result = await validateCoupon(code, parseFloat(subtotal) || 0)
    if (!result) return res.status(400).json({ error: 'Coupon code is required' })
    res.json({ code: result.coupon.code, discountAmount: result.discountAmount })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// ─── SHIPPING METHODS ────────────────────────────────────────────────────────
// Admin-configurable courier list — replaces what used to be a hardcoded map
// in logisticsService.js. See that file for how fulfillOrder() reads this.
router.get('/shipping-methods', requireAdmin, async (req, res, next) => {
  try {
    const methods = await prisma.shippingMethod.findMany({ orderBy: { name: 'asc' } })
    res.json(methods)
  } catch (err) { next(err) }
})

router.post('/shipping-methods', requireAdmin, async (req, res, next) => {
  try {
    const { key, name, trackingUrlTemplate, estimatedDays } = req.body
    if (!key?.trim() || !name?.trim()) return res.status(400).json({ error: 'key and name are required' })
    const method = await prisma.shippingMethod.create({
      data: {
        key: key.trim().toUpperCase().replace(/\s+/g, '_'),
        name: name.trim(),
        trackingUrlTemplate: trackingUrlTemplate || null,
        estimatedDays: estimatedDays ? parseInt(estimatedDays) : null
      }
    })
    res.status(201).json(method)
  } catch (err) { next(err) }
})

router.patch('/shipping-methods/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, trackingUrlTemplate, estimatedDays, active } = req.body
    const method = await prisma.shippingMethod.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(trackingUrlTemplate !== undefined && { trackingUrlTemplate }),
        ...(estimatedDays !== undefined && { estimatedDays: estimatedDays ? parseInt(estimatedDays) : null }),
        ...(active !== undefined && { active: !!active }),
      }
    })
    res.json(method)
  } catch (err) { next(err) }
})

router.delete('/shipping-methods/:id', requireAdmin, async (req, res, next) => {
  try {
    // Soft-disable rather than hard-delete — existing orders' courierName is
    // a frozen string snapshot, but keeping the row avoids ever losing which
    // key a historical fulfillment actually used.
    const method = await prisma.shippingMethod.update({ where: { id: req.params.id }, data: { active: false } })
    res.json(method)
  } catch (err) { next(err) }
})

// ─── TAX RATES ───────────────────────────────────────────────────────────────
router.get('/tax-rates', requireAdmin, async (req, res, next) => {
  try {
    const rates = await prisma.taxRate.findMany({ orderBy: { name: 'asc' } })
    res.json(rates)
  } catch (err) { next(err) }
})

router.post('/tax-rates', requireAdmin, async (req, res, next) => {
  try {
    const { name, rate, region, isDefault } = req.body
    if (!name?.trim() || rate === undefined) return res.status(400).json({ error: 'name and rate are required' })

    const result = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.taxRate.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
      return tx.taxRate.create({
        data: { name: name.trim(), rate: parseFloat(rate), region: region || null, isDefault: !!isDefault }
      })
    })
    res.status(201).json(result)
  } catch (err) { next(err) }
})

router.patch('/tax-rates/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, rate, region, isDefault, active } = req.body
    const result = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.taxRate.updateMany({ data: { isDefault: false }, where: { isDefault: true } })
      return tx.taxRate.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(rate !== undefined && { rate: parseFloat(rate) }),
          ...(region !== undefined && { region }),
          ...(isDefault !== undefined && { isDefault: !!isDefault }),
          ...(active !== undefined && { active: !!active }),
        }
      })
    })
    res.json(result)
  } catch (err) { next(err) }
})

router.delete('/tax-rates/:id', requireAdmin, async (req, res, next) => {
  try {
    const rate = await prisma.taxRate.update({ where: { id: req.params.id }, data: { active: false, isDefault: false } })
    res.json(rate)
  } catch (err) { next(err) }
})

export default router




