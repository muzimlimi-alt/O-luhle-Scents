import prisma from './prisma.js'
import { adjustStock } from './inventoryService.js'

// "Customer wants a different size/scent" — distinct from a straight return.
// Adds a replacement OrderItem to the SAME order (no parallel order created)
// and links it back to the ReturnItem that triggered the exchange.
export async function createExchange({ returnItemId, replacementVariantId, adminUserId }) {
  return prisma.$transaction(async (tx) => {
    const returnItem = await tx.returnItem.findUnique({
      where: { id: returnItemId },
      include: { orderItem: { include: { variant: true } }, exchangeRequests: true }
    })
    if (!returnItem) throw Object.assign(new Error('Return not found'), { status: 404 })
    if (returnItem.exchangeRequests.length > 0) {
      throw Object.assign(new Error('This return has already been exchanged'), { status: 400 })
    }

    const replacement = await tx.productVariant.findUnique({
      where: { id: replacementVariantId },
      include: { product: true, inventory: true }
    })
    if (!replacement) throw Object.assign(new Error('Replacement variant not found'), { status: 404 })
    if ((replacement.inventory?.quantity || 0) - (replacement.inventory?.reserved || 0) < returnItem.quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${replacement.product.name} (${replacement.size})`), { status: 400 })
    }

    const originalPrice = Number(returnItem.orderItem.priceAtPurchase)
    const replacementPrice = Number(replacement.price)
    const priceDifference = (replacementPrice - originalPrice) * returnItem.quantity

    const newOrderItem = await tx.orderItem.create({
      data: {
        orderId: returnItem.orderItem.orderId,
        variantId: replacement.id,
        quantity: returnItem.quantity,
        priceAtPurchase: replacementPrice,
        productNameSnapshot: replacement.product.name,
        variantLabelSnapshot: replacement.size,
        skuSnapshot: replacement.sku,
        costAtPurchase: replacement.costPrice
      }
    })

    await adjustStock(tx, {
      variantId: replacement.id,
      delta: -returnItem.quantity,
      changeType: 'SALE',
      reason: `Exchange for Order ${returnItem.orderItem.orderId.split('-')[0].toUpperCase()}`,
      referenceId: returnItem.orderItem.orderId,
      productName: replacement.product.name,
      variantSize: replacement.size
    })

    const exchange = await tx.exchangeRequest.create({
      data: {
        returnItemId,
        replacementVariantId: replacement.id,
        newOrderItemId: newOrderItem.id,
        priceDifference,
        status: 'COMPLETED'
      },
      include: { replacementVariant: { include: { product: true } }, newOrderItem: true }
    })

    await tx.auditLog.create({
      data: {
        adminUserId,
        action: 'CREATE_EXCHANGE',
        entity: 'ReturnItem',
        entityId: returnItemId,
        details: { replacementVariantId: replacement.id, priceDifference }
      }
    })

    return exchange
  })
}
