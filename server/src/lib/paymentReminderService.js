import prisma from './prisma.js'
import configStore from './configStore.js'
import { sendPaymentReminderEmail } from '../utils/email.js'
import { sendWhatsAppMessage } from './invoiceService.js'
import { bankAccountToPublicShape } from './paymentProviders/manualEftProvider.js'

function reminderWhatsAppText(order, isEft) {
  if (isEft) {
    return `*O'LUHLE SCENTS*\n\nYour order ${order.orderNumber} is still awaiting payment. Please complete your EFT so we can prepare it.\n\n_Ref: ${order.orderNumber}_`
  }
  return `*O'LUHLE SCENTS*\n\nYour order ${order.orderNumber} is still awaiting payment (R${Number(order.totalAmount).toLocaleString()}). Complete your purchase before your items are released.`
}

// Called hourly by the cron registered in index.js. Targets both unpaid
// paths: Manual EFT orders awaiting proof (a Payment row exists, pinned to
// the account shown at checkout) and PayFast orders abandoned mid-checkout
// (no Payment row was ever created, since PayFast's only creates one once
// its webhook confirms success). Independent of sweepExpiredReservations —
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
      paymentStatus: 'unpaid',
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
    const eftPayment = order.payments[0]
    const isEft = !!eftPayment

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
      await sendPaymentReminderEmail(order.id, { isEft, bankDetails })
    }
    if (canWhatsApp) {
      await sendWhatsAppMessage(order.id, reminderWhatsAppText(order, isEft))
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
