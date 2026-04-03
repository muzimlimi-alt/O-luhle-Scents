/**
 * O'luhle Scents — Email Service
 *
 * Uses Resend (https://resend.com) — add your API key to .env:
 *   RESEND_API_KEY="re_xxxxxxxxxxxx"
 *   EMAIL_FROM="O'luhle Scents <orders@yourdomain.com>"
 *
 * Install: npm install resend  (inside server/)
 *
 * Emails are sent fire-and-forget; a send failure NEVER crashes the
 * calling route — it only logs a warning.
 */

let resend = null

async function getResend() {
  if (resend) return resend
  if (!process.env.RESEND_API_KEY) return null
  try {
    const { Resend } = await import('resend')
    resend = new Resend(process.env.RESEND_API_KEY)
  } catch {
    console.warn('[Email] Resend package not installed — run: npm install resend')
  }
  return resend
}

const FROM = process.env.EMAIL_FROM || "O'luhle Scents <orders@oluhle.co.za>"

// ── Safe send wrapper ─────────────────────────────────────────────────────────
async function send({ to, subject, html }) {
  const client = await getResend()
  if (!client) {
    console.warn('[Email] No RESEND_API_KEY — email not sent:', subject)
    return
  }
  try {
    await client.emails.send({ from: FROM, to, subject, html })
    console.log(`[Email] Sent "${subject}" to ${to}`)
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
