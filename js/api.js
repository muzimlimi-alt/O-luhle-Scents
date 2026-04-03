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
  return getUser()?.role === 'ADMIN'
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
// Automatically injects Authorization header when a token exists.
// Throws an Error with a `.status` property on non-2xx responses.

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }

  // 204 No Content — return null
  if (res.status === 204) return null
  return res.json()
}

// ── Products ──────────────────────────────────────────────────────────────────

export function getProducts(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString()
  return apiFetch(`/api/products${qs ? '?' + qs : ''}`)
}

export function getProduct(id) {
  return apiFetch(`/api/products/${id}`)
}

export function getCategories() {
  return apiFetch('/api/categories')
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
  return apiFetch('/api/products', { method: 'POST', body: JSON.stringify(data) })
}

export function adminUpdateProduct(id, data) {
  return apiFetch(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
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

export function adminGetLowStock() {
  return apiFetch('/api/products/low-stock')
}

export function adminGetSales(period = 30) {
  return apiFetch(`/api/admin/sales?period=${period}`)
}
