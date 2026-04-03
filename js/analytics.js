/* ============================================================
   O'luhle Scents — Analytics
   Wraps GA4 (gtag) and Meta Pixel (fbq).
   Both base scripts are loaded via classic <script> tags in each
   HTML <head>; this module safely calls the globals if present.

   Replace G-XXXXXXXXXX  →  your GA4 Measurement ID
   Replace YOUR_PIXEL_ID →  your Meta Pixel ID

   Cookie consent is checked via window.OluhleConsent before
   any tracking call is made. Declining analytics or marketing
   silences the corresponding tracker automatically.
   ============================================================ */

// ── Consent helpers ──────────────────────────────────────────────────────────

function analyticsAllowed() {
  return window.OluhleConsent ? window.OluhleConsent.allows('analytics') : false
}

function marketingAllowed() {
  return window.OluhleConsent ? window.OluhleConsent.allows('marketing') : false
}

// ── Safe wrappers (no-op when scripts haven't loaded or consent denied) ──────

function gtag(...args) {
  if (analyticsAllowed() && typeof window.gtag === 'function') window.gtag(...args)
}

function fbq(...args) {
  if (marketingAllowed() && typeof window.fbq === 'function') window.fbq(...args)
}

// ── view_item  ────────────────────────────────────────────────────────────────
// Call after a product page loads with the full product object from the API.
export function trackViewItem(product) {
  gtag('event', 'view_item', {
    currency: 'ZAR',
    value:    product.price100ml,
    items: [{
      item_id:       product.id,
      item_name:     product.name,
      item_category: product.category?.name || '',
      price:         product.price100ml,
      quantity:      1,
    }],
  })

  fbq('track', 'ViewContent', {
    content_ids:  [product.id],
    content_name: product.name,
    content_type: 'product',
    value:        product.price100ml,
    currency:     'ZAR',
  })
}

// ── add_to_cart ───────────────────────────────────────────────────────────────
// Call when any item is added to the cart.
export function trackAddToCart({ productId, name, price, size, quantity = 1 }) {
  gtag('event', 'add_to_cart', {
    currency: 'ZAR',
    value:    price * quantity,
    items: [{
      item_id:      productId,
      item_name:    name,
      item_variant: size,
      price,
      quantity,
    }],
  })

  fbq('track', 'AddToCart', {
    content_ids:  [productId],
    content_name: name,
    content_type: 'product',
    value:        price * quantity,
    currency:     'ZAR',
  })
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

// ── purchase ──────────────────────────────────────────────────────────────────
// Call on checkout-success.html after loading the confirmed order from the API.
// `order` is the full order object returned by GET /api/orders/:id
export function trackPurchase(order) {
  gtag('event', 'purchase', {
    transaction_id: order.id,
    currency:       'ZAR',
    value:          order.totalAmount,
    shipping:       order.shippingCost,
    items:          (order.items || []).map(i => ({
      item_id:      i.productId,
      item_name:    i.product?.name || '',
      item_variant: i.size,
      price:        i.price,
      quantity:     i.quantity,
    })),
  })

  fbq('track', 'Purchase', {
    value:    order.totalAmount,
    currency: 'ZAR',
  })
}
