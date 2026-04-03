/**
 * GET /api/admin/analytics
 *
 * Returns aggregated sales data for the admin dashboard.
 * All calculations are done server-side from the database — never from
 * frontend-reported values.
 *
 * Query param:
 *   period (number, default 30) — number of days to look back for daily data
 */

import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const period = Math.min(Math.max(parseInt(req.query.period) || 30, 1), 365)
    const since  = new Date(Date.now() - period * 24 * 60 * 60 * 1000)

    // ── 1. Overall revenue (from orders that have been paid or beyond) ────────
    const revenueData = await prisma.order.aggregate({
      where:  { status: { in: ['paid', 'shipped', 'delivered'] } },
      _sum:   { totalAmount: true },
      _count: { id: true },
    })

    const totalRevenue = revenueData._sum.totalAmount || 0
    const paidCount    = revenueData._count.id || 0
    const avgOrderValue = paidCount > 0 ? totalRevenue / paidCount : 0

    // ── 2. All-time order counts by status (conversion funnel) ────────────────
    const statusCounts = await prisma.order.groupBy({
      by:      ['status'],
      _count:  { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    const funnel = statusCounts.map(s => ({ status: s.status, count: s._count.id }))
    const totalOrders = funnel.reduce((s, r) => s + r.count, 0)

    // ── 3. Daily orders & revenue for the selected period ─────────────────────
    // Using $queryRaw for date truncation — Prisma groupBy doesn't support it.
    const dailyRaw = await prisma.$queryRaw`
      SELECT
        date_trunc('day', "createdAt" AT TIME ZONE 'UTC')::date AS day,
        COUNT(*)::int                                            AS count,
        COALESCE(SUM("totalAmount"), 0)::float                  AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `
    const daily = dailyRaw.map(row => ({
      date:    row.day.toISOString().slice(0, 10),
      count:   Number(row.count),
      revenue: Number(row.revenue),
    }))

    // ── 4. Top 5 products by units sold (all time) ────────────────────────────
    const topProductsRaw = await prisma.orderItem.groupBy({
      by:      ['productId'],
      _sum:    { quantity: true, price: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take:    5,
    })

    // Enrich with product name + SKU
    const productIds = topProductsRaw.map(r => r.productId)
    const products   = await prisma.product.findMany({
      where:  { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    })
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))

    const topProducts = topProductsRaw.map(r => ({
      productId:    r.productId,
      name:         productMap[r.productId]?.name  || '(deleted)',
      sku:          productMap[r.productId]?.sku   || '—',
      totalUnits:   r._sum.quantity || 0,
      totalRevenue: r._sum.price    || 0,
    }))

    // ── 5. This month vs last month revenue (growth) ──────────────────────────
    const now          = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [thisMonthAgg, lastMonthAgg] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status:    { in: ['paid', 'shipped', 'delivered'] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          status:    { in: ['paid', 'shipped', 'delivered'] },
          createdAt: { gte: startOfLast, lt: startOfMonth },
        },
        _sum: { totalAmount: true },
      }),
    ])

    const thisMonth  = thisMonthAgg._sum.totalAmount  || 0
    const lastMonth  = lastMonthAgg._sum.totalAmount  || 0
    const pctChange  = lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : null

    res.json({
      period,
      revenue: {
        total:     totalRevenue,
        paid:      paidCount,
        average:   Math.round(avgOrderValue * 100) / 100,
        thisMonth,
        lastMonth,
        growth:    pctChange,   // % change vs last month, null if no last-month data
      },
      totalOrders,
      funnel,
      daily,
      topProducts,
    })
  } catch (err) {
    next(err)
  }
})

export default router
