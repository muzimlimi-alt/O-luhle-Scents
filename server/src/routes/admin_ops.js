import { Router } from 'express'
import fs from 'fs'
import bcrypt from 'bcryptjs'

import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import nodemailer from 'nodemailer'

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


// ─── PURCHASES ───────────────────────────────────────────────────────────────
router.get('/purchases', requireAdmin, async (req, res, next) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(purchases)
  } catch (err) {
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

export default router




