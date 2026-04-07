/* ============================================================
   O'luhle Scents — API Client
   Single source of truth for all backend communication.
   ============================================================ */

// ── Base URL ──────────────────────────────────────────────────────────────────
// Development: server runs on localhost:3000
// Production:  set window.API_BASE before loading this file, or update here.
const API_BASE = window.API_BASE || window.location.origin

// ── Auth token helpers ────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('oluhle_token') || null
}

export function setToken(token) {
  localStorage.setItem('oluhle_token', token)
}

export function clearToken() {
  localStorage.removeItem('oluhle_token')
  localStorage.removeItem('oluhle_user')
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('oluhle_user')) } catch { return null }
}

export function setUser(user) {
  localStorage.setItem('oluhle_user', JSON.stringify(user))
}

export function isAdmin() {
  return !!getToken() && getUser()?.role === 'ADMIN'
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
  window.dispatchEvent(new CustomEvent('oluhle_message', {
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

export function initiatePayment(orderId) {
  return apiFetch(`/api/orders/${orderId}/pay`, { method: 'POST' })
}

export function getShippingEstimate(country, postalCode, subtotal) {
  const qs = new URLSearchParams({ country, postalCode, subtotal }).toString()
  return apiFetch(`/api/orders/shipping/estimate?${qs}`)
}


// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  setUser(data.user)
  return data
}

export async function register(payload) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setToken(data.token)
  setUser(data.user)
  return data
}

export function logout() {
  clearToken()
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function adminGetOrders() {
  return apiFetch('/api/orders')
}

export function adminUpdateOrderStatus(id, status) {
  return apiFetch(`/api/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function adminCreateProduct(data) {
  const options = { method: 'POST', body: data }
  if (!(data instanceof FormData)) {
    options.body = JSON.stringify(data)
  }
  return apiFetch('/api/products', options)
}

export function adminUpdateProduct(id, data) {
  const options = { method: 'PATCH', body: data }
  if (!(data instanceof FormData)) {
    options.body = JSON.stringify(data)
  }
  return apiFetch(`/api/products/${id}`, options)
}

export function adminDeleteProduct(id) {
  return apiFetch(`/api/products/${id}`, { method: 'DELETE' })
}

export function adminUpdateStock(id, stockQty) {
  return apiFetch(`/api/products/${id}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ stockQty }),
  })
}

export function adminGetAnalytics(period = 30) {
  return apiFetch(`/api/admin/analytics?period=${period}`)
}

export function adminGetMetrics() {
  return apiFetch('/api/admin/metrics')
}

export function adminGetLowStock(threshold = 5) {
  return apiFetch(`/api/products/low-stock?threshold=${threshold}`)
}

export function adminGetSales(period = 30) {
  return apiFetch(`/api/admin/sales?period=${period}`)
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
