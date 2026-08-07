import prisma from './prisma.js'
import configStore from './configStore.js'
import { sendPaymentReminderEmail } from '../utils/email.js'
import { sendWhatsAppMessage } from './invoiceService.js'
import { bankAccountToPublicShape } from './paymentProviders/manualEftProvider.js'

function reminderWhatsAppText(order, isEft, amountDue) {
  if (isEft) {
    return `*O'LUHLE SCENTS*\n\nYour order ${order.orderNumber} is still awaiting payment (R${amountDue.toLocaleString()} due). Please complete your EFT so we can prepare it.\n\n_Ref: ${order.orderNumber}_`
  }
  return `*O'LUHLE SCENTS*\n\nYour order ${order.orderNumber} is still awaiting payment (R${amountDue.toLocaleString()}). Complete your purchase before your items are released.`
}

// Called hourly by the cron registered in index.js. Targets both unpaid
// paths — Manual EFT orders awaiting proof (a Payment row exists, pinned to
// the account shown at checkout) and PayFast orders abandoned mid-checkout
// (no Payment row was ever created, since PayFast's only creates one once
// its webhook confirms success) — and partially_paid orders (a Manual EFT
// deposit was verified but the balance Payment row is still awaiting proof;
// paymentStatus only reaches 'unpaid' pre-deposit, so this must be checked
// separately or a customer who paid a deposit would never be reminded
// about the remaining balance). Independent of sweepExpiredReservations —
// this nudges before expiry, the sweep still cancels at expiry.
export async function sendPaymentReminders() {
  const enabled = (await configStore.get('payment_reminder_enabled', 'false')) === 'true'
  if (!enabled) return { sent: 0, skipped: 0 }

  const thresholdHours = Number(await configStore.get('payment_reminder_threshold_hours', '24'))
  const intervalHours = Number(await configStore.get('payment_reminder_interval_hours', '24'))
  const maxCount = Number(await configStore.get('payment_reminder_max_count', '3'))
  const channel = await configStore.get('payment_reminder_channel', 'email')

  const now = new Date()
  const thresholdCutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000)
  const intervalCutoff = new Date(now.getTime() - intervalHours * 60 * 60 * 1000)

  const orders = await prisma.order.findMany({
    where: {
      status: 'pending',
      paymentStatus: { in: ['unpaid', 'partially_paid'] },
      createdAt: { lte: thresholdCutoff },
      reminderCount: { lt: maxCount },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lte: intervalCutoff } }
      ]
    },
    include: {
      customer: true,
      payments: { where: { paymentMethod: 'manual_eft' }, include: { bankAccount: true } }
    }
  })

  let sent = 0
  let skipped = 0

  for (const order of orders) {
    // The *active* EFT payment — same "awaiting action" lookup used by
    // uploadProof/checkout-success.html. For a partially_paid order this is
    // the balance row (the deposit is already VERIFIED, excluded here), so
    // the reminder correctly references the outstanding amount, not the
    // original deposit.
    const eftPayment = order.payments.find(p => ['PENDING_PROOF', 'PROOF_UPLOADED', 'REJECTED'].includes(p.eftVerificationStatus))
    const isEft = !!eftPayment
    // PayFast never does partial payments, so a non-EFT order always still
    // owes the full total; an EFT order owes whatever its active payment's
    // amount is (the full order the first time, just the balance thereafter).
    const amountDue = isEft ? Number(eftPayment.amount) : Number(order.totalAmount)

    const wantsEmail = channel === 'email' || channel === 'both'
    const wantsWhatsApp = channel === 'whatsapp' || channel === 'both'
    const canEmail = wantsEmail && !!order.customer?.email
    const canWhatsApp = wantsWhatsApp && !!order.customer?.phone

    if (!canEmail && !canWhatsApp) {
      skipped++
      continue
    }

    if (canEmail) {
      // Re-shows the account this specific order was pinned to at checkout
      // (Multiple Bank Accounts phase), not whatever is default today.
      const bankDetails = isEft ? bankAccountToPublicShape(eftPayment.bankAccount) : null
      await sendPaymentReminderEmail(order.id, { isEft, bankDetails, amountDue })
    }
    if (canWhatsApp) {
      await sendWhatsAppMessage(order.id, reminderWhatsAppText(order, isEft, amountDue))
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { reminderCount: { increment: 1 }, lastReminderSentAt: now }
    })
    sent++
  }

  console.log(`[PaymentReminders] Sent ${sent}, skipped ${skipped} (no reachable channel)`)
  return { sent, skipped }
}
