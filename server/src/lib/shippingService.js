import prisma from './prisma.js'

export async function calculateShipping(country, postalCode, subtotal) {
  try {
    // 1. Find best matching zone
    // Priority: Specific country -> Postal Match -> Region -> Default
    const zones = await prisma.shippingZone.findMany()

    let matchedZone = null

    // Try country + postal pattern
    matchedZone = zones.find(z => 
      z.country?.toLowerCase() === country.toLowerCase() && 
      postalCode.startsWith(z.postalPattern || '')
    )

    // Falls back to country only
    if (!matchedZone) {
      matchedZone = zones.find(z => z.country?.toLowerCase() === country.toLowerCase())
    }

    // Default to "Rest of World" or first available
    if (!matchedZone) {
      matchedZone = zones.find(z => z.name === 'Default') || zones[0]
    }

    if (!matchedZone) return 0 // No zones defined

    // 2. Check for free shipping threshold
    if (matchedZone.freeAbove && Number(subtotal) >= Number(matchedZone.freeAbove)) {
      return 0
    }

    return Number(matchedZone.baseRate)
  } catch (err) {
    console.error('[calculateShipping] Error:', err)
    return 150 // Fallback flat rate
  }
}
