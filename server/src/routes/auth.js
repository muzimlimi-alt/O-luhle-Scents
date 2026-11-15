import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { loginLimiter } from '../middleware/rateLimit.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/login — Admin specifically
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Fulfillment access denied' })
    }

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid scent credentials' })
    }

    // Update Last Login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() }
    })

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    )

    // Tracked so this specific token can be revoked before it naturally
    // expires — logout below, or an admin force-revoking another admin's
    // sessions (admin_ops.js) both just delete this row. expiresAt mirrors
    // the JWT's own `exp` claim so the two can never drift apart.
    const { exp } = jwt.decode(token)
    await prisma.adminSession.create({
      data: { adminUserId: admin.id, token, expiresAt: new Date(exp * 1000) },
    })

    res.json({
      token,
      user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    })
  } catch (err) {
    console.error('[Login Failure]', err);
    next(err);
  }
})

// POST /api/auth/logout — ends this token's session immediately, rather than
// leaving it valid (just discarded client-side) until it naturally expires.
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await prisma.adminSession.deleteMany({ where: { token: req.token } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// GET /api/auth/me — verify session, returns identity + the flattened
// permission catalogue for the user's role so the admin UI can grey out
// buttons the server would reject anyway. See lib/permissions.js.
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' })

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const admin = await prisma.adminUser.findUnique({ where: { id: decoded.id } })
    if (!admin || !admin.isActive) return res.status(401).json({ error: 'Account deactivated' })

    const { permissionsForRole } = await import('../lib/permissions.js')
    res.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: permissionsForRole(admin.role),
    })
  } catch (err) {
    res.status(401).json({ error: 'Session expired' })
  }
})


export default router
