import prisma from './prisma.js'

export const COURIERS = {
  THE_COURIER_GUY: { name: 'The Courier Guy', trackingUrl: 'https://portal.thecourierguy.co.za/track/' },
  ARAMEX: { name: 'Aramex', trackingUrl: 'https://www.aramex.com/track/results?shipmentNumber=' },
  FEDEX: { name: 'FedEx', trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=' },
  POST_OFFICE: { name: 'SAPO', trackingUrl: 'https://trackmyparcel.co.za/track/' }
}

export async function fulfillOrder(orderId, { trackingNumber, courierKey, estimatedDelivery }) {
  const courier = COURIERS[courierKey]
  if (!courier) throw new Error('Invalid courier selection')

  return await prisma.$transaction(async (tx) => {
    // 1. Update Order
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
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
        location: 'O\'luhle Scents Fulfillment Center'
      }
    })

    return order
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
