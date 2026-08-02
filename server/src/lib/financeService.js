import prisma from './prisma.js'

// Same "counts as sold" definition already used by reportService.js's
// monthly PDF, kept consistent so the two reports never disagree.
const REVENUE_STATUSES = ['paid', 'shipped', 'delivered']

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }

// COGS/margin can only ever be as accurate as OrderItem.costAtPurchase —
// the snapshot introduced alongside PIM Phase 1. Orders placed before that
// shipped have no snapshot, so this never fabricates a cost for them; it
// reports exactly how much of revenue has real cost data behind it
// (costCoveragePercent) so a thin figure is never presented as complete.
export async function getFinanceSummary(period = '30d') {
  const days = PERIOD_DAYS[period]
  const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null

  const orders = await prisma.order.findMany({
    where: {
      status: { in: REVENUE_STATUSES },
      ...(since ? { createdAt: { gte: since } } : {})
    },
    select: {
      id: true,
      items: {
        select: {
          quantity: true,
          priceAtPurchase: true,
          costAtPurchase: true,
          productNameSnapshot: true,
          variant: { select: { product: { select: { name: true } } } }
        }
      }
    }
  })

  let revenue = 0
  let cogs = 0
  let itemsTotal = 0
  let itemsWithCostData = 0
  const productMap = {}

  for (const order of orders) {
    for (const item of order.items) {
      itemsTotal++
      const lineRevenue = Number(item.priceAtPurchase) * item.quantity
      revenue += lineRevenue

      const productName = item.productNameSnapshot || item.variant?.product?.name || 'Unknown Product'
      if (!productMap[productName]) {
        productMap[productName] = { productName, revenue: 0, cogs: 0, unitsSold: 0, hasCostData: false }
      }
      productMap[productName].revenue += lineRevenue
      productMap[productName].unitsSold += item.quantity

      if (item.costAtPurchase != null) {
        const lineCost = Number(item.costAtPurchase) * item.quantity
        cogs += lineCost
        itemsWithCostData++
        productMap[productName].cogs += lineCost
        productMap[productName].hasCostData = true
      }
    }
  }

  const grossProfit = revenue - cogs
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const costCoveragePercent = itemsTotal > 0 ? (itemsWithCostData / itemsTotal) * 100 : 0

  const topProducts = Object.values(productMap)
    .map(p => ({
      productName: p.productName,
      revenue: p.revenue,
      unitsSold: p.unitsSold,
      cogs: p.hasCostData ? p.cogs : null,
      grossProfit: p.hasCostData ? p.revenue - p.cogs : null,
      marginPercent: p.hasCostData && p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : null
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    period,
    since,
    ordersCounted: orders.length,
    revenue,
    cogs,
    grossProfit,
    marginPercent,
    itemsTotal,
    itemsWithCostData,
    costCoveragePercent,
    topProducts
  }
}
