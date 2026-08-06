import fs from 'fs'
import prisma from './prisma.js'
import configStore from './configStore.js'
import { consumeReservation } from './inventoryService.js'
import { confirmOrderPaid } from './paymentConfirmation.js'
import { generateInvoice, sendWhatsAppNotification } from './invoiceService.js'
import { sendProofReceived, sendPaymentVerified, sendPaymentRejected, sendAdminEftAlert } from '../utils/email.js'

async function notifyAdminsOfNewProof(order) {
  await prisma.notification.create({
    data: {
      type: 'EFT_PROOF_UPLOADED',
      message: `Proof of payment uploaded for order ${order.orderNumber} — awaiting verification.`
    }
  })

  const recipients = await configStore.get('eft_verification_notify_emails', '')
  const emails = recipients.split(',').map(e => e.trim()).filter(Boolean)
  if (emails.length) {
    await sendAdminEftAlert(emails, `Proof of payment uploaded — ${order.orderNumber}`,
      `A customer uploaded proof of payment for order ${order.orderNumber}. Please review it in the Payments admin page.`)
  }
}

// Called by both the public (guest, order-UUID-scoped) and authenticated
// customer upload routes — identical underlying logic either way, so the two
// trust models never diverge in behavior.
export async function uploadProof(orderId, { filePath, fileName, fileSize, mimeType, actorType, actorId }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { where: { paymentMethod: 'manual_eft' } } }
    })
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })

    const payment = order.payments[0]
    if (!payment) throw Object.assign(new Error('This order has no Manual EFT payment to attach proof to'), { status: 400 })
    // Replacing proof is allowed any time before an admin has verified it —
    // including while a first upload is still sitting in the queue, so a
    // customer who spots a mistake can correct it before anyone reviews it.
    if (!['PENDING_PROOF', 'PROOF_UPLOADED', 'REJECTED'].includes(payment.eftVerificationStatus)) {
      throw Object.assign(new Error('Proof cannot be uploaded for this payment in its current state'), { status: 400 })
    }

    const previousFilePath = payment.proofOfPaymentUrl

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          proofOfPaymentUrl: filePath,
          proofFileName: fileName,
          proofFileSize: fileSize,
          proofMimeType: mimeType,
          proofUploadedAt: new Date(),
          eftVerificationStatus: 'PROOF_UPLOADED',
          rejectionReason: null,
        }
      })

      await tx.paymentStatusHistory.create({
        data: { paymentId: payment.id, status: 'PROOF_UPLOADED', actorType, actorId: actorId || null, note: 'Proof of payment uploaded' }
      })

      return result
    })

    // Replacing a rejected proof — the old file is no longer referenced anywhere.
    if (previousFilePath && previousFilePath !== filePath && fs.existsSync(previousFilePath)) {
      fs.unlink(previousFilePath, () => {})
    }

    sendProofReceived(order.id).catch(e => console.error('[EFT] sendProofReceived failed:', e.message))
    notifyAdminsOfNewProof(order).catch(e => console.error('[EFT] admin notify failed:', e.message))

    return updated
  } catch (err) {
    // The file was already saved to disk by multer before this function ran —
    // don't leave it orphaned if we're rejecting the upload.
    if (filePath && fs.existsSync(filePath)) fs.unlink(filePath, () => {})
    throw err
  }
}

// Admin approval — mirrors the PayFast webhook's success path exactly
// (server/src/routes/webhooks.js) so downstream behavior (finance revenue
// counting via Order.status, invoice generation, WhatsApp) is identical
// regardless of which gateway confirmed the sale.
export async function verifyPayment(paymentId, { adminUserId }) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          items: { include: { variant: { include: { product: true } } } },
          reservations: { where: { consumedAt: null, releasedAt: null } }
        }
      }
    }
  })
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 })
  if (payment.paymentMethod !== 'manual_eft') throw Object.assign(new Error('Not a Manual EFT payment'), { status: 400 })
  if (payment.eftVerificationStatus === 'VERIFIED') throw Object.assign(new Error('Already verified'), { status: 400 })

  const orderId = payment.orderId

  await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        paymentStatus: 'COMPLETE',
        eftVerificationStatus: 'VERIFIED',
        verifiedByAdminId: adminUserId,
        verifiedAt: new Date(),
        paidAt: new Date(),
      }
    })

    // Order status + GL posting — shared with the PayFast webhook
    // (webhooks.js) and, later, every other gateway's confirmation path,
    // so every payment method produces identical journal shapes.
    await confirmOrderPaid(tx, payment.order, updatedPayment)

    for (const reservation of payment.order.reservations) {
      const item = payment.order.items.find(i => i.variantId === reservation.variantId)
      await consumeReservation(tx, reservation, {
        productName: item?.variant?.product?.name,
        variantSize: item?.variant?.size
      })
    }

    await tx.paymentStatusHistory.create({
      data: { paymentId, status: 'VERIFIED', actorType: 'admin', actorId: adminUserId, note: 'Payment verified' }
    })

    await tx.auditLog.create({
      data: { adminUserId, action: 'VERIFY_EFT_PAYMENT', entity: 'Payment', entityId: paymentId, details: { orderId } }
    })
  })

  try {
    await generateInvoice(orderId)
    await sendWhatsAppNotification(orderId, 'paid')
  } catch (autoErr) {
    console.error('[EFT] Post-verification automation failed:', autoErr.message)
  }

  sendPaymentVerified(orderId).catch(e => console.error('[EFT] sendPaymentVerified failed:', e.message))

  return prisma.payment.findUnique({ where: { id: paymentId } })
}

// Admin rejection — leaves Order untouched (still pending/unpaid) so the
// customer can re-upload a corrected proof.
export async function rejectPayment(paymentId, { reason, adminUserId }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 })
  if (payment.paymentMethod !== 'manual_eft') throw Object.assign(new Error('Not a Manual EFT payment'), { status: 400 })

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: paymentId },
      data: { eftVerificationStatus: 'REJECTED', rejectionReason: reason || null }
    })

    await tx.paymentStatusHistory.create({
      data: { paymentId, status: 'REJECTED', actorType: 'admin', actorId: adminUserId, note: reason || 'Proof rejected' }
    })

    await tx.auditLog.create({
      data: { adminUserId, action: 'REJECT_EFT_PAYMENT', entity: 'Payment', entityId: paymentId, details: { reason } }
    })

    return result
  })

  sendPaymentRejected(payment.orderId, reason).catch(e => console.error('[EFT] sendPaymentRejected failed:', e.message))

  return updated
}
