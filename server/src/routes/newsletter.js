import { Router } from 'express'
import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { sendNewsletterConfirmation } from '../utils/email.js'
import { requireAdmin } from '../middleware/auth.js'
import { newsletterLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Email validation regex — RFC 5322 simplified
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Generate a cryptographically secure unsubscribe token (64 hex chars = 256-bit) */
function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

/** Token TTL: 90 days from now */
function tokenExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + 90)
  return d
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/subscribe
// Body: { email: string, source?: string, addedBy?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscribe', newsletterLimiter, async (req, res) => {
  try {
    const rawEmail = req.body?.email
    const source   = req.body?.source || 'frontend'   // frontend | checkout | admin
    const addedBy  = req.body?.addedBy || null         // admin name/ID, only for admin source

    // 1. Presence check
    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ type: 'error', message: 'Please provide an email address.' })
    }

    const email = rawEmail.trim().toLowerCase()

    // 2. Format validation
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        type: 'error',
        message: "That doesn't look like a valid email address. Please double-check and try again.",
      })
    }

    // 3. Duplicate check
    const existing = await prisma.subscriber.findUnique({ where: { email } })

    if (existing) {
      // For checkout/admin: silently upsert to refresh source if they changed channel
      if (source !== 'frontend') {
        // Update only if currently unsubscribed (re-activate via fresh opt-in)
        if (existing.status === 'unsubscribed') {
          const token = generateToken()
          await prisma.subscriber.update({
            where: { email },
            data: { status: 'active', source, addedBy, unsubscribeToken: token, tokenExpiresAt: tokenExpiry() },
          })
          // Fire confirmation email (non-blocking)
          sendNewsletterConfirmation(email, token).catch(err =>
            console.warn('[Newsletter] Email send failed:', err.message)
          )
        }
        // Return silent upsert success for checkout flow
        return res.status(200).json({ type: 'success', message: 'Already subscribed.' })
      }

      // Frontend: friendly warning
      return res.status(200).json({
        type: 'warning',
        message: "You're already part of the O'luhle Circle — no need to subscribe again.",
      })
    }

    // 4. Create subscriber with token
    const token = generateToken()
    await prisma.subscriber.create({
      data: {
        email,
        status: 'active',
        source,
        addedBy,
        unsubscribeToken: token,
        tokenExpiresAt: tokenExpiry(),
      },
    })

    // 5. Send confirmation email (non-blocking — never fails the request)
    sendNewsletterConfirmation(email, token).catch(err =>
      console.warn('[Newsletter] Confirmation email failed:', err.message)
    )

    return res.status(201).json({
      type: 'success',
      message: "Thank you for joining the O'luhle Circle! Exclusive offers and new arrivals are on their way.",
    })

  } catch (err) {
    console.error('[Newsletter] Subscription error:', err)
    return res.status(500).json({ type: 'error', message: 'Something went wrong on our end. Please try again shortly.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/newsletter/unsubscribe?token=xxx
// Validates the token and serves unsubscribe confirmation info (used by the
// unsubscribe.html page to call POST and confirm action)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.query

    if (!token) {
      return res.status(400).json({ valid: false, reason: 'missing_token' })
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, email: true, status: true, tokenExpiresAt: true },
    })

    if (!subscriber) {
      return res.status(404).json({ valid: false, reason: 'invalid_token' })
    }

    // Check expiry
    if (subscriber.tokenExpiresAt && new Date() > new Date(subscriber.tokenExpiresAt)) {
      return res.status(410).json({ valid: false, reason: 'expired_token' })
    }

    if (subscriber.status === 'unsubscribed') {
      return res.status(200).json({ valid: true, alreadyUnsubscribed: true, email: subscriber.email })
    }

    return res.status(200).json({ valid: true, alreadyUnsubscribed: false, email: subscriber.email })

  } catch (err) {
    console.error('[Newsletter] Unsubscribe check error:', err)
    return res.status(500).json({ valid: false, reason: 'server_error' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/unsubscribe
// Body: { token: string }
// Confirms the unsubscription — sets status to 'unsubscribed'
// ─────────────────────────────────────────────────────────────────────────────
router.post('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ success: false, reason: 'missing_token', message: 'No unsubscribe token provided.' })
    }

    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, email: true, status: true, tokenExpiresAt: true },
    })

    if (!subscriber) {
      return res.status(404).json({ success: false, reason: 'invalid_token', message: 'This unsubscribe link is invalid.' })
    }

    // Check token expiry
    if (subscriber.tokenExpiresAt && new Date() > new Date(subscriber.tokenExpiresAt)) {
      return res.status(410).json({ success: false, reason: 'expired_token', message: 'This unsubscribe link has expired. Please contact us at info@oluhlescents.co.za to be removed.' })
    }

    if (subscriber.status === 'unsubscribed') {
      return res.status(200).json({ success: true, alreadyUnsubscribed: true, message: "You've already been removed from our mailing list." })
    }

    // Mark as unsubscribed
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'unsubscribed',
        // Rotate token after use so the link cannot be reused
        unsubscribeToken: generateToken(),
        tokenExpiresAt: tokenExpiry(),
      },
    })

    return res.status(200).json({
      success: true,
      alreadyUnsubscribed: false,
      email: subscriber.email,
      message: "You've been successfully unsubscribed from the O'luhle Circle.",
    })

  } catch (err) {
    console.error('[Newsletter] Unsubscribe POST error:', err)
    return res.status(500).json({ success: false, reason: 'server_error', message: 'Something went wrong. Please try again or contact us directly.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/subscribers/bulk — Admin: Mass Actions
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscribers/bulk', requireAdmin, async (req, res) => {
  try {
    const { ids, action } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No subscribers selected.' })
    }
    
    if (action === 'delete') {
      await prisma.subscriber.deleteMany({
        where: { id: { in: ids } }
      })
      return res.status(200).json({ success: true, message: `Successfully deleted ${ids.length} subscribers.` })
    }
    
    if (action === 'unsubscribe') {
      await prisma.subscriber.updateMany({
        where: { id: { in: ids } },
        data: { status: 'unsubscribed' }
      })
      return res.status(200).json({ success: true, message: `Successfully unsubscribed ${ids.length} entries.` })
    }
    
    return res.status(400).json({ error: 'Invalid bulk action specified.' })
  } catch (err) {
    console.error('[Newsletter] Bulk Action error:', err)
    return res.status(500).json({ error: 'Bulk processing failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/newsletter/subscribers — Admin: list all subscribers
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscribers', requireAdmin, async (req, res) => {
  try {
    const { status, source, page = '1', limit = '50', startDate, endDate } = req.query
    const where = {}
    if (status) where.status = status
    if (source) where.source = source
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [subscribers, total] = await Promise.all([
      prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: { id: true, email: true, status: true, source: true, addedBy: true, createdAt: true },
      }),
      prisma.subscriber.count({ where }),
    ])

    return res.json({ subscribers, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    console.error('[Newsletter] Subscriber list error:', err)
    return res.status(500).json({ error: 'Failed to fetch subscribers' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/subscribers — Admin: Add subscriber manually
// ─────────────────────────────────────────────────────────────────────────────
router.post('/subscribers', requireAdmin, async (req, res) => {
  try {
    const { email } = req.body
    if (!email || !EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Valid email is required.' })
    
    // Check if exists
    let subscriber = await prisma.subscriber.findUnique({ where: { email } })
    if (subscriber) {
      if (subscriber.status === 'active') return res.status(400).json({ error: 'Subscriber already exists and is active.' })
      
      const token = generateToken()
      subscriber = await prisma.subscriber.update({
        where: { email },
        data: { status: 'active', source: 'admin', addedBy: req.user.name, unsubscribeToken: token, tokenExpiresAt: tokenExpiry() }
      })
    } else {
      const token = generateToken()
      subscriber = await prisma.subscriber.create({
        data: { email, status: 'active', source: 'admin', addedBy: req.user.name, unsubscribeToken: token, tokenExpiresAt: tokenExpiry() }
      })
    }
    
    return res.status(201).json({ subscriber })
  } catch (err) {
    console.error('[Newsletter] Add subscriber error:', err)
    return res.status(500).json({ error: 'Failed to add subscriber' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/newsletter/subscribers/:id — Admin: Edit subscriber
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/subscribers/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body
    if (!['active', 'unsubscribed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' })
    
    const subscriber = await prisma.subscriber.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, email: true, status: true, source: true, addedBy: true, createdAt: true }
    })
    
    return res.json({ subscriber })
  } catch (err) {
    console.error('[Newsletter] Update subscriber error:', err)
    return res.status(500).json({ error: 'Failed to update subscriber' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/newsletter/subscribers/:id — Admin: Delete subscriber
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/subscribers/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.subscriber.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    console.error('[Newsletter] Delete subscriber error:', err)
    return res.status(500).json({ error: 'Failed to delete subscriber' })
  }
})

import multer from 'multer'
import path from 'path'
import fs from 'fs'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'tmp', 'campaign_attachments')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase()
    cb(null, `${name}-${Date.now()}${ext}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB limit

// --- Public Images Storage for Quill ---
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'images', 'newsletter')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase()
    cb(null, `img-${Date.now()}${ext}`)
  }
})
const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } })

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/campaigns/upload — Admin: Upload attachment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  
  // Store the local path and original filename so Nodemailer can use it
  res.json({
    filename: req.file.originalname,
    path: req.file.path,
    mimetype: req.file.mimetype,
    size: req.file.size
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/campaigns/image-upload — Admin: Upload embedded image
// Returns a public URL for the Quill editor
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/image-upload', requireAdmin, uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' })
  
  // Calculate public URL
  // We use the protocol and host from the request headers to ensure it works via ngrok
  const protocol = req.headers['x-forwarded-proto'] || req.protocol
  const host = req.headers['x-forwarded-host'] || req.get('host')
  const publicUrl = `${protocol}://${host}/images/newsletter/${req.file.filename}`
  
  console.log(`[Newsletter] Public Image Uploaded: ${publicUrl}`)
  res.json({ url: publicUrl })
})

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const validateCampaign = (data) => {
  const { subject, contentHtml } = data
  if (!subject || subject.trim().length < 3) return 'A valid subject line is required (min 3 chars).'
  if (!contentHtml || contentHtml.trim().replace(/<[^>]*>/g, '').length < 10) return 'Campaign content is too short. Please provide some meaningful text.'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/newsletter/campaigns — Admin: List Campaigns
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns', requireAdmin, async (req, res) => {
  try {
    const { page = '1', limit = '50', startDate, endDate } = req.query
    const where = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [campaigns, total] = await Promise.all([
      prisma.newsletterCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: { adminUser: { select: { name: true } } }
      }),
      prisma.newsletterCampaign.count({ where }),
    ])
    
    return res.json({ campaigns, total, page: parseInt(page), limit: parseInt(limit) })
  } catch (err) {
    console.error('[Newsletter] List campaigns error:', err)
    return res.status(500).json({ error: 'Failed to fetch campaigns' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/campaigns — Admin: Create Draft Campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns', requireAdmin, async (req, res) => {
  try {
    const { subject, contentHtml, attachments } = req.body
    
    // Validation
    const error = validateCampaign({ subject, contentHtml })
    if (error) return res.status(400).json({ error })
    
    const campaign = await prisma.newsletterCampaign.create({
      data: {
        subject: subject.trim(),
        contentHtml: contentHtml || '',
        attachments: attachments || [],
        adminUserId: req.user.id
      }
    })
    
    console.log(`[Newsletter] Campaign Draft Created: ${campaign.id} by Admin: ${req.user.name}`)
    return res.status(201).json({ campaign })
  } catch (err) {
    console.error('[Newsletter] Create campaign error:', err)
    return res.status(500).json({ error: 'Failed to create campaign draft.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/newsletter/campaigns/:id — Admin: Update Draft Campaign
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const { subject, contentHtml, attachments } = req.body
    
    // Validation
    const error = validateCampaign({ subject, contentHtml })
    if (error) return res.status(400).json({ error })
    
    const campaign = await prisma.newsletterCampaign.update({
      where: { id: req.params.id },
      data: {
        subject: subject.trim(),
        contentHtml,
        attachments,
        updatedAt: new Date()
      }
    })
    
    console.log(`[Newsletter] Campaign Draft Updated: ${campaign.id}`)
    return res.json({ campaign })
  } catch (err) {
    console.error('[Newsletter] Update campaign error:', err)
    return res.status(500).json({ error: 'Failed to update campaign draft.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/newsletter/campaigns/:id — Admin: Delete Draft Campaign
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const campaign = await prisma.newsletterCampaign.findUnique({ where: { id: req.params.id } })
    if (campaign?.status === 'sent') return res.status(400).json({ error: 'Cannot delete a sent campaign.' })
    
    await prisma.newsletterCampaign.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    console.error('[Newsletter] Delete campaign error:', err)
    return res.status(500).json({ error: 'Failed to delete campaign' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/newsletter/campaigns/:id/send — Admin: Send Broadcast
// ─────────────────────────────────────────────────────────────────────────────
import { sendCampaignBroadcast } from '../utils/email.js'

router.post('/campaigns/:id/send', requireAdmin, async (req, res) => {
  try {
    const campaign = await prisma.newsletterCampaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaign already sent' })
    
    // Readiness Check
    const validationError = validateCampaign(campaign)
    if (validationError) return res.status(400).json({ error: `Campaign is not ready to send: ${validationError}` })

    // Fetch all active subscribers
    const subscribers = await prisma.subscriber.findMany({
      where: { status: 'active' },
      select: { email: true, unsubscribeToken: true }
    })

    if (subscribers.length === 0) {
      return res.status(400).json({ error: 'There are no active subscribers to send this campaign to.' })
    }
    
    // Mark as sending
    await prisma.newsletterCampaign.update({
      where: { id: campaign.id },
      data: { status: 'sending' }
    })
    
    // Respond immediately, process in background
    res.json({ message: 'Broadcast queued for sending.', targetCount: subscribers.length })
    
    // Background dispatch
    setTimeout(async () => {
      try {
        let sentCount = 0
        for (const sub of subscribers) {
          try {
            await sendCampaignBroadcast(sub.email, sub.unsubscribeToken, campaign)
            sentCount++
          } catch (e) {
            console.warn(`[Newsletter] Failed to send campaign to ${sub.email}:`, e.message)
          }
        }
        
        // Update campaign status
        await prisma.newsletterCampaign.update({
          where: { id: campaign.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            sentCount
          }
        })
        
        // Log to Audit Log
        await prisma.auditLog.create({
          data: {
            adminUserId: req.user.id,
            action: 'SENT_CAMPAIGN',
            entity: 'NewsletterCampaign',
            entityId: campaign.id,
            details: { subject: campaign.subject, sentCount, targetedCount: subscribers.length }
          }
        })
      } catch (err) {
        console.error('[Newsletter] Broadcast dispatch error:', err)
        await prisma.newsletterCampaign.update({ where: { id: campaign.id }, data: { status: 'failed' } }).catch(() => {})
      }
    }, 0)

  } catch (err) {
    console.error('[Newsletter] Send campaign error:', err)
    return res.status(500).json({ error: 'Failed to queue campaign' })
  }
})

export default router

