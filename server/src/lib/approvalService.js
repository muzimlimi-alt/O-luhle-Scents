import prisma from './prisma.js'
import { issueRefund } from './orderAdminService.js'
// periodCloseService imports createApprovalRequest from here, so a static
// import would create a cycle. Dynamic import breaks it without any
// behavioural difference — by the time approveRequest runs, the module is loaded.

// Finance Phase 11 — gates high-value refunds behind a second admin's
// sign-off. requireAdmin has no permission-level hierarchy (every admin is
// equal — see middleware/auth.js), so "second admin" concretely means
// approvedById must differ from requestedById; that check is the entire
// enforcement mechanism here.
export async function createApprovalRequest({ entityType, requestedById, payload }) {
  return prisma.approvalRequest.create({
    data: { entityType, requestedById, payload, status: 'PENDING' }
  })
}

export async function listPendingApprovals() {
  return prisma.approvalRequest.findMany({
    where: { status: 'PENDING' },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' }
  })
}

export async function approveRequest(requestId, approvedById) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } })
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 })
  if (request.status !== 'PENDING') throw Object.assign(new Error('This request has already been decided'), { status: 400 })
  if (request.requestedById === approvedById) {
    throw Object.assign(new Error('A different admin must approve this request — you cannot approve your own'), { status: 403 })
  }

  let result
  if (request.entityType === 'REFUND') {
    const p = request.payload
    result = await issueRefund(p.orderId, {
      amount: p.amount,
      method: p.method,
      returnItemId: p.returnItemId,
      notes: p.notes,
      adminUserId: request.requestedById
    })
  } else if (request.entityType === 'REOPEN_PERIOD') {
    const { reopenPeriod } = await import('./periodCloseService.js')
    result = await reopenPeriod(request.payload.periodId)
  } else {
    throw Object.assign(new Error(`Unknown approval entityType: ${request.entityType}`), { status: 500 })
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', approvedById, decidedAt: new Date() }
  })

  return { approvalRequest: updated, result }
}

export async function rejectRequest(requestId, approvedById, reason) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } })
  if (!request) throw Object.assign(new Error('Approval request not found'), { status: 404 })
  if (request.status !== 'PENDING') throw Object.assign(new Error('This request has already been decided'), { status: 400 })
  if (request.requestedById === approvedById) {
    throw Object.assign(new Error('A different admin must decide this request — you cannot reject your own'), { status: 403 })
  }

  return prisma.approvalRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', approvedById, decidedAt: new Date(), payload: { ...request.payload, rejectionReason: reason || null } }
  })
}
