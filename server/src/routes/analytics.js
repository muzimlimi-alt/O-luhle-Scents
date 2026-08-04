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
        date_trunc('day', "created_at" AT TIME ZONE 'UTC')::date AS day,
        COUNT(*)::int                                            AS count,
        COALESCE(SUM("total_amount"), 0)::float                 AS revenue
      FROM "orders"
      WHERE "created_at" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `
    const daily = dailyRaw.map(row => ({
      date:    row.day.toISOString().slice(0, 10),
      count:   Number(row.count),
      revenue: Number(row.revenue),
    }))

    // ── 4. Top 5 products by units sold (all time) ────────────────────────────
    // OrderItem has no productId/price column (grouped by variantId, with
    // priceAtPurchase per unit) — and quantity*price aggregation isn't
    // something Prisma's groupBy can express, so this is summed in JS.
    // Uses the frozen productNameSnapshot/skuSnapshot rather than a live
    // Product join, matching how the rest of the codebase treats historical
    // line items (a renamed/deleted product must not rewrite past analytics).
    const allItems = await prisma.orderItem.findMany({
      select: {
        variantId: true,
        quantity: true,
        priceAtPurchase: true,
        productNameSnapshot: true,
        skuSnapshot: true,
        variant: { select: { sku: true, product: { select: { name: true } } } },
      },
    })

    const byVariant = {}
    for (const item of allItems) {
      const key = item.variantId || item.skuSnapshot || item.productNameSnapshot
      if (!key) continue
      if (!byVariant[key]) {
        // Snapshot fields are only populated from PIM Phase 1 onward — older
        // rows fall back to the live variant/product relation (per the
        // schema's own comment), and only read "(deleted)" once both the
        // snapshot and the live relation are gone.
        byVariant[key] = {
          variantId:    item.variantId,
          name:         item.productNameSnapshot || item.variant?.product?.name || '(deleted)',
          sku:          item.skuSnapshot || item.variant?.sku || '—',
          totalUnits:   0,
          totalRevenue: 0,
        }
      }
      byVariant[key].totalUnits   += item.quantity
      byVariant[key].totalRevenue += item.quantity * Number(item.priceAtPurchase)
    }

    const topProducts = Object.values(byVariant)
      .sort((a, b) => b.totalUnits - a.totalUnits)
      .slice(0, 5)

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

    // ── 6. Customer retention — of customers who ordered within the selected
    //      period, what fraction had already ordered at least once before it ──
    const recentCustomers = await prisma.order.findMany({
      where:    { createdAt: { gte: since }, customerId: { not: null } },
      select:   { customerId: true },
      distinct: ['customerId'],
    })
    const recentCustomerIds = recentCustomers.map(c => c.customerId)

    let returningCount = 0
    if (recentCustomerIds.length > 0) {
      const priorOrders = await prisma.order.findMany({
        where:    { customerId: { in: recentCustomerIds }, createdAt: { lt: since } },
        select:   { customerId: true },
        distinct: ['customerId'],
      })
      returningCount = priorOrders.length
    }

    const retention = {
      activeCustomers: recentCustomerIds.length,
      returning:        returningCount,
      rate:             recentCustomerIds.length > 0
        ? Math.round((returningCount / recentCustomerIds.length) * 100)
        : null,
    }

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
      retention,
    })
  } catch (err) {
    next(err)
  }
})

export default router
