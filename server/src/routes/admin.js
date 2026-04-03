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

    // SQLite-compatible date grouping using strftime
    const dailyRaw = await prisma.$queryRaw`
      SELECT 
        strftime('%Y-%m-%d', datetime(createdAt / 1000, 'unixepoch')) as day,
        COUNT(*)::int as count,
        COALESCE(SUM(total), 0)::float as revenue
      FROM "Order"
      WHERE createdAt >= ${since.getTime()}
      GROUP BY day
      ORDER BY day ASC
    `

    // Note: Since createdAt is a DateTime in Prisma but might be stored as milliseconds in some SQLite setups,
    // we handle the raw conversion carefully. If Prisma uses ISO strings in SQLite, we use different logic.
    // Let's use a safer approach that works with Prisma's default SQLite DateTime storage.
    
    // Actually, Prisma stores DateTime as ISO strings or integers depending on version/config.
    // Let's use a more robust way:
    const dailySales = await prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, total: true, status: true }
    })

    // Grouping in JS is safer for SQLite + Prisma DateTime quirks
    const groups = {}
    dailySales.forEach(o => {
      const day = o.createdAt.toISOString().slice(0, 10)
      if (!groups[day]) groups[day] = { date: day, count: 0, revenue: 0 }
      groups[day].count++
      if (['paid', 'shipped', 'delivered'].includes(o.status)) {
        groups[day].revenue += o.total
      }
    })

    const daily = Object.values(groups).sort((a, b) => a.date.localeCompare(b.date))

    res.json(daily)
  } catch (err) {
    next(err)
  }
})

export default router
