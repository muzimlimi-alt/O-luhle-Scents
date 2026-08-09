import prisma from './prisma.js'

export async function fulfillOrder(orderId, { trackingNumber, courierKey, estimatedDelivery }) {
  const courier = await prisma.shippingMethod.findUnique({ where: { key: courierKey } })
  if (!courier || !courier.active) throw new Error('Invalid courier selection')

  return await prisma.$transaction(async (tx) => {
    // 1. Update Order
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'shipped',
        trackingNumber,
        courierName: courier.name,
        shippedAt: new Date(),
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
        shippingStatus: 'IN_TRANSIT'
      }
    })

    // 2. Create Initial Logistics Event
    await tx.logisticsEvent.create({
      data: {
        orderId,
        status: 'SHIPPED',
        message: `Package handed over to ${courier.name}. Tracking: ${trackingNumber}`,
        location: 'TOCA Fulfillment Center'
      }
    })

    return order
  })
}

// Appends a subsequent tracking event (SHIPPED only ever writes the first —
// this is the only way to record OUT_FOR_DELIVERY/DELIVERED/etc afterward).
// Optionally advances Order.status/shippingStatus to keep the summary fields
// in sync with the latest event.
export async function addTrackingEvent(orderId, { status, message, location, advanceOrderStatus }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

    const event = await tx.logisticsEvent.create({
      data: { orderId, status, message: message || null, location: location || null }
    })

    if (advanceOrderStatus) {
      const data = { shippingStatus: status }
      if (status === 'DELIVERED') {
        data.status = 'delivered'
      }
      await tx.order.update({ where: { id: orderId }, data })
    }

    return event
  })
}

export async function getTrackingInfo(trackingNumber) {
  const order = await prisma.order.findFirst({
    where: { trackingNumber },
    include: {
      logisticsEvents: { orderBy: { createdAt: 'desc' } }
    }
  })

  if (!order) return null

  // In a real integration, we would fetch fresh data from the Courier API here
  // and update the logisticsEvents table if new events exist.
  // For now, we return our internal audit trail.
  
  return {
    orderId: order.id,
    trackingNumber: order.trackingNumber,
    courierName: order.courierName,
    shippingStatus: order.shippingStatus,
    shippedAt: order.shippedAt,
    estimatedDelivery: order.estimatedDelivery,
    events: order.logisticsEvents
  }
}
