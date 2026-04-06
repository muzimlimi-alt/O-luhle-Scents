import axios from 'axios'
import prisma from './prisma.js'
import { DateTime } from 'luxon'

const BASE_CURRENCY = 'ZAR'
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD']

export async function updateExchangeRates() {
  try {
    // 1. Fetch from Public API (Simulation if no internet/restricted, but let's try real)
    const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${BASE_CURRENCY}`)
    const rates = response.data.rates

    for (const code of SUPPORTED_CURRENCIES) {
      if (rates[code]) {
        await prisma.currencyRate.upsert({
          where: { code },
          update: { rate: rates[code], lastUpdate: new Date() },
          create: { code, rate: rates[code] }
        })
      }
    }

    console.log(`[CurrencyService] ${SUPPORTED_CURRENCIES.join(', ')} rates updated successfully at ${DateTime.now().toLocaleString()}`)
  } catch (err) {
    console.error('[CurrencyService] Failed to update rates:', err.message)
    // Fallback logic if API fails: Use last known or hardcoded defaults
  }
}

export async function convertPrice(zarAmount, targetCurrency) {
  if (targetCurrency === BASE_CURRENCY) return zarAmount

  const rateRow = await prisma.currencyRate.findUnique({
    where: { code: targetCurrency }
  })

  if (!rateRow) return zarAmount // Fallback to ZAR

  return Number(zarAmount) * Number(rateRow.rate)
}

export function getCurrencySymbol(code) {
  const symbols = {
    'ZAR': 'R',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AUD': 'A$'
  }
  return symbols[code] || code
}
