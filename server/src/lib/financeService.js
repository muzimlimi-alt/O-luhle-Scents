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
          packagingCostAtPurchase: true,
          labellingCostAtPurchase: true,
          productNameSnapshot: true,
          variant: { select: { product: { select: { name: true } } } }
        }
      }
    }
  })

  let revenue = 0
  let cogs = 0
  let packagingCost = 0
  let labellingCost = 0
  let itemsTotal = 0
  let itemsWithCostData = 0
  let totalUnitsSold = 0
  const productMap = {}

  for (const order of orders) {
    for (const item of order.items) {
      itemsTotal++
      totalUnitsSold += item.quantity
      const lineRevenue = Number(item.priceAtPurchase) * item.quantity
      revenue += lineRevenue

      const productName = item.productNameSnapshot || item.variant?.product?.name || 'Unknown Product'
      if (!productMap[productName]) {
        productMap[productName] = {
          productName, revenue: 0, cogs: 0, packagingCost: 0, labellingCost: 0, unitsSold: 0,
          hasCostData: false, hasTrueCostData: false
        }
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

      // True-cost coverage mirrors costAtPurchase's coverage semantics above
      // (set once any item contributes, sums only what's actually present) —
      // just requires all three per-unit cost fields, not only purchase cost.
      if (item.costAtPurchase != null && item.packagingCostAtPurchase != null && item.labellingCostAtPurchase != null) {
        packagingCost += Number(item.packagingCostAtPurchase) * item.quantity
        labellingCost += Number(item.labellingCostAtPurchase) * item.quantity
        productMap[productName].packagingCost += Number(item.packagingCostAtPurchase) * item.quantity
        productMap[productName].labellingCost += Number(item.labellingCostAtPurchase) * item.quantity
        productMap[productName].hasTrueCostData = true
      }
    }
  }

  const grossProfit = revenue - cogs
  const marginPercent = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const costCoveragePercent = itemsTotal > 0 ? (itemsWithCostData / itemsTotal) * 100 : 0

  // Freight/courier/marketing are period-level spend, not a natural per-unit
  // number — allocated evenly across units sold in the period rather than
  // attributed to specific products. A disclosed estimate, not baked
  // silently into any per-product figure above.
  const overheadExpenses = await prisma.expense.aggregate({
    where: {
      accountCode: { in: ['5100', '5300'] }, // Courier Expense, Marketing
      ...(since ? { date: { gte: since } } : {})
    },
    _sum: { amount: true }
  })
  const totalOverhead = Number(overheadExpenses._sum.amount || 0)
  const allocatedOverheadPerUnit = totalUnitsSold > 0 ? totalOverhead / totalUnitsSold : 0

  const topProducts = Object.values(productMap)
    .map(p => {
      const trueCostPerUnit = p.hasTrueCostData && p.unitsSold > 0
        ? (p.cogs + p.packagingCost + p.labellingCost) / p.unitsSold
        : null
      const trueCost = p.hasTrueCostData ? p.cogs + p.packagingCost + p.labellingCost : null
      return {
        productName: p.productName,
        revenue: p.revenue,
        unitsSold: p.unitsSold,
        cogs: p.hasCostData ? p.cogs : null,
        grossProfit: p.hasCostData ? p.revenue - p.cogs : null,
        marginPercent: p.hasCostData && p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : null,
        // trueCost/trueCostMarginPercent are separate from cogs/marginPercent
        // above (which stay purchase-cost-only, unchanged) — includes
        // packaging + labelling, still excludes allocatedOverheadPerUnit
        // (reported once at the top level, not per product).
        trueCost,
        trueCostMarginPercent: p.hasTrueCostData && p.revenue > 0 ? ((p.revenue - trueCost) / p.revenue) * 100 : null,
        trueCostPerUnit
      }
    })
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
    totalUnitsSold,
    allocatedOverheadPerUnit,
    topProducts
  }
}
