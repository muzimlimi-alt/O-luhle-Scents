import prisma from './prisma.js'

const BASE_CURRENCY = 'ZAR'

export async function convertPrice(zarAmount, targetCurrency) {
  if (targetCurrency === BASE_CURRENCY) return zarAmount

  const rateRow = await prisma.currencyRate.findUnique({
    where: { code: targetCurrency }
  })

  if (!rateRow) return zarAmount // Fallback to ZAR

  return Number(zarAmount) * Number(rateRow.rate)
}
