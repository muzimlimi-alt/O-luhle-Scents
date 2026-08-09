import prisma from './prisma.js'
import configStore from './configStore.js'

// Resolves the tax rate to apply. No active/default TaxRate configured means
// tax stays 0 — this is what preserves today's (no-tax) checkout behavior
// until an admin explicitly sets one up via the Tax Rates page.
//
// A registered business isn't legally permitted to charge VAT before it's
// actually a registered VAT vendor — so this checks the `vat_registered`
// setting (Settings > Tax & SARS Compliance) FIRST, before even looking at
// the TaxRate table. That lets the 15% rate stay configured and ready for
// the moment registration is confirmed, without charging it a day early:
// flip vat_registered on, and checkout starts applying it immediately, no
// code change needed. Defaults to 'false' (no VAT charged) until an admin
// explicitly turns it on.
export async function resolveTaxRate(region) {
  const vatRegistered = await configStore.get('vat_registered', 'false')
  if (vatRegistered !== 'true') return null

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
