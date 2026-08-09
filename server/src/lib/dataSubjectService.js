import prisma from './prisma.js'

// POPIA §23 access/portability export — everything this platform holds about
// one customer, in one machine-readable document. Deliberately excludes other
// people's data even where a relation touches it (e.g. an order's courier
// name is business data, not personal information, so it's kept; another
// customer's testimonial never links to this customer at all).
export async function exportCustomerData(customerId) {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    include: {
      addresses: true,
      orders: {
        include: {
          items: true,
          payments: { select: { id: true, paymentMethod: true, paymentStatus: true, amount: true, verifiedAt: true, createdAt: true } },
        },
      },
      quotes: true,
      consentRecords: { orderBy: { createdAt: 'desc' } },
      dataSubjectRequests: { orderBy: { requestedAt: 'desc' } },
    },
  })

  return {
    exportedAt: new Date().toISOString(),
    profile: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, createdAt: customer.createdAt },
    addresses: customer.addresses,
    orders: customer.orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      items: o.items,
      payments: o.payments,
    })),
    quotes: customer.quotes,
    consentHistory: customer.consentRecords,
    dataSubjectRequests: customer.dataSubjectRequests,
  }
}

// Placeholder values a deleted/anonymised customer's identifying fields get
// overwritten with. Orders/addresses are kept intact (legally required
// financial record-keeping — see the audit's F5) but no longer point to a
// real, contactable person. login is disabled by clearing passwordHash.
export async function anonymizeCustomer(customerId, { adminId } = {}) {
  const anonymizedEmail = `deleted-${customerId}@anonymised.toca.local`

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.update({
      where: { id: customerId },
      data: {
        name: 'Deleted Customer',
        email: anonymizedEmail,
        phone: null,
        passwordHash: null,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        anonymizedAt: new Date(),
      },
    })

    await tx.address.updateMany({
      where: { customerId },
      data: { street: 'Redacted', city: null, province: null, postalCode: null },
    })

    await tx.auditLog.create({
      data: {
        adminUserId: adminId || null,
        action: 'ANONYMIZE_CUSTOMER',
        entity: 'Customer',
        entityId: customerId,
        details: { reason: 'POPIA deletion request fulfilled' },
      },
    })

    return customer
  })
}

const AUTO_RESOLVED_TYPES = new Set(['access', 'portability', 'objection'])

export async function createDataSubjectRequest({ customerId, type, details }) {
  const request = await prisma.dataSubjectRequest.create({
    data: { customerId, type, details, status: AUTO_RESOLVED_TYPES.has(type) ? 'completed' : 'submitted', resolvedAt: AUTO_RESOLVED_TYPES.has(type) ? new Date() : null },
  })

  if (type === 'objection') {
    // Objecting to marketing is a direct, low-risk right — apply it immediately
    // rather than making the customer wait in an admin queue for something
    // they're entitled to have happen right away.
    const { recordConsent } = await import('./consentService.js')
    await recordConsent({ customerId, purpose: 'marketing_email', granted: false, method: 'account_settings' })
  }

  return request
}

export async function resolveDataSubjectRequest(requestId, { status, resolutionNotes, adminId }) {
  const request = await prisma.dataSubjectRequest.findUniqueOrThrow({ where: { id: requestId } })

  if (status === 'approved' && request.type === 'deletion') {
    await anonymizeCustomer(request.customerId, { adminId })
    status = 'completed'
  }

  return prisma.dataSubjectRequest.update({
    where: { id: requestId },
    data: { status, resolutionNotes, resolvedByAdminId: adminId, resolvedAt: ['completed', 'rejected'].includes(status) ? new Date() : null },
  })
}
