import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/admin/metrics/dashboard
router.get('/metrics/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const revenue = await prisma.order.aggregate({
      where: { status: { in: ['paid', 'shipped', 'delivered'] } },
      _sum: { totalAmount: true }
    })
    const orders = await prisma.order.count()
    const customers = await prisma.customer.count()

    // Prisma can't compare two columns of the same row (quantity <= lowStockThreshold)
    // in a where clause, so this is filtered in JS rather than the DB.
    const inventory = await prisma.inventory.findMany({
      select: { quantity: true, reserved: true, lowStockThreshold: true, variant: { select: { costPrice: true } } }
    })
    const lowStock = inventory.filter(i => i.quantity <= i.lowStockThreshold).length
    const outOfStock = inventory.filter(i => i.quantity - i.reserved <= 0).length
    const stockValue = inventory.reduce((sum, i) => sum + i.quantity * Number(i.variant?.costPrice || 0), 0)

    res.json({
      revenue: Number(revenue._sum.totalAmount) || 0,
      orders,
      customers,
      lowStock,
      outOfStock,
      stockValue
    })
  } catch (err) { next(err) }
})

// GET /api/admin/metrics/predictions
router.get('/metrics/predictions', requireAdmin, async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // 1. Fetch sales velocity for all variants
    const sales = await prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: thirtyDaysAgo }, status: { in: ['paid', 'shipped'] } } },
      select: { variantId: true, quantity: true }
    })

    const velocityMap = {}
    sales.forEach(s => {
      velocityMap[s.variantId] = (velocityMap[s.variantId] || 0) + s.quantity
    })

    // 2. Fetch current inventory
    const inventory = await prisma.inventory.findMany({
      include: { variant: { include: { product: true } } }
    })

    const predictions = inventory.map(inv => {
      const thirtyDaySales = velocityMap[inv.variantId] || 0
      const dailyVelocity = thirtyDaySales / 30
      
      let daysRemaining = Infinity
      if (dailyVelocity > 0) {
        daysRemaining = Math.floor(inv.quantity / dailyVelocity)
      }

      return {
        variantId: inv.variantId,
        productName: inv.variant.product.name,
        size: inv.variant.size,
        currentStock: inv.quantity,
        thirtyDaySales,
        dailyVelocity: dailyVelocity.toFixed(2),
        daysRemaining: daysRemaining === Infinity ? 999 : daysRemaining,
        predictionDate: daysRemaining === Infinity ? null : new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000)
      }
    }).sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 10)

    res.json(predictions)
  } catch (err) { next(err) }
})

// GET /api/admin/metrics/abandoned
router.get('/metrics/abandoned', requireAdmin, async (req, res, next) => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const abandonedOrders = await prisma.order.findMany({
      where: { 
        status: 'pending', 
        paymentStatus: 'unpaid',
        createdAt: { lt: twoHoursAgo },
        abandonedEmailSent: false 
      },
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json(abandonedOrders)
  } catch (err) { next(err) }
})

export default router

