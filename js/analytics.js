/* ============================================================
   TOCA — Analytics
   Wraps GA4 (gtag) and Meta Pixel (fbq).
   Both base scripts are loaded via classic <script> tags in each
   HTML <head>; this module safely calls the globals if present.

   Replace G-XXXXXXXXXX  →  your GA4 Measurement ID
   Replace YOUR_PIXEL_ID →  your Meta Pixel ID

   Cookie consent is checked via window.TocaConsent before
   any tracking call is made. Declining analytics or marketing
   silences the corresponding tracker automatically.
   ============================================================ */

// ── Consent helpers ──────────────────────────────────────────────────────────

function analyticsAllowed() {
  return window.TocaConsent ? window.TocaConsent.allows('analytics') : false
}

function marketingAllowed() {
  return window.TocaConsent ? window.TocaConsent.allows('marketing') : false
}

// ── Safe wrappers (no-op when scripts haven't loaded or consent denied) ──────

function gtag(...args) {
  if (analyticsAllowed() && typeof window.gtag === 'function') window.gtag(...args)
}

function fbq(...args) {
  if (marketingAllowed() && typeof window.fbq === 'function') window.fbq(...args)
}

// ── begin_checkout ────────────────────────────────────────────────────────────
// Call when a user arrives on the checkout page.
export function trackBeginCheckout(cartItems) {
  const subtotal    = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalItems  = cartItems.reduce((s, i) => s + i.quantity, 0)

  gtag('event', 'begin_checkout', {
    currency: 'ZAR',
    value:    subtotal,
    items:    cartItems.map(i => ({
      item_id:      i.productId,
      item_name:    i.name,
      item_variant: i.size,
      price:        i.price,
      quantity:     i.quantity,
    })),
  })

  fbq('track', 'InitiateCheckout', {
    value:     subtotal,
    currency:  'ZAR',
    num_items: totalItems,
  })
}
