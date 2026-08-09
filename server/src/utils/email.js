/**
 * TOCA — Email Service
 *
 * Uses Nodemailer — configure your .env with:
 *   EMAIL_USER="you@gmail.com"
 *   EMAIL_PASS="your_app_password"
 *   EMAIL_FROM="TOCA <orders@yourdomain.com>"
 */

import nodemailer from 'nodemailer'
import configStore from '../lib/configStore.js'
import prisma from '../lib/prisma.js'

let transporter = null
let transporterKey = null

async function getTransporter() {
  const user = await configStore.get('EMAIL_USER')
  const pass = await configStore.get('EMAIL_PASS')
  const host = await configStore.get('EMAIL_HOST')
  const port = await configStore.get('EMAIL_PORT')

  if (!user || !pass) {
     console.warn('[Email] EMAIL_USER or EMAIL_PASS not configured. Emails will not be sent.')
     return null
  }

  // Rebuild the transporter if the credentials changed since the last cache.
  const key = `${host}:${port}:${user}:${pass}`
  if (transporter && transporterKey === key) return transporter

  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(port) || 587,
        secure: Number(port) === 465,
        auth: { user, pass },
      })
    : nodemailer.createTransport({
        service: 'gmail', // Default provider when no custom EMAIL_HOST is configured
        auth: { user, pass },
      })
  transporterKey = key

  return transporter
}

const FROM = process.env.EMAIL_FROM || "TOCA <orders@toca.co.za>"

// ── Safe send wrapper ─────────────────────────────────────────────────────────
async function send({ to, subject, html, replyTo }) {
  const mailer = await getTransporter()
  if (!mailer) {
    console.warn('[Email] No mailer configured — email not sent:', subject)
    return
  }
  try {
    const info = await mailer.sendMail({
      from: FROM,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })
    console.log(`[Email] Sent "${subject}" to ${to} (MessageId: ${info.messageId})`)
  } catch (err) {
    console.error('[Email] Send failed:', err.message)
  }
}


// ── Shared template shell ─────────────────────────────────────────────────────
function emailShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f2ede7;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#1a1a1a;padding:32px 40px;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:22px;color:#d4af37;letter-spacing:0.12em;">
        TOCA
      </div>
      <div style="font-size:11px;color:#999;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;">
        Extrait de Parfum
      </div>
    </div>
    <!-- Body -->
    <div style="padding:40px;">
      ${bodyHtml}
    </div>
    <!-- Footer -->
    <div style="background:#f7f3ee;padding:24px 40px;text-align:center;border-top:1px solid #e8e0d4;">
      <p style="font-size:12px;color:#999;margin:0;">
        &copy; ${new Date().getFullYear()} TOCA &nbsp;·&nbsp;
        <a href="tel:0761112096" style="color:#b89b6a;text-decoration:none;">076 111 2096</a>
      </p>
      <p style="font-size:11px;color:#bbb;margin:8px 0 0;">
        Questions? Reply to this email or visit
        <a href="${process.env.SERVER_URL || 'http://localhost:3000'}" style="color:#b89b6a;">toca.co.za</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ── Shared item rows helper ───────────────────────────────────────────────────
function itemRows(items) {
  return (items || []).map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;">
        ${item.productNameSnapshot || item.variant?.product?.name || 'Product'} — ${item.variantLabelSnapshot || item.variant?.size || ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;text-align:center;">
        × ${item.quantity}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;text-align:right;font-weight:bold;">
        R${(Number(item.priceAtPurchase) * item.quantity).toLocaleString()}
      </td>
    </tr>`).join('')
}

// ── 1. Order confirmation ─────────────────────────────────────────────────────
// Triggered after PayFast ITN confirms payment (payment_status = COMPLETE) —
// see routes/webhooks.js. Takes orderId like every other function in this
// file (loadOrderForEftEmail, despite its EFT-flavored name, is the shared
// order+customer+shippingAddress+items loader every one of them already
// uses). Previously took a bare `order` object shaped like neither the real
// `Order` model nor `OrderItem` (e.g. `order.shippingAddress.firstName`,
// `item.product.name` — neither exists on the real schema) and was never
// actually called anywhere; rewritten against the real shapes here.
export async function sendOrderConfirmation(orderId) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return
  const firstName = order.customer.name?.split(' ')[0] || 'Valued Customer'

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Thank you, ${firstName}!
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Your order has been confirmed and payment received. We'll begin preparing
      your fragrance right away.
    </p>

    <div style="background:#f7f3ee;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Order Reference</div>
      <div style="font-family:monospace;font-size:14px;color:#1a1a1a;">${order.orderNumber}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;">Item</th>
          <th style="text-align:center;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;">Qty</th>
          <th style="text-align:right;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows(order.items)}
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="padding:6px 0;color:#666;font-size:13px;">Shipping</td>
        <td style="padding:6px 0;font-size:13px;text-align:right;">R${Number(order.shippingCost || 0).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;border-top:2px solid #1a1a1a;">Total Paid</td>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;text-align:right;border-top:2px solid #1a1a1a;color:#b89b6a;">
          R${Number(order.totalAmount || 0).toLocaleString()}
        </td>
      </tr>
    </table>

    <div style="margin-top:32px;padding:20px 24px;border:1px solid #e8e0d4;border-radius:6px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Shipping To</div>
      <div style="font-size:14px;line-height:1.7;color:#444;">
        ${order.customer.name || ''}<br>
        ${order.shippingAddress?.street || ''}<br>
        ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.province || ''} ${order.shippingAddress?.postalCode || ''}
      </div>
    </div>

    <p style="font-size:13px;color:#888;margin-top:28px;line-height:1.7;">
      Estimated delivery: 3–5 business days. You'll receive a shipping confirmation email once your order is dispatched.
    </p>`

  await send({
    to:      order.customer.email,
    subject: `Your TOCA order is confirmed ✦`,
    html:    emailShell(`Order Confirmed — TOCA`, body),
  })
}

// ── 3. Newsletter subscription confirmation ───────────────────────────────────
// Sent immediately after a successful subscription (any source).
// Contains the subscriber's personal unsubscribe link.
export async function sendNewsletterConfirmation(email, unsubscribeToken) {
  const BASE = process.env.SERVER_URL || 'http://localhost:3000'
  const unsubUrl = `${BASE}/unsubscribe.html?token=${unsubscribeToken}`

  const body = `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:56px;height:56px;background:#f7f3ee;border-radius:50%;line-height:56px;font-size:24px;">✦</div>
    </div>

    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:22px;margin:0 0 8px;text-align:center;letter-spacing:0.02em;">
      Welcome to the TOCA Circle
    </h2>
    <p style="color:#888;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;text-align:center;margin:0 0 28px;">
      Extrait de Parfum — Exclusivity Awaits
    </p>

    <p style="color:#555;font-size:14px;line-height:1.8;margin:0 0 20px;">
      Thank you for joining us. As a member of the TOCA Circle, you'll be the first to know about
      new fragrance releases, curated collections, and exclusive member-only offers.
    </p>

    <div style="background:#f7f3ee;border-left:3px solid #b89b6a;padding:20px 24px;border-radius:0 6px 6px 0;margin:24px 0;">
      <p style="color:#444;font-size:14px;line-height:1.7;margin:0;">
        <strong style="color:#1a1a1a;">What to expect:</strong><br>
        New arrivals &nbsp;·&nbsp; Seasonal offers &nbsp;·&nbsp; Fragrance stories &nbsp;·&nbsp; Member early access
      </p>
    </div>

    <p style="color:#555;font-size:14px;line-height:1.8;margin:24px 0 32px;">
      In the meantime, explore our current collection and discover your perfect scent.
    </p>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${BASE}/shop.html"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;
                padding:14px 36px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;
                border-radius:2px;font-family:Georgia,serif;">
        Explore the Collection
      </a>
    </div>

    <div style="border-top:1px solid #e8e0d4;padding-top:20px;text-align:center;">
      <p style="font-size:11px;color:#bbb;margin:0;line-height:1.7;">
        You're receiving this because you subscribed at
        <a href="${BASE}" style="color:#b89b6a;text-decoration:none;">toca.co.za</a>.<br>
        Changed your mind?
        <a href="${unsubUrl}"
           style="color:#b89b6a;text-decoration:underline;font-size:11px;">
          Unsubscribe from the TOCA Circle
        </a>
      </p>
    </div>`

  await send({
    to:      email,
    subject: `Welcome to the TOCA Circle ✦`,
    html:    emailShell(`Welcome to the TOCA Circle`, body),
  })
}

// ── Contact form submission ───────────────────────────────────────────────────
// Sent to the business inbox whenever a visitor submits the homepage contact
// form. replyTo is set to the customer's own address so staff can just hit
// reply in their mail client.
const CONTACT_INBOX = process.env.CONTACT_EMAIL || 'info@toca.co.za'

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

export async function sendContactMessage({ name, email, phone, subject, message }) {
  name = escapeHtml(name)
  email = escapeHtml(email)
  phone = escapeHtml(phone)
  subject = escapeHtml(subject)
  message = escapeHtml(message)

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      New enquiry from ${name}
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Sent via the TOCA website contact form.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#888;font-size:13px;width:110px;">Name</td><td style="padding:6px 0;font-size:14px;">${name}</td></tr>
      <tr><td style="padding:6px 0;color:#888;font-size:13px;">Email</td><td style="padding:6px 0;font-size:14px;"><a href="mailto:${email}" style="color:#b89b6a;">${email}</a></td></tr>
      ${phone ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Phone</td><td style="padding:6px 0;font-size:14px;">${phone}</td></tr>` : ''}
      ${subject ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Subject</td><td style="padding:6px 0;font-size:14px;">${subject}</td></tr>` : ''}
    </table>

    <div style="background:#f7f3ee;border-radius:6px;padding:20px 24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Message</div>
      <div style="font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">${message}</div>
    </div>`

  await send({
    to: CONTACT_INBOX,
    subject: `New contact form enquiry — ${name}`,
    html: emailShell('New Contact Enquiry — TOCA', body),
    replyTo: email,
  })
}

// ── 4. Newsletter Campaign Broadcast ────────────────────────────────────────────
// Sent during campaign broadcast. Contains custom HTML and attachments.
export async function sendCampaignBroadcast(email, unsubscribeToken, campaign) {
  const mailer = await getTransporter()
  if (!mailer) {
    throw new Error('Nodemailer not configured')
  }

  const BASE = process.env.SERVER_URL || 'http://localhost:3000'
  const unsubUrl = `${BASE}/unsubscribe.html?token=${unsubscribeToken}`
  
  // Format attachments for Nodemailer
  let formattedAttachments = []
  if (campaign.attachments && Array.isArray(campaign.attachments)) {
    formattedAttachments = campaign.attachments.map(att => ({
      filename: att.filename,
      path: att.path,
      contentType: att.mimetype
    }))
  }

  const bodyInner = campaign.contentHtml || ''
  
  // Custom shell for broadcasts to include the unsubscribe link securely at the bottom
  const body = `
    ${bodyInner}
    <div style="border-top:1px solid #e8e0d4;padding-top:20px;margin-top:40px;text-align:center;">
      <p style="font-size:11px;color:#bbb;margin:0;line-height:1.7;">
        You're receiving this because you subscribed at
        <a href="${BASE}" style="color:#b89b6a;text-decoration:none;">toca.co.za</a>.<br>
        Changed your mind?
        <a href="${unsubUrl}"
           style="color:#b89b6a;text-decoration:underline;font-size:11px;">
          Unsubscribe from the TOCA Circle
        </a>
      </p>
    </div>
  `

  await mailer.sendMail({
    from: FROM,
    to: email,
    subject: campaign.subject,
    html: emailShell(campaign.subject, body),
    attachments: formattedAttachments
  })
}

// ── Manual EFT email templates ────────────────────────────────────────────────
// Unlike sendOrderConfirmation above (written for PayFast, never actually
// wired up, and left untouched here), these ARE called live — see
// server/src/lib/eftPaymentService.js and orders.js's manual_eft branch.

async function loadOrderForEftEmail(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      shippingAddress: true,
      items: { include: { variant: { include: { product: true } } } },
      payments: { where: { paymentMethod: 'manual_eft' } }
    }
  })
}

function eftItemRows(items) {
  return (items || []).map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;">
        ${item.productNameSnapshot || item.variant?.product?.name || 'Product'} — ${item.variantLabelSnapshot || item.variant?.size || ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;text-align:center;">
        × ${item.quantity}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;text-align:right;font-weight:bold;">
        R${(Number(item.priceAtPurchase) * item.quantity).toLocaleString()}
      </td>
    </tr>`).join('')
}

// ── EFT instructions ─────────────────────────────────────────────────────────
// Sent immediately after a Manual EFT order is placed (orders.js), and again
// for the balance once a deposit is verified (eftPaymentService.js). amountDue
// defaults to the full order total (unchanged behavior for every pre-Partial-
// Payments caller) but is overridden with the specific payment's own amount
// when it's a deposit or balance rather than full settlement.
export async function sendEftInstructions(orderId, bankDetails, amountDue = null) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return
  const firstName = order.customer.name?.split(' ')[0] || 'Valued Customer'
  const due = amountDue ?? Number(order.totalAmount)
  const isPartial = due < Number(order.totalAmount) - 0.005

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Thank you, ${firstName}!
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Your order has been received. Please complete payment using the EFT details below —
      your order will be prepared as soon as your payment is verified.
    </p>

    <div style="background:#f7f3ee;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Order Reference (use as your EFT reference)</div>
      <div style="font-family:monospace;font-size:16px;color:#1a1a1a;font-weight:bold;">${order.orderNumber}</div>
    </div>

    <div style="border:1px solid #e8e0d4;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Bank Details</div>
      <table style="width:100%;font-size:14px;color:#333;">
        <tr><td style="padding:4px 0;color:#888;">Account Name</td><td style="padding:4px 0;text-align:right;">${bankDetails.bank_holder || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Bank</td><td style="padding:4px 0;text-align:right;">${bankDetails.bank_name || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Account Number</td><td style="padding:4px 0;text-align:right;">${bankDetails.bank_account || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Branch Code</td><td style="padding:4px 0;text-align:right;">${bankDetails.bank_branch || '—'}</td></tr>
        ${bankDetails.bank_account_type ? `<tr><td style="padding:4px 0;color:#888;">Account Type</td><td style="padding:4px 0;text-align:right;">${bankDetails.bank_account_type}</td></tr>` : ''}
        ${bankDetails.bank_swift ? `<tr><td style="padding:4px 0;color:#888;">SWIFT</td><td style="padding:4px 0;text-align:right;">${bankDetails.bank_swift}</td></tr>` : ''}
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;">Item</th>
          <th style="text-align:center;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;">Qty</th>
          <th style="text-align:right;font-size:11px;color:#999;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;">Total</th>
        </tr>
      </thead>
      <tbody>${eftItemRows(order.items)}</tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;border-top:2px solid #1a1a1a;">${isPartial ? 'Amount Due Now' : 'Amount Due'}</td>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;text-align:right;border-top:2px solid #1a1a1a;color:#b89b6a;">
          R${due.toLocaleString()}
        </td>
      </tr>
    </table>

    ${isPartial ? `
    <p style="color:#666;font-size:13px;line-height:1.7;margin:16px 0 0;">
      A remaining balance of <strong>R${(Number(order.totalAmount) - due).toLocaleString()}</strong> will be due once this payment is verified —
      we'll email you separately with instructions for it.
    </p>` : ''}

    <ol style="font-size:13px;color:#666;line-height:1.9;margin-top:28px;padding-left:20px;">
      <li>Make the EFT using the bank details above.</li>
      <li>Use <strong>${order.orderNumber}</strong> as your payment reference.</li>
      <li>Save your proof of payment.</li>
      <li>Upload it from your order confirmation page or your account — we'll verify it and get your order moving.</li>
    </ol>`

  await send({
    to: order.customer.email,
    subject: `Complete your TOCA order — ${order.orderNumber}`,
    html: emailShell('Complete Your Payment — TOCA', body),
  })
}

// ── Proof received ───────────────────────────────────────────────────────────
export async function sendProofReceived(orderId) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Proof of payment received
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      We've received your proof of payment for order <strong>${order.orderNumber}</strong> and will verify it shortly.
      You'll receive another email as soon as it's confirmed.
    </p>`

  await send({
    to: order.customer.email,
    subject: `Proof of payment received — ${order.orderNumber}`,
    html: emailShell('Proof Received — TOCA', body),
  })
}

// ── Payment verified ─────────────────────────────────────────────────────────
export async function sendPaymentVerified(orderId) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Payment verified!
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Your payment for order <strong>${order.orderNumber}</strong> has been verified. Your order is now being prepared.
    </p>`

  await send({
    to: order.customer.email,
    subject: `Payment verified — ${order.orderNumber}`,
    html: emailShell('Payment Verified — TOCA', body),
  })
}

// ── Payment rejected ─────────────────────────────────────────────────────────
export async function sendPaymentRejected(orderId, reason) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      We couldn't verify your payment
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      We were unable to verify your proof of payment for order <strong>${order.orderNumber}</strong>.
      ${reason ? `<br><em>${reason}</em>` : ''}
      Please upload a new proof of payment so we can try again.
    </p>`

  await send({
    to: order.customer.email,
    subject: `Action needed: payment not verified — ${order.orderNumber}`,
    html: emailShell('Payment Not Verified — TOCA', body),
  })
}

// ── Payment reminder ─────────────────────────────────────────────────────────
// Sent by paymentReminderService.js's scheduled sweep for orders still
// unpaid past the admin-configured threshold. Two branches: Manual EFT
// (re-shows the bank details this order was actually pinned to at checkout —
// bankDetails is the order's own Payment.bankAccount, not today's default)
// vs. PayFast/abandoned (reuses the same checkout-recovery link pattern
// already established by admin_ops.js's manual recovery email, so a customer
// gets consistent CTAs regardless of which flow nudged them).
export async function sendPaymentReminderEmail(orderId, { isEft, bankDetails, amountDue } = {}) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return
  const firstName = order.customer.name?.split(' ')[0] || 'Valued Customer'
  const due = amountDue ?? Number(order.totalAmount)
  // A deposit already verified means this reminder is chasing the balance,
  // not the original total — say so explicitly rather than just showing a
  // smaller number with no explanation.
  const isPartial = isEft && due < Number(order.totalAmount) - 0.005

  const body = isEft ? `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Still waiting on your payment, ${firstName}
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Order <strong>${order.orderNumber}</strong> is still awaiting payment. Your items are reserved for a limited time —
      complete your EFT using the details below so we don't have to release them.
      ${isPartial ? ' Your deposit has already been received — this is just the remaining balance.' : ''}
    </p>

    <div style="background:#f7f3ee;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Order Reference (use as your EFT reference)</div>
      <div style="font-family:monospace;font-size:16px;color:#1a1a1a;font-weight:bold;">${order.orderNumber}</div>
    </div>

    <div style="border:1px solid #e8e0d4;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Bank Details</div>
      <table style="width:100%;font-size:14px;color:#333;">
        <tr><td style="padding:4px 0;color:#888;">Account Name</td><td style="padding:4px 0;text-align:right;">${bankDetails?.bank_holder || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Bank</td><td style="padding:4px 0;text-align:right;">${bankDetails?.bank_name || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Account Number</td><td style="padding:4px 0;text-align:right;">${bankDetails?.bank_account || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#888;">Branch Code</td><td style="padding:4px 0;text-align:right;">${bankDetails?.bank_branch || '—'}</td></tr>
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;border-top:2px solid #1a1a1a;">${isPartial ? 'Balance Due' : 'Amount Due'}</td>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;text-align:right;border-top:2px solid #1a1a1a;color:#b89b6a;">
          R${due.toLocaleString()}
        </td>
      </tr>
    </table>` : `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Still there, ${firstName}?
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Your order <strong>${order.orderNumber}</strong> is still waiting for payment — your items are reserved, but not indefinitely.
    </p>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Total: <strong>R${due.toLocaleString()}</strong>
    </p>
    <div style="margin-top:8px;">
      <a href="${process.env.FRONTEND_URL}/checkout.html?recover=${order.id}" style="background:#d4af37;color:#000;padding:12px 24px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">Complete Your Purchase</a>
    </div>`

  await send({
    to: order.customer.email,
    subject: `Reminder: complete your TOCA order — ${order.orderNumber}`,
    html: emailShell('Payment Reminder — TOCA', body),
  })
}

// ── Password reset ───────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(customer, token) {
  if (!customer.email) return
  const BASE = process.env.SERVER_URL || 'http://localhost:3000'
  const resetUrl = `${BASE}/account-reset-password.html?token=${token}`

  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Reset your password
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      We received a request to reset the password on your TOCA account.
      This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;
                padding:14px 36px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;
                border-radius:2px;font-family:Georgia,serif;">
        Reset Password
      </a>
    </div>`

  await send({
    to: customer.email,
    subject: `Reset your TOCA password`,
    html: emailShell('Reset Your Password — TOCA', body),
  })
}

// ── Admin EFT alert ──────────────────────────────────────────────────────────
// Used for the eft_verification_notify_emails setting — a plain internal
// notice, not a customer-branded template.
export async function sendAdminEftAlert(emails, subject, message) {
  const mailer = await getTransporter()
  if (!mailer) return
  for (const to of emails) {
    await send({ to, subject, html: `<p style="font-family:sans-serif;font-size:14px;">${message}</p>` })
  }
}
