/**
 * PayFast Utility — single source of truth for all PayFast-related logic.
 *
 * Both orders.js (payment initiation) and webhooks.js (ITN verification)
 * import from here to guarantee identical signature encoding.
 *
 * PayFast signature spec:
 *   1. Sort all fields alphabetically by key
 *   2. URL-encode values (spaces → +, not %20 — PayFast requirement)
 *   3. Join as key=value pairs with &
 *   4. If passphrase is set, append &passphrase=<encoded_passphrase>
 *   5. MD5-hash the resulting string
 */

import crypto from 'crypto'
import https  from 'https'

// ─── IP Allowlist ─────────────────────────────────────────────────────────────
// PayFast sends ITN from two CIDR ranges (their official documentation):
//   197.97.145.144/28  and  41.74.179.192/27
const PAYFAST_IP_RANGES = [
  { base: [197, 97,  145, 144], bits: 28 },
  { base: [41,  74,  179, 192], bits: 27 },
]

function ipToInt(parts) {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

export function isPayfastIP(ip) {
  if (!ip || typeof ip !== 'string') return false

  // Node/Express can represent an IPv4 client as an IPv6-mapped address
  // (e.g. "::ffff:197.97.145.150") depending on the socket/proxy layer —
  // strip that prefix before the dotted-quad parse below, or a perfectly
  // real PayFast IP gets rejected purely on notation.
  const normalized = ip.replace(/^::ffff:/i, '')

  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return false

  return PAYFAST_IP_RANGES.some(({ base, bits }) => {
    const mask    = (~((1 << (32 - bits)) - 1)) >>> 0
    const ipInt   = ipToInt(parts)
    const baseInt = ipToInt(base)
    return (ipInt & mask) === (baseInt & mask)
  })
}

// ─── Signature ────────────────────────────────────────────────────────────────

/**
 * Build a PayFast-compatible MD5 signature from a data object.
 *
 * @param {Record<string, string|number>} data       - All fields (signature key excluded)
 * @param {string|null}                  passphrase  - Merchant passphrase (or null if not set)
 * @param {boolean}                      shouldSort  - Whether to sort keys alphabetically (true for ITN/API, false for Checkout)
 * @returns {string} MD5 hex digest
 */
export function buildSignature(data, passphrase, shouldSort = true) {
  const keys = Object.keys(data).filter(k => k !== 'signature' && data[k] !== '' && data[k] != null)
  if (shouldSort) keys.sort()

  const encoded = keys
    .map(k => {
      const val = String(data[k]).trim()
      const enc = encodeURIComponent(val)
        .replace(/%20/g, '+')
        .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%[0-9a-f]{2}/g, match => match.toUpperCase())
      return `${k}=${enc}`
    })
    .join('&')

  const str = (passphrase && passphrase.trim() !== '')
    ? `${encoded}&passphrase=${encodeURIComponent(passphrase.trim())
        .replace(/%20/g, '+')
        .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%[0-9a-f]{2}/g, match => match.toUpperCase())}`
    : encoded

  return crypto.createHash('md5').update(str).digest('hex')
}

// ─── Payment Payload Builder ──────────────────────────────────────────────────

/**
 * Build the complete signed PayFast payment payload for a pending order.
 * All amounts come from the database — never from the frontend.
 *
 * @param {{
 *   id: string,
 *   totalAmount: number,
 *   email: string,
 *   shippingAddress: { firstName: string, lastName: string }
 * }} order
 * @returns {{ payfastUrl: string, payfastData: Record<string, string> }}
 */
export function buildPaymentPayload(order) {
  const sandbox     = process.env.PAYFAST_SANDBOX !== 'false'  // default sandbox = true
  const payfastUrl  = sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process'

  const notifyUrl   = process.env.PAYFAST_ITN_URL
    || `${process.env.SERVER_URL || 'http://localhost:3000'}/api/webhooks/payfast`

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, '')

  const data = {
    merchant_id:   process.env.PAYFAST_MERCHANT_ID,
    merchant_key:  process.env.PAYFAST_MERCHANT_KEY,
    return_url:    `${frontendUrl}/checkout-success.html?order=${order.id}`,
    cancel_url:    `${frontendUrl}/checkout.html`,
    notify_url:    notifyUrl,
    name_first:    order.shippingAddress.firstName,
    name_last:     order.shippingAddress.lastName,
    email_address: order.email,
    m_payment_id:  order.id,
    amount:        parseFloat(order.totalAmount).toFixed(2),
    item_name:     "TOCA Order",
  }

  data.signature = buildSignature(data, process.env.PAYFAST_PASSPHRASE || null, false)

  return { payfastUrl, payfastData: data }
}

// ─── ITN Server Validation ────────────────────────────────────────────────────

/**
 * POST the received ITN payload back to PayFast to confirm it is genuine.
 * PayFast responds with plain-text "VALID" or "INVALID".
 *
 * @param {Record<string, string>} pfData  - Raw ITN fields received from PayFast
 * @returns {Promise<boolean>}
 */
export function validateItnWithPayfast(pfData) {
  return new Promise((resolve, reject) => {
    const sandbox = process.env.PAYFAST_SANDBOX !== 'false'
    const host    = sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'

    // Re-encode the payload as application/x-www-form-urlencoded
    const body = Object.entries(pfData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const options = {
      hostname: host,
      port:     443,
      path:     '/eng/query/validate',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => resolve(data.trim() === 'VALID'))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}
