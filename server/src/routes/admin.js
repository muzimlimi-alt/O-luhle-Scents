import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/admin/metrics
router.get('/metrics', requireAdmin, async (req, res, next) => {
  try {
    // 1. Total Revenue (Paid/Shipped/Delivered)
    const revenueData = await prisma.order.aggregate({
      where: { status: { in: ['paid', 'shipped', 'delivered'] } },
      _sum: { total: true },
    })

    // 2. Total Orders (All time)
    const totalOrders = await prisma.order.count()

    // 3. Total Customers (Unique users with CUSTOMER role)
    const totalCustomers = await prisma.user.count({
      where: { role: 'CUSTOMER' }
    })

    res.json({
      totalRevenue: revenueData._sum.total || 0,
      totalOrders,
      totalCustomers
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/sales
router.get('/sales', requireAdmin, async (req, res, next) => {
  try {
    const period = parseInt(req.query.period) || 30
    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000)

    const dailySales = await prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, total: true, status: true }
    })

    // Grouping in JS is safer for SQLite + Prisma DateTime quirks
    const groups = {}
    dailySales.forEach(o => {
      const date = o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)
      if (isNaN(date.getTime())) return // Skip invalid dates
      const day = date.toISOString().slice(0, 10)
      if (!groups[day]) groups[day] = { date: day, count: 0, revenue: 0 }
      groups[day].count++
      if (['paid', 'shipped', 'delivered'].includes((o.status || '').toLowerCase())) {
        groups[day].revenue += o.total || 0
      }
    })

    const daily = Object.values(groups).sort((a, b) => a.date.localeCompare(b.date))

    res.json(daily)
  } catch (err) {
    next(err)
  }
})

export default router
