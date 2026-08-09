import { Router } from 'express'
import { requireCustomer } from '../middleware/auth.js'
import { recordConsent, currentConsent, consentHistory, CONSENT_PURPOSES } from '../lib/consentService.js'
import { exportCustomerData, createDataSubjectRequest } from '../lib/dataSubjectService.js'
import prisma from '../lib/prisma.js'

const router = Router()

// Everything below is scoped to the logged-in customer's own data — this is
// the Privacy Centre's API (account.html "Privacy" tab). requireCustomer
// already restricts req.customerId to the token holder; every query below
// filters by it explicitly too, so a bug in one query can't leak another
// customer's record.

router.get('/consent', requireCustomer, async (req, res, next) => {
  try {
    const [current, history] = await Promise.all([
      currentConsent({ customerId: req.customerId }),
      consentHistory({ customerId: req.customerId }),
    ])
    res.json({ purposes: CONSENT_PURPOSES, current, history })
  } catch (err) { next(err) }
})

router.post('/consent', requireCustomer, async (req, res, next) => {
  try {
    const { purpose, granted } = req.body
    if (!CONSENT_PURPOSES.includes(purpose) || typeof granted !== 'boolean') {
      return res.status(400).json({ error: 'purpose and granted (boolean) are required' })
    }
    const record = await recordConsent({
      customerId: req.customerId,
      purpose,
      granted,
      method: 'account_settings',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
    res.status(201).json(record)
  } catch (err) { next(err) }
})

router.get('/export', requireCustomer, async (req, res, next) => {
  try {
    const data = await exportCustomerData(req.customerId)
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"')
    res.json(data)
  } catch (err) { next(err) }
})

router.get('/requests', requireCustomer, async (req, res, next) => {
  try {
    const requests = await prisma.dataSubjectRequest.findMany({
      where: { customerId: req.customerId },
      orderBy: { requestedAt: 'desc' },
    })
    res.json(requests)
  } catch (err) { next(err) }
})

const REQUEST_TYPES = ['access', 'correction', 'deletion', 'objection', 'portability']

router.post('/requests', requireCustomer, async (req, res, next) => {
  try {
    const { type, details } = req.body
    if (!REQUEST_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${REQUEST_TYPES.join(', ')}` })
    }
    if (type === 'deletion') {
      // Requires typing the confirmation phrase client-side, but the API is
      // the actual guard against an accidental/scripted call.
      if (req.body.confirm !== 'DELETE MY ACCOUNT') {
        return res.status(400).json({ error: 'Deletion requires explicit confirmation' })
      }
    }
    const request = await createDataSubjectRequest({ customerId: req.customerId, type, details })
    res.status(201).json(request)
  } catch (err) { next(err) }
})

export default router
