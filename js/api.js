/* ============================================================
   TOCA — API Client
   Single source of truth for all backend communication.
   ============================================================ */

// ── Base URL ──────────────────────────────────────────────────────────────────
// Development: server runs on localhost:3000
// Production:  set window.API_BASE before loading this file, or update here.
const API_BASE = window.API_BASE || window.location.origin

// ── Auth token helpers ────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('toca_token') || null
}

export function setToken(token) {
  localStorage.setItem('toca_token', token)
}

export function clearToken() {
  localStorage.removeItem('toca_token')
  localStorage.removeItem('toca_user')
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('toca_user')) } catch { return null }
}

export function setUser(user) {
  localStorage.setItem('toca_user', JSON.stringify(user))
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
// Automatically injects Authorization header when a token exists.
// Throws an Error with a `.status` property on non-2xx responses.

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { ...options.headers }
  
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

    if (res.status === 401) {
      clearToken()
      // Only notify if not already on login page to avoid infinite loops
      if (!window.location.pathname.includes('login')) {
        dispatchMessage('error', 'Authentication Required', 'Please sign in to continue.')
      }
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`
      let detail = ''
      try {
        const body = await res.json()
        message = body.error || body.message || message
        detail = body.detail || ''
      } catch (jsonErr) {}

      const err = new Error(message)
      err.status = res.status
      err.detail = detail
      
      // Global Interception for 5xx and other critical errors
      if (res.status >= 500) {
        dispatchMessage('error', 'System Interruption', 'The server encountered an artisanal error. We are working to restore the scent.')
      } else if (res.status === 403) {
        dispatchMessage('error', 'Access Restricted', 'You do not have the necessary permissions for this action.')
      } else if (res.status === 429) {
        dispatchMessage('warning', 'Rate Limited', 'Please take a moment to breathe before trying again.')
      }

      throw err
    }

    if (res.status === 204) return null
    return await res.json()
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      dispatchMessage('error', 'Network Disruption', 'Unable to reach the server. Please check your internet connection.')
    }
    throw err
  }
}

function dispatchMessage(type, title, message) {
  window.dispatchEvent(new CustomEvent('toca_message', {
    detail: { type, title, message }
  }))
}

// ── Products ──────────────────────────────────────────────────────────────────

export function getProducts(params = {}) {
  const cleanParams = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleanParams[k] = v
    }
  }
  const qs = new URLSearchParams(cleanParams).toString()
  return apiFetch(`/api/products${qs ? '?' + qs : ''}`)
}

export function getProduct(id) {
  return apiFetch(`/api/products/${id}`)
}

export function getCategories() {
  return apiFetch('/api/categories')
}

export function validateCart(items, currency = 'ZAR') {
  return apiFetch('/api/cart/validate', {
    method: 'POST',
    body: JSON.stringify({ items, currency })
  })
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function createOrder(payload) {
  return apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) })
}

export function getOrder(id) {
  return apiFetch(`/api/orders/${id}`)
}

export function getShippingEstimate(country, postalCode, subtotal) {
  const qs = new URLSearchParams({ country, postalCode, subtotal }).toString()
  return apiFetch(`/api/orders/shipping/estimate?${qs}`)
}

// Live coupon/tax preview shown in the checkout summary before payment —
// see POST /api/orders/preview for why shipping cost isn't part of this
// (that stays the client-selected delivery-method price for now).
export function getOrderPreview(payload) {
  return apiFetch('/api/orders/preview', { method: 'POST', body: JSON.stringify(payload) })
}

// ── Manual EFT ────────────────────────────────────────────────────────────────

export function getEftBankDetails() {
  return apiFetch('/api/orders/eft/bank-details')
}

// { enabled, percentage } — whether checkout should offer a "pay a deposit
// now" option for Manual EFT, and what portion of the total is due upfront.
export function getEftDepositConfig() {
  return apiFetch('/api/orders/eft/deposit-config')
}

// Public, order-UUID-scoped — works for a guest checkout with no login,
// same trust model as getOrder() above. Logged-in customers should prefer
// uploadMyOrderProof() instead (ownership-checked via their account).
export function uploadEftProof(orderId, file) {
  const form = new FormData()
  form.append('proof', file)
  return apiFetch(`/api/orders/${orderId}/proof`, { method: 'POST', body: form })
}


// ── Auth ──────────────────────────────────────────────────────────────────────

export function logout() {
  clearToken()
}

// ── Customer account ──────────────────────────────────────────────────────────
// These hit the /api/customers/* routes. All these functions share the same
// generic getToken/setToken/getUser/setUser storage helpers, since a browser
// only ever holds one active session.

export async function registerCustomer({ name, email, password, phone }) {
  const data = await apiFetch('/api/customers/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, phone }),
  })
  setToken(data.token)
  setUser(data.customer)
  return data
}

export async function loginCustomer(email, password) {
  const data = await apiFetch('/api/customers/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  setUser(data.customer)
  if (typeof mergeGuestWishlist === 'function') mergeGuestWishlist();
  return data
}

export function forgotPassword(email) {
  return apiFetch('/api/customers/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

export function resetPassword(token, newPassword) {
  return apiFetch('/api/customers/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) })
}

export function getMyProfile() {
  return apiFetch('/api/customers/me')
}

export function updateMyProfile(data) {
  return apiFetch('/api/customers/me', { method: 'PATCH', body: JSON.stringify(data) })
}

export function getMyAddresses() {
  return apiFetch('/api/customers/me/addresses')
}

export function createMyAddress(data) {
  return apiFetch('/api/customers/me/addresses', { method: 'POST', body: JSON.stringify(data) })
}

export function updateMyAddress(id, data) {
  return apiFetch(`/api/customers/me/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteMyAddress(id) {
  return apiFetch(`/api/customers/me/addresses/${id}`, { method: 'DELETE' })
}

export function getMyOrders() {
  return apiFetch('/api/customers/me/orders')
}

export function getMyOrder(id) {
  return apiFetch(`/api/customers/me/orders/${id}`)
}

// Ownership-checked equivalent of uploadEftProof() for a logged-in customer.
export function uploadMyOrderProof(orderId, file) {
  const form = new FormData()
  form.append('proof', file)
  return apiFetch(`/api/customers/me/orders/${orderId}/proof`, { method: 'POST', body: form })
}

// ── Privacy Centre (POPIA) ──────────────────────────────────────────────────

export function getMyConsent() {
  return apiFetch('/api/privacy/consent')
}

export function setMyConsent(purpose, granted) {
  return apiFetch('/api/privacy/consent', { method: 'POST', body: JSON.stringify({ purpose, granted }) })
}

export function exportMyData() {
  return apiFetch('/api/privacy/export')
}

export function getMyDataRequests() {
  return apiFetch('/api/privacy/requests')
}

export function createMyDataRequest(type, details, confirm) {
  return apiFetch('/api/privacy/requests', { method: 'POST', body: JSON.stringify({ type, details, confirm }) })
}

// ── Tracking ──────────────────────────────────────────────────────────────────

export function getTracking(number) {
  return apiFetch(`/api/tracking/${encodeURIComponent(number)}`)
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export function submitQuote(payload) {
  return apiFetch('/api/quotes', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}
