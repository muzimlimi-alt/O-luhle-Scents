import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { loginLimiter } from '../middleware/rateLimit.js'

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

    res.json({
      token,
      user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    })
  } catch (err) { 
    console.error('[Login Failure]', err);
    next(err);
  }
})

// GET /api/auth/me — verify session
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' })
    
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    const admin = await prisma.adminUser.findUnique({ where: { id: decoded.id } })
    if (!admin || !admin.isActive) return res.status(401).json({ error: 'Account deactivated' })

    res.json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role })
  } catch (err) { 
    res.status(401).json({ error: 'Session expired' })
  }
})


export default router
