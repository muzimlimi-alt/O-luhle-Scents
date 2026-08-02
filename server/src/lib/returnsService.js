import prisma from './prisma.js'
import { adjustStock } from './inventoryService.js'

export const RETURN_CONDITIONS = ['GOOD', 'DAMAGED']

// Customer Return -> Inspect -> GOOD: restock (ledgered) | DAMAGED: write-off
// (no inventory change — the ReturnItem row itself is the record).
export async function processReturn({ orderItemId, quantity, condition, note, adminUserId }) {
  return prisma.$transaction(async (tx) => {
    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        variant: { include: { product: true } },
        returnItems: true
      }
    })
    if (!orderItem) throw Object.assign(new Error('Order item not found'), { status: 404 })

    const alreadyReturned = orderItem.returnItems.reduce((sum, r) => sum + r.quantity, 0)
    const remaining = orderItem.quantity - alreadyReturned
    if (quantity > remaining) {
      throw Object.assign(
        new Error(`Cannot return ${quantity} — only ${remaining} of ${orderItem.quantity} purchased unit(s) remain returnable`),
        { status: 400 }
      )
    }

    const restocked = condition === 'GOOD'
    if (restocked && orderItem.variantId) {
      await adjustStock(tx, {
        variantId: orderItem.variantId,
        delta: quantity,
        changeType: 'RETURN',
        reason: `Returned from Order ${orderItem.orderId.split('-')[0].toUpperCase()} — good condition`,
        referenceId: orderItem.orderId,
        productName: orderItem.variant?.product?.name,
        variantSize: orderItem.variant?.size
      })
    }

    return tx.returnItem.create({
      data: { orderItemId, quantity, condition, restocked, note: note || null, adminUserId },
      include: { orderItem: { include: { variant: { include: { product: true } } } } }
    })
  })
}
