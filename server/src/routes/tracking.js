import { Router } from 'express'
import { getTrackingInfo } from '../lib/logisticsService.js'

const router = Router()

// GET /api/tracking/:number
router.get('/:number', async (req, res, next) => {
  try {
    const info = await getTrackingInfo(req.params.number)
    if (!info) return res.status(404).json({ error: 'Tracking number not found' })
    res.json(info)
  } catch (err) { next(err) }
})

export default router
