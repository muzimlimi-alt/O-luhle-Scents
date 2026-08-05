/**
 * O'luhle Scents — Email Service
 *
 * Uses Nodemailer — configure your .env with:
 *   EMAIL_USER="you@gmail.com"
 *   EMAIL_PASS="your_app_password"
 *   EMAIL_FROM="O'luhle Scents <orders@yourdomain.com>"
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

const FROM = process.env.EMAIL_FROM || "O'luhle Scents <orders@oluhle.co.za>"

// ── Safe send wrapper ─────────────────────────────────────────────────────────
async function send({ to, subject, html }) {
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
      html
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
        O'luhle <em>Scents</em>
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
        &copy; ${new Date().getFullYear()} O'luhle Scents &nbsp;·&nbsp;
        <a href="tel:0761112096" style="color:#b89b6a;text-decoration:none;">076 111 2096</a>
      </p>
      <p style="font-size:11px;color:#bbb;margin:8px 0 0;">
        Questions? Reply to this email or visit
        <a href="${process.env.SERVER_URL || 'http://localhost:3000'}" style="color:#b89b6a;">oluhle.co.za</a>
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
        ${item.product?.name || 'Product'} — ${item.size}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;text-align:center;">
        × ${item.quantity}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f2ede7;font-size:14px;text-align:right;font-weight:bold;">
        R${(item.price * item.quantity).toLocaleString()}
      </td>
    </tr>`).join('')
}

// ── 1. Order confirmation ─────────────────────────────────────────────────────
// Triggered after PayFast ITN confirms payment (payment_status = COMPLETE).
export async function sendOrderConfirmation(order) {
  const firstName = order.shippingAddress?.firstName || 'Valued Customer'
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
      <div style="font-family:monospace;font-size:14px;color:#1a1a1a;">${order.id}</div>
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
        <td style="padding:6px 0;color:#666;font-size:13px;">Shipping (${order.shippingMethod})</td>
        <td style="padding:6px 0;font-size:13px;text-align:right;">R${(order.shippingCost || 0).toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;border-top:2px solid #1a1a1a;">Total Paid</td>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;text-align:right;border-top:2px solid #1a1a1a;color:#b89b6a;">
          R${(order.totalAmount || 0).toLocaleString()}
        </td>
      </tr>
    </table>

    <div style="margin-top:32px;padding:20px 24px;border:1px solid #e8e0d4;border-radius:6px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Shipping To</div>
      <div style="font-size:14px;line-height:1.7;color:#444;">
        ${order.shippingAddress?.firstName || ''} ${order.shippingAddress?.lastName || ''}<br>
        ${order.shippingAddress?.street || ''}${order.shippingAddress?.apartment ? ', ' + order.shippingAddress.apartment : ''}<br>
        ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.province || ''} ${order.shippingAddress?.postalCode || ''}
      </div>
    </div>

    <p style="font-size:13px;color:#888;margin-top:28px;line-height:1.7;">
      Estimated delivery:
      ${order.shippingMethod === 'express' ? '1–2 business days' : '3–5 business days'}.
      You'll receive a shipping confirmation email once your order is dispatched.
    </p>`

  await send({
    to:      order.email,
    subject: `Your O'luhle Scents order is confirmed ✦`,
    html:    emailShell(`Order Confirmed — O'luhle Scents`, body),
  })
}

// ── 2. Shipping update ────────────────────────────────────────────────────────
// Triggered when an admin updates order status to 'shipped'.
export async function sendShippingUpdate(order) {
  const firstName = order.shippingAddress?.firstName || 'Valued Customer'
  const body = `
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;font-size:20px;margin:0 0 8px;">
      Your order is on its way, ${firstName}!
    </h2>
    <p style="color:#666;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Great news — your O'luhle Scents fragrance has been dispatched and is now
      on its way to you.
    </p>

    <div style="background:#f7f3ee;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#999;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Order Reference</div>
      <div style="font-family:monospace;font-size:14px;color:#1a1a1a;">${order.id}</div>
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

    <div style="margin-top:32px;padding:20px 24px;background:#1a1a1a;border-radius:6px;text-align:center;">
      <div style="color:#d4af37;font-size:24px;margin-bottom:8px;">✈</div>
      <div style="font-size:13px;color:#ccc;">
        Estimated arrival: ${order.shippingMethod === 'express' ? '1–2 business days' : '3–5 business days'}
      </div>
    </div>

    <p style="font-size:13px;color:#888;margin-top:28px;line-height:1.7;">
      Delivering to:
      ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.province || ''}.
      If you have any questions about your delivery, reply to this email or call us at
      <a href="tel:0761112096" style="color:#b89b6a;">076 111 2096</a>.
    </p>`

  await send({
    to:      order.email,
    subject: `Your O'luhle Scents order has shipped ✦`,
    html:    emailShell(`Order Shipped — O'luhle Scents`, body),
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
      Welcome to the O'luhle Circle
    </h2>
    <p style="color:#888;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;text-align:center;margin:0 0 28px;">
      Extrait de Parfum — Exclusivity Awaits
    </p>

    <p style="color:#555;font-size:14px;line-height:1.8;margin:0 0 20px;">
      Thank you for joining us. As a member of the O'luhle Circle, you'll be the first to know about
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
        <a href="${BASE}" style="color:#b89b6a;text-decoration:none;">oluhlescents.co.za</a>.<br>
        Changed your mind?
        <a href="${unsubUrl}"
           style="color:#b89b6a;text-decoration:underline;font-size:11px;">
          Unsubscribe from the O'luhle Circle
        </a>
      </p>
    </div>`

  await send({
    to:      email,
    subject: `Welcome to the O'luhle Circle ✦`,
    html:    emailShell(`Welcome to the O'luhle Circle`, body),
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
        <a href="${BASE}" style="color:#b89b6a;text-decoration:none;">oluhlescents.co.za</a>.<br>
        Changed your mind?
        <a href="${unsubUrl}"
           style="color:#b89b6a;text-decoration:underline;font-size:11px;">
          Unsubscribe from the O'luhle Circle
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
// Unlike sendOrderConfirmation/sendShippingUpdate above (written for PayFast,
// never actually wired up, and left untouched here), these ARE called live —
// see server/src/lib/eftPaymentService.js and orders.js's manual_eft branch.

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
// Sent immediately after a Manual EFT order is placed (orders.js).
export async function sendEftInstructions(orderId, bankDetails) {
  const order = await loadOrderForEftEmail(orderId)
  if (!order?.customer?.email) return
  const firstName = order.customer.name?.split(' ')[0] || 'Valued Customer'

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
        <td style="padding:8px 0;font-size:15px;font-weight:bold;border-top:2px solid #1a1a1a;">Amount Due</td>
        <td style="padding:8px 0;font-size:15px;font-weight:bold;text-align:right;border-top:2px solid #1a1a1a;color:#b89b6a;">
          R${Number(order.totalAmount).toLocaleString()}
        </td>
      </tr>
    </table>

    <ol style="font-size:13px;color:#666;line-height:1.9;margin-top:28px;padding-left:20px;">
      <li>Make the EFT using the bank details above.</li>
      <li>Use <strong>${order.orderNumber}</strong> as your payment reference.</li>
      <li>Save your proof of payment.</li>
      <li>Upload it from your order confirmation page or your account — we'll verify it and get your order moving.</li>
    </ol>`

  await send({
    to: order.customer.email,
    subject: `Complete your O'luhle Scents order — ${order.orderNumber}`,
    html: emailShell('Complete Your Payment — O\'luhle Scents', body),
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
    html: emailShell('Proof Received — O\'luhle Scents', body),
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
    html: emailShell('Payment Verified — O\'luhle Scents', body),
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
    html: emailShell('Payment Not Verified — O\'luhle Scents', body),
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
      We received a request to reset the password on your O'luhle Scents account.
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
    subject: `Reset your O'luhle Scents password`,
    html: emailShell('Reset Your Password — O\'luhle Scents', body),
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
