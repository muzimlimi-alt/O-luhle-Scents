import { Router } from 'express'
import { sendContactMessage } from '../utils/email.js'
import { contactLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Email validation regex — RFC 5322 simplified (mirrors newsletter.js)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact/send
// Body: { name, email, phone?, subject?, message }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body || {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ type: 'error', message: 'Please enter your full name.' })
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        type: 'error',
        message: "That doesn't look like a valid email address. Please double-check and try again.",
      })
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ type: 'error', message: 'Please enter a message of at least 10 characters.' })
    }

    await sendContactMessage({
      name: name.trim(),
      email: email.trim(),
      phone: phone ? String(phone).trim() : '',
      subject: subject ? String(subject).trim() : '',
      message: message.trim(),
    })

    return res.status(200).json({
      type: 'success',
      message: "Thanks for reaching out — our team will get back to you shortly.",
    })

  } catch (err) {
    console.error('[Contact] Send error:', err)
    return res.status(500).json({ type: 'error', message: 'Something went wrong on our end. Please try again shortly.' })
  }
})

export default router
