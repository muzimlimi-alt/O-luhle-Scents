import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import configStore from '../lib/configStore.js'

const router = Router()

// GET /api/admin/settings — admin: list all grouped
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const settings = await prisma.globalSetting.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }]
    })
    
    // Group them for easier UI rendering
    const grouped = settings.reduce((acc, s) => {
      if (!acc[s.group]) acc[s.group] = []
      acc[s.group].push(s)
      return acc
    }, {})

    res.json(grouped)
  } catch (err) { next(err) }
})

// POST /api/admin/settings — admin: bulk upsert
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { settings } = req.body // Expects [{ key, value, group }]
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings must be an array' })
    }

    await prisma.$transaction(async (tx) => {
      for (const s of settings) {
        await tx.globalSetting.upsert({
          where: { key: s.key },
          update: { value: s.value, group: s.group || 'general' },
          create: { key: s.key, value: s.value, group: s.group || 'general' }
        })

        // Audit Log for every change
        await tx.auditLog.create({
          data: {
            action: 'UPDATE_SETTING',
            entity: 'GlobalSetting',
            entityId: null,
            details: { key: s.key, value: s.value }
          }
        })
      }
    })

    // Invalidate Cache
    configStore.clearCache()
    
    res.json({ message: 'Global configuration synchronized successfully' })
  } catch (err) { next(err) }
})

export default router
