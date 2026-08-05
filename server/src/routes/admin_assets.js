import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { postAssetAcquisitionJournal, postDepreciationJournal, postAssetDisposalJournal } from '../lib/accountingService.js'

// Finance Phase 11 — Fixed Assets (straight-line depreciation only).
const router = Router()

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const assets = await prisma.asset.findMany({ orderBy: { purchaseDate: 'desc' } })
    res.json(assets)
  } catch (err) { next(err) }
})

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, category, purchaseDate, purchaseCost, salvageValue, usefulLifeMonths } = req.body
    const cost = parseFloat(purchaseCost)
    const life = parseInt(usefulLifeMonths)
    if (!name || !purchaseDate || !Number.isFinite(cost) || cost <= 0 || !Number.isInteger(life) || life <= 0) {
      return res.status(400).json({ error: 'name, purchaseDate, a positive purchaseCost, and a positive integer usefulLifeMonths are required' })
    }

    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          name,
          category: category || null,
          purchaseDate: new Date(purchaseDate),
          purchaseCost: cost,
          salvageValue: salvageValue != null && salvageValue !== '' ? parseFloat(salvageValue) : 0,
          usefulLifeMonths: life,
          adminUserId: req.adminId
        }
      })
      await postAssetAcquisitionJournal(tx, created)
      return created
    })

    res.status(201).json(asset)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// POST /:id/depreciate — runs straight-line monthly depreciation for a
// period (defaults to the current calendar month). Idempotent: a second
// call for the same asset+period is rejected by DepreciationEntry's unique
// constraint before any journal posts.
router.post('/:id/depreciate', requireAdmin, async (req, res, next) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } })
    if (!asset) return res.status(404).json({ error: 'Asset not found' })
    if (asset.status !== 'ACTIVE') return res.status(400).json({ error: 'Asset is not active' })

    const now = new Date()
    const period = req.body.period || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const monthlyAmount = Math.round(((Number(asset.purchaseCost) - Number(asset.salvageValue)) / asset.usefulLifeMonths + Number.EPSILON) * 100) / 100

    const result = await prisma.$transaction(async (tx) => {
      let entry
      try {
        entry = await tx.depreciationEntry.create({ data: { assetId: asset.id, period, amount: monthlyAmount } })
      } catch (err) {
        if (err.code === 'P2002') {
          throw Object.assign(new Error(`Depreciation for ${period} has already been posted for this asset`), { status: 400 })
        }
        throw err
      }
      await postDepreciationJournal(tx, asset, period, monthlyAmount)
      return entry
    })

    res.status(201).json(result)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.post('/:id/dispose', requireAdmin, async (req, res, next) => {
  try {
    const { disposalDate, disposalProceeds } = req.body
    const proceeds = disposalProceeds != null && disposalProceeds !== '' ? parseFloat(disposalProceeds) : 0
    if (!Number.isFinite(proceeds) || proceeds < 0) {
      return res.status(400).json({ error: 'disposalProceeds must be a non-negative number' })
    }

    const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, include: { depreciationEntries: true } })
    if (!asset) return res.status(404).json({ error: 'Asset not found' })
    if (asset.status !== 'ACTIVE') return res.status(400).json({ error: 'Asset is not active' })

    const accumulatedDepreciation = asset.depreciationEntries.reduce((sum, e) => sum + Number(e.amount), 0)

    const updated = await prisma.$transaction(async (tx) => {
      await postAssetDisposalJournal(tx, asset, proceeds, accumulatedDepreciation)
      return tx.asset.update({
        where: { id: asset.id },
        data: { status: 'DISPOSED', disposalDate: disposalDate ? new Date(disposalDate) : new Date(), disposalProceeds: proceeds }
      })
    })

    res.json(updated)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router
