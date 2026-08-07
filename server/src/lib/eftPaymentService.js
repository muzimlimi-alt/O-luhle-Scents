import fs from 'fs'
import prisma from './prisma.js'
import configStore from './configStore.js'
import { consumeReservation, extendReservationExpiry } from './inventoryService.js'
import { recordEftPaymentReceived } from './paymentConfirmation.js'
import { round2 } from './accountingService.js'
import { generateInvoice, sendWhatsAppNotification } from './invoiceService.js'
import { bankAccountToPublicShape } from './paymentProviders/manualEftProvider.js'
import { sendProofReceived, sendPaymentVerified, sendPaymentRejected, sendAdminEftAlert, sendEftInstructions } from '../utils/email.js'

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

    // The *active* EFT payment — for a single-payment order there's only
    // ever one, so this is unchanged. For a deposit order (Partial Payments
    // phase) it naturally resolves to the deposit first, then (once that's
    // verified and the balance Payment row is created) the balance.
    const payment = order.payments.find(p => ['PENDING_PROOF', 'PROOF_UPLOADED', 'REJECTED'].includes(p.eftVerificationStatus))
    if (!payment) throw Object.assign(new Error('This order has no Manual EFT payment awaiting proof'), { status: 400 })

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

// Admin approval — mirrors the PayFast webhook's success path when this
// payment completes the order (server/src/routes/webhooks.js), so downstream
// behavior (finance revenue counting via Order.status, invoice generation,
// WhatsApp) is identical regardless of which gateway confirmed the sale.
//
// Partial Payments phase: this payment might be a deposit rather than full
// settlement. recordEftPaymentReceived (paymentConfirmation.js) decides
// which — if it's still partial, the reservation hold is extended and a
// balance Payment row is spawned instead of finalizing the order.
export async function verifyPayment(paymentId, { adminUserId }) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          items: { include: { variant: { include: { product: true } } } },
          reservations: { where: { consumedAt: null, releasedAt: null } },
          payments: true
        }
      },
      bankAccount: true
    }
  })
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 })
  if (payment.paymentMethod !== 'manual_eft') throw Object.assign(new Error('Not a Manual EFT payment'), { status: 400 })
  if (payment.eftVerificationStatus === 'VERIFIED') throw Object.assign(new Error('Already verified'), { status: 400 })

  const orderId = payment.orderId
  let outcome

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

    const totalPaid = round2(
      payment.order.payments
        .filter(p => p.id !== paymentId && p.paymentStatus === 'COMPLETE')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) + Number(updatedPayment.amount)
    )

    // Order status + GL posting — shared with the PayFast webhook when this
    // payment completes the order; still-partial handled below.
    outcome = await recordEftPaymentReceived(tx, payment.order, updatedPayment, totalPaid)

    if (outcome.fullyPaid) {
      for (const reservation of payment.order.reservations) {
        const item = payment.order.items.find(i => i.variantId === reservation.variantId)
        await consumeReservation(tx, reservation, {
          productName: item?.variant?.product?.name,
          variantSize: item?.variant?.size
        })
      }
    } else {
      // Deposit verified, balance still outstanding: keep the stock held
      // for eft_balance_payment_hours rather than letting the original
      // (already-expired-or-expiring) hold cancel the order out from under
      // a customer who just paid part of it.
      const balanceHours = Number(await configStore.get('eft_balance_payment_hours', '48'))
      await extendReservationExpiry(tx, orderId, new Date(Date.now() + balanceHours * 60 * 60 * 1000))

      // Same shape as the deposit's own Payment row, pinned to the same
      // bank account so the customer never sees a different one mid-flow.
      const balancePayment = await tx.payment.create({
        data: {
          orderId,
          paymentMethod: 'manual_eft',
          paymentStatus: 'PENDING',
          amount: outcome.remainingBalance,
          eftVerificationStatus: 'PENDING_PROOF',
          bankAccountId: payment.bankAccountId,
        }
      })
      await tx.paymentStatusHistory.create({
        data: { paymentId: balancePayment.id, status: 'PENDING_PROOF', actorType: 'system', note: 'Deposit verified — awaiting balance payment' }
      })
    }

    await tx.paymentStatusHistory.create({
      data: { paymentId, status: 'VERIFIED', actorType: 'admin', actorId: adminUserId, note: 'Payment verified' }
    })

    await tx.auditLog.create({
      data: { adminUserId, action: 'VERIFY_EFT_PAYMENT', entity: 'Payment', entityId: paymentId, details: { orderId, fullyPaid: outcome.fullyPaid } }
    })
  })

  if (outcome.fullyPaid) {
    try {
      await generateInvoice(orderId)
      await sendWhatsAppNotification(orderId, 'paid')
    } catch (autoErr) {
      console.error('[EFT] Post-verification automation failed:', autoErr.message)
    }
    sendPaymentVerified(orderId).catch(e => console.error('[EFT] sendPaymentVerified failed:', e.message))
  } else {
    const bankDetails = bankAccountToPublicShape(payment.bankAccount)
    sendEftInstructions(orderId, bankDetails, outcome.remainingBalance).catch(e => console.error('[EFT] sendEftInstructions (balance) failed:', e.message))
  }

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
