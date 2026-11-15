import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { asciiFilename } from '../lib/uploadNames.js'
import { requireCustomer } from '../middleware/auth.js'
import { loginLimiter } from '../middleware/rateLimit.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import { uploadProofMiddleware } from '../lib/eftUpload.js'
import { uploadProof } from '../lib/eftPaymentService.js'

const router = Router()

function signCustomerToken(customer) {
  return jwt.sign(
    { id: customer.id, email: customer.email, type: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )
}

// POST /api/customers/register — creates a new account, or attaches a
// password to an existing guest Customer row for the same email (so prior
// guest-checkout order history is automatically inherited on registration).
router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } })
    if (existing?.passwordHash) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: { passwordHash, name: existing.name || name, phone: existing.phone || phone }
        })
      : await prisma.customer.create({
          data: { email: normalizedEmail, name, phone, passwordHash }
        })

    const token = signCustomerToken(customer)
    res.status(201).json({ token, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } })
  } catch (err) { next(err) }
})

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

    const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!customer?.passwordHash) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, customer.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const token = signCustomerToken(customer)
    res.json({ token, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone } })
  } catch (err) { next(err) }
})

router.post('/forgot-password', loginLimiter, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'email is required' })

    const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase().trim() } })
    // Always respond 200 regardless of whether the account exists — don't
    // let this endpoint be used to enumerate registered emails.
    if (customer?.passwordHash) {
      const token = crypto.randomBytes(32).toString('hex')
      await prisma.customer.update({
        where: { id: customer.id },
        data: { passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) }
      })
      sendPasswordResetEmail(customer, token).catch(e => console.error('[Customers] Password reset email failed:', e.message))
    }
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' })
  } catch (err) { next(err) }
})

router.post('/reset-password', loginLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword are required' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const customer = await prisma.customer.findUnique({ where: { passwordResetToken: token } })
    if (!customer || !customer.passwordResetExpiresAt || customer.passwordResetExpiresAt < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null }
    })
    res.json({ message: 'Password updated — you can now log in.' })
  } catch (err) { next(err) }
})

router.get('/me', requireCustomer, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.customerId } })
    if (!customer) return res.status(404).json({ error: 'Account not found' })
    res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone })
  } catch (err) { next(err) }
})

router.patch('/me', requireCustomer, async (req, res, next) => {
  try {
    const { name, phone } = req.body
    const customer = await prisma.customer.update({
      where: { id: req.customerId },
      data: { ...(name !== undefined && { name }), ...(phone !== undefined && { phone }) }
    })
    res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone })
  } catch (err) { next(err) }
})

// ── Addresses ─────────────────────────────────────────────────────────────────
router.get('/me/addresses', requireCustomer, async (req, res, next) => {
  try {
    const addresses = await prisma.address.findMany({ where: { customerId: req.customerId }, orderBy: { createdAt: 'desc' } })
    res.json(addresses)
  } catch (err) { next(err) }
})

router.post('/me/addresses', requireCustomer, async (req, res, next) => {
  try {
    const { street, city, province, postalCode, country, isDefault } = req.body
    const address = await prisma.address.create({
      data: { customerId: req.customerId, street, city, province, postalCode, country: country || 'South Africa', isDefault: !!isDefault }
    })
    res.status(201).json(address)
  } catch (err) { next(err) }
})

router.patch('/me/addresses/:id', requireCustomer, async (req, res, next) => {
  try {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.customerId !== req.customerId) return res.status(404).json({ error: 'Address not found' })

    const { street, city, province, postalCode, country, isDefault } = req.body
    const address = await prisma.address.update({
      where: { id: req.params.id },
      data: {
        ...(street !== undefined && { street }),
        ...(city !== undefined && { city }),
        ...(province !== undefined && { province }),
        ...(postalCode !== undefined && { postalCode }),
        ...(country !== undefined && { country }),
        ...(isDefault !== undefined && { isDefault: !!isDefault }),
      }
    })
    res.json(address)
  } catch (err) { next(err) }
})

router.delete('/me/addresses/:id', requireCustomer, async (req, res, next) => {
  try {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.customerId !== req.customerId) return res.status(404).json({ error: 'Address not found' })

    await prisma.address.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
})

// ── Order history ────────────────────────────────────────────────────────────
router.get('/me/orders', requireCustomer, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.customerId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payments: { select: { paymentMethod: true, eftVerificationStatus: true } } }
    })
    res.json(orders)
  } catch (err) { next(err) }
})

router.get('/me/orders/:id', requireCustomer, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        shippingAddress: true,
        logisticsEvents: { orderBy: { createdAt: 'desc' } },
        payments: { include: { statusHistory: { orderBy: { createdAt: 'asc' } } } }
      }
    })
    if (!order || order.customerId !== req.customerId) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (err) { next(err) }
})

router.post('/me/orders/:id/proof', requireCustomer, uploadProofMiddleware, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!order || order.customerId !== req.customerId) {
      if (fs.existsSync(req.file.path)) fs.unlink(req.file.path, () => {})
      return res.status(404).json({ error: 'Order not found' })
    }

    const updated = await uploadProof(req.params.id, {
      filePath: req.file.path,
      fileName: asciiFilename(req.file.originalname),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      actorType: 'customer',
      actorId: req.customerId,
    })
    res.status(201).json({ eftVerificationStatus: updated.eftVerificationStatus })
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// GET /api/customers/me/orders/:id/proof — customer's own proof, ownership-checked.
router.get('/me/orders/:id/proof', requireCustomer, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payments: { where: { paymentMethod: 'manual_eft' } } }
    })
    if (!order || order.customerId !== req.customerId) return res.status(404).json({ error: 'Order not found' })

    const payment = order.payments[0]
    if (!payment?.proofOfPaymentUrl || !fs.existsSync(payment.proofOfPaymentUrl)) {
      return res.status(404).json({ error: 'No proof of payment on file' })
    }

    res.setHeader('Content-Type', payment.proofMimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${payment.proofFileName || 'proof'}"`)
    fs.createReadStream(payment.proofOfPaymentUrl).pipe(res)
  } catch (err) { next(err) }
})

export default router
