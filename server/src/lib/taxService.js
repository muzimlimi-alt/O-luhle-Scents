import prisma from './prisma.js'

// Resolves the tax rate to apply. No active/default TaxRate configured means
// tax stays 0 — this is what preserves today's (no-tax) checkout behavior
// until an admin explicitly sets one up via the Tax Rates page.
export async function resolveTaxRate(region) {
  const active = await prisma.taxRate.findMany({ where: { active: true } })
  if (active.length === 0) return null

  const regionMatch = region && active.find(t => t.region?.toLowerCase() === region.toLowerCase())
  return regionMatch || active.find(t => t.isDefault) || null
}

export function calculateTax(taxRate, taxableAmount) {
  if (!taxRate) return 0
  return Math.round(taxableAmount * Number(taxRate.rate) * 100) / 100
}

// Opposite direction of calculateTax: splits an amount that already INCLUDES
// tax (a purchase's totalCost, a refund's amount) into its ex-tax and tax
// components, without changing the total. `taxRate` can be a real TaxRate
// row or any object with a `.rate` — accountingService.js passes a synthetic
// one derived from a specific order's own historical rate for refunds.
export function extractTaxFromInclusive(taxRate, inclusiveAmount) {
  if (!taxRate || !taxRate.rate) return { exTax: inclusiveAmount, tax: 0 }
  const rate = Number(taxRate.rate)
  const tax = Math.round(inclusiveAmount * rate / (1 + rate) * 100) / 100
  return { exTax: Math.round((inclusiveAmount - tax) * 100) / 100, tax }
}
