import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { convertPrice } from '../lib/currencyService.js'

const router = Router()

// POST /api/cart/validate
// Expects { items: [{ variantId: string, quantity: number }], currency: string }
router.post('/validate', async (req, res, next) => {
  try {
    const { items = [], currency = 'ZAR' } = req.body

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' })
    }

    const validationResults = await Promise.all(items.map(async (item) => {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { 
          product: true,
          inventory: true 
        }
      })

      if (!variant || variant.product.status !== 'ACTIVE') {
        return {
          variantId: item.variantId,
          valid: false,
          reason: 'Product no longer available'
        }
      }

      const requestQty = item.quantity || item.qty || 0
      const availableStock = variant.inventory?.quantity || 0
      const isStockSufficient = availableStock >= requestQty
      const currentPrice = await convertPrice(variant.price, currency)

      return {
        variantId: item.variantId,
        productId: variant.productId,
        name: variant.product.name,
        size: variant.size,
        price: currentPrice,
        currency,
        stockStatus: isStockSufficient ? 'available' : 'insufficient',
        availableQuantity: availableStock,
        valid: isStockSufficient
      }
    }))

    const hasChanges = validationResults.some(r => !r.valid)
    
    res.json({
      valid: !hasChanges,
      results: validationResults
    })
  } catch (err) {
    next(err)
  }
})

export default router
