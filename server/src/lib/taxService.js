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
