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

// Revenue aggregated by Category — sibling of getFinanceSummary with the
// grouping done on the current category (not a snapshot — OrderItem never
// captured categoryId at sale time; see PIM Phase 1 snapshot rationale on
// OrderItem.productNameSnapshot). A product that's been reclassified since
// the sale will attribute its historical revenue to its NEW category. That
// matches what admins expect when they look at a "Perfumes revenue" chart:
// the current taxonomy, not a frozen one. Products with no category (deleted
// or never-assigned) land in an "Uncategorised" bucket rather than being
// dropped silently.
export async function getRevenueByCategory(period = '30d') {
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
          variantId: true,
          variant: {
            select: {
              product: {
                select: {
                  id: true,
                  category: { select: { id: true, slug: true, name: true } }
                }
              }
            }
          }
        }
      }
    }
  })

  const UNCATEGORISED = { id: null, slug: 'uncategorised', name: 'Uncategorised' }
  const buckets = new Map()
  let totalRevenue = 0
  let totalCogs = 0
  let totalUnits = 0
  // Items whose variant has been fully deleted (hard delete via Prisma's
  // onDelete semantics) — rare but possible for ancient data; we can't
  // place those anywhere real, so they get their own bucket.
  const orphanBucket = { id: '__orphan', slug: '__orphan', name: 'Deleted products' }

  for (const order of orders) {
    for (const item of order.items) {
      const qty = item.quantity
      const lineRevenue = Number(item.priceAtPurchase) * qty
      const lineCost = item.costAtPurchase != null ? Number(item.costAtPurchase) * qty : null

      totalRevenue += lineRevenue
      if (lineCost != null) totalCogs += lineCost
      totalUnits += qty

      let bucketKey
      let bucketMeta
      if (!item.variant?.product) {
        bucketKey = orphanBucket.slug
        bucketMeta = orphanBucket
      } else if (item.variant.product.category) {
        const c = item.variant.product.category
        bucketKey = c.slug
        bucketMeta = { id: c.id, slug: c.slug, name: c.name }
      } else {
        bucketKey = UNCATEGORISED.slug
        bucketMeta = UNCATEGORISED
      }

      let bucket = buckets.get(bucketKey)
      if (!bucket) {
        bucket = {
          categoryId: bucketMeta.id,
          slug: bucketMeta.slug,
          name: bucketMeta.name,
          revenue: 0,
          cogs: 0,
          hasCostData: false,
          unitsSold: 0,
          productIds: new Set(),
          orderIds: new Set(),
        }
        buckets.set(bucketKey, bucket)
      }
      bucket.revenue += lineRevenue
      if (lineCost != null) {
        bucket.cogs += lineCost
        bucket.hasCostData = true
      }
      bucket.unitsSold += qty
      if (item.variant?.product?.id) bucket.productIds.add(item.variant.product.id)
      bucket.orderIds.add(order.id)
    }
  }

  const categories = [...buckets.values()]
    .map((b) => {
      const grossProfit = b.hasCostData ? b.revenue - b.cogs : null
      return {
        categoryId: b.categoryId,
        slug: b.slug,
        name: b.name,
        revenue: b.revenue,
        unitsSold: b.unitsSold,
        productCount: b.productIds.size,
        orderCount: b.orderIds.size,
        cogs: b.hasCostData ? b.cogs : null,
        grossProfit,
        marginPercent: grossProfit != null && b.revenue > 0 ? (grossProfit / b.revenue) * 100 : null,
        revenueShare: totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return {
    period,
    since,
    totalRevenue,
    totalCogs,
    totalUnitsSold: totalUnits,
    categoryCount: categories.length,
    categories,
  }
}
