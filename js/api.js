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
  
  // Only set JSON content type if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  
  if (token) headers['Authorization'] = `Bearer ${token}`

  console.log(`[API] Fetch started: ${path}`)
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    console.log(`[API] Fetch finished: ${path} (${res.status})`)

    if (!res.ok) {
      if (res.status === 401) {
        console.warn(`[API] Unauthorized (401) at ${path}. Clearing token.`)
        clearToken()
      }

      let message = `Request failed (${res.status})`
      try {
        const body = await res.json()
        message = body.error || body.message || message
      } catch (jsonErr) {
        console.warn(`[API] Failed to parse error JSON from ${path}`)
      }
      const err = new Error(message)
      err.status = res.status
      throw err
    }

    if (res.status === 204) return null
    return await res.json()
  } catch (err) {
    console.error(`[API] Fetch error for ${path}:`, err.message)
    throw err
  }
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
