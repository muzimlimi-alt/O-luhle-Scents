/* ============================================================
   O'luhle Scents — Admin Dashboard
   ============================================================ */

import {
  getUser, isAdmin, logout, login,
  getCategories,
  getProducts,
  adminGetOrders,
  adminUpdateOrderStatus,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminGetAnalytics,
  adminGetMetrics,
  adminGetLowStock,
  adminGetSales,
} from './api.js'

// ── Auth guard ────────────────────────────────────────────────────────────────
// Hide UI immediately if not logged in as admin.
;(function guardAdmin() {
  if (!isAdmin()) {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('admin-wrapper').style.display = 'none'
      document.getElementById('login-container').style.display = 'flex'
      const loader = document.querySelector('.page-loader')
      if (loader) {
        loader.style.opacity = '0'
        setTimeout(() => loader.style.display = 'none', 500)
      }
    })
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('admin-wrapper').style.display = 'block'
    })
  }
})()

// ── Page init ─────────────────────────────────────────────────────────────────

let allOrders   = []
let allProducts = []
let categories  = []

document.addEventListener('DOMContentLoaded', async () => {
  // Show admin email in header
  const user = getUser()
  const emailEl = document.getElementById('admin-email')
  if (emailEl && user) emailEl.textContent = user.email

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    logout()
    window.location.href = 'index.html'
  })

  // Sidebar navigation — lazy-load analytics on first visit
  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`section-${btn.dataset.section}`).classList.add('active')
      if (btn.dataset.section === 'analytics') loadAnalytics()
    })
  })

  // Period selector
  document.getElementById('analytics-period')?.addEventListener('change', loadAnalytics)

  // Login form handler
  const loginForm = document.getElementById('admin-login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('login-email').value
      const password = document.getElementById('login-password').value
      const errorEl = document.getElementById('login-error')
      const btn = loginForm.querySelector('button')
      
      try {
        errorEl.style.display = 'none'
        btn.disabled = true
        btn.textContent = 'Logging in...'
        
        await login(email, password)
        
        if (isAdmin()) {
          window.location.reload()
        } else {
          logout()
          errorEl.textContent = 'Admin access required. This account does not have admin privileges.'
          errorEl.style.display = 'block'
        }
      } catch (err) {
        errorEl.textContent = err.message || 'Login failed'
        errorEl.style.display = 'block'
      } finally {
        btn.disabled = false
        btn.textContent = 'Login'
      }
    })
  }

  // Load everything in parallel
  try {
    if (isAdmin()) {
        await Promise.all([loadOrders(), loadProducts(), loadCategories(), loadDashboardMetrics()])
    }
  } finally {
    // Hide loader after all attempts (success or fail)
    const loader = document.querySelector('.page-loader')
    if (loader && isAdmin()) {
      loader.style.opacity = '0'
      setTimeout(() => loader.style.display = 'none', 500)
    }
  }
})

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadOrders() {
  try {
    allOrders = await adminGetOrders()
    renderOrdersTable(allOrders)
  } catch (err) {
    document.getElementById('orders-body').innerHTML =
      `<tr><td colspan="7" class="empty-state" style="color:#c0392b;">${err.message}</td></tr>`
  }
}

async function loadProducts() {
  try {
    allProducts = res || []
    renderProductsTable(allProducts)
  } catch (err) {
    document.getElementById('products-body').innerHTML =
      `<tr><td colspan="7" class="empty-state" style="color:#c0392b;">${err.message}</td></tr>`
  }
}

async function loadCategories() {
  try {
    categories = await getCategories()
    const sel = document.getElementById('p-category')
    sel.innerHTML = '<option value="">Select…</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
  } catch {}
}

// ── Overview ──────────────────────────────────────────────────────────────────

async function loadDashboardMetrics() {
  try {
    const [metrics, lowStock, sales] = await Promise.all([
      adminGetMetrics(),
      adminGetLowStock(),
      adminGetSales(30)
    ])

    // Update Metric Cards
    document.getElementById('stat-revenue').textContent  = `R${Math.round(metrics.totalRevenue).toLocaleString()}`
    document.getElementById('stat-orders').textContent   = metrics.totalOrders.toLocaleString()
    document.getElementById('stat-customers').textContent = metrics.totalCustomers.toLocaleString()
    document.getElementById('stat-low-stock').textContent = lowStock.length

    // Update Low Stock Alert Panel
    const alertPanel = document.getElementById('low-stock-alert')
    const alertList  = document.getElementById('low-stock-list')
    if (lowStock.length > 0) {
      alertPanel.style.display = 'block'
      alertList.innerHTML = lowStock.map(p => `
        <div class="alert-item">
          <span><strong>${escHtml(p.name)}</strong> (${escHtml(p.size || '100ml')})</span>
          <span style="font-weight:600;">Stock: ${p.stockQty}</span>
        </div>
      `).join('')
    } else {
      alertPanel.style.display = 'none'
    }

    // Initialize Sales Chart
    initSalesChart(sales)

    // Recent orders table (Overview)
    const recent = allOrders.slice(0, 8)
    document.getElementById('recent-orders-body').innerHTML = recent.length
      ? recent.map(o => `
          <tr>
            <td style="font-size:0.75rem;font-family:monospace;">${o.id.slice(0, 8)}…</td>
            <td>${escHtml(o.email)}</td>
            <td>R${(o.total || 0).toLocaleString()}</td>
            <td><span class="badge badge--${o.status}">${o.status}</span></td>
            <td>${fmtDate(o.createdAt)}</td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="empty-state">No orders yet.</td></tr>'

  } catch (err) {
    console.error('Failed to load dashboard metrics:', err)
  }
}

let salesChart = null
function initSalesChart(data) {
  const ctx = document.getElementById('salesTrendsChart')
  if (!ctx) return
  if (salesChart) salesChart.destroy()

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [{
        label: 'Revenue (R)',
        data: data.map(d => d.revenue),
        borderColor: '#d4af37',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  })
}

// ── Orders table ──────────────────────────────────────────────────────────────

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-body')
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No orders yet.</td></tr>'
    return
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-size:0.72rem;font-family:monospace;">${o.id.slice(0, 8)}…</td>
      <td>${escHtml(o.email)}</td>
      <td>${(o.items || []).length} item(s)</td>
      <td>R${(o.total || 0).toLocaleString()}</td>
      <td style="text-transform:capitalize;">${o.shippingMethod || '—'}</td>
      <td>
        <select class="status-select" data-order-id="${o.id}" data-current="${o.status}">
          ${STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${fmtDate(o.createdAt)}</td>
    </tr>`).join('')

  // Wire status dropdowns
  tbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const orderId = sel.dataset.orderId
      const newStatus = sel.value
      const prev = sel.dataset.current
      try {
        await adminUpdateOrderStatus(orderId, newStatus)
        sel.dataset.current = newStatus
        // Refresh metrics
        loadDashboardMetrics()
      } catch (err) {
        alert(`Failed to update status: ${err.message}`)
        sel.value = prev
      }
    })
  })
}

// ── Products table ────────────────────────────────────────────────────────────

function renderProductsTable(products) {
  const tbody = document.getElementById('products-body')
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No products found.</td></tr>'
    return
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td style="font-size:0.75rem;font-family:monospace;">${escHtml(p.sku)}</td>
      <td>${escHtml(p.name)}${p.badge ? ` <span class="badge badge--paid">${escHtml(p.badge)}</span>` : ''}</td>
      <td>${escHtml(p.category?.name || '—')}</td>
      <td>R${(p.price50ml || 0).toLocaleString()}</td>
      <td>R${(p.price100ml || 0).toLocaleString()}</td>
      <td>
        <span style="color:${p.stockQty > 0 ? 'inherit' : '#c0392b'};">${p.stockQty}</span>
      </td>
      <td style="display:flex;gap:8px;">
        <button class="btn btn--outline btn--xs" data-edit="${p.id}">Edit</button>
        <button class="btn btn--danger btn--xs" data-delete="${p.id}" data-name="${escHtml(p.name)}">Delete</button>
      </td>
    </tr>`).join('')

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit))
  })
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.delete, btn.dataset.name))
  })
}

// ── Product modal ─────────────────────────────────────────────────────────────

const modal       = document.getElementById('product-modal')
const modalTitle  = document.getElementById('modal-title')
const modalError  = document.getElementById('modal-error')
const productForm = document.getElementById('product-form')

function openModal(title) {
  modalTitle.textContent = title
  modalError.style.display = 'none'
  modalError.textContent  = ''
  modal.classList.add('open')
}

function closeModal() {
  modal.classList.remove('open')
  productForm.reset()
  document.getElementById('product-id').value = ''
}

document.getElementById('modal-close').addEventListener('click', closeModal)
document.getElementById('modal-cancel').addEventListener('click', closeModal)
modal.addEventListener('click', e => { if (e.target === modal) closeModal() })

document.getElementById('add-product-btn').addEventListener('click', () => {
  openModal('Add Product')
})

function openEditModal(productId) {
  const p = allProducts.find(x => x.id === productId)
  if (!p) return
  openModal('Edit Product')
  document.getElementById('product-id').value    = p.id
  document.getElementById('p-name').value        = p.name
  document.getElementById('p-sku').value         = p.sku
  document.getElementById('p-description').value = p.description
  document.getElementById('p-stock').value       = p.stockQty
  document.getElementById('p-price50').value     = p.price50ml
  document.getElementById('p-price100').value    = p.price100ml
  document.getElementById('p-image').value       = p.imageUrl || ''
  document.getElementById('p-badge').value       = p.badge || ''
  const catId = categories.find(c => c.name === p.category?.name)?.id || ''
  document.getElementById('p-category').value   = catId
}

productForm.addEventListener('submit', async e => {
  e.preventDefault()
  modalError.style.display = 'none'

  const submitBtn = document.getElementById('modal-submit')
  const id        = document.getElementById('product-id').value

  const payload = {
    name:          document.getElementById('p-name').value.trim(),
    description:   document.getElementById('p-description').value.trim(),
    sku:           document.getElementById('p-sku').value.trim(),
    categoryId:    document.getElementById('p-category').value,
    stockQty:      parseInt(document.getElementById('p-stock').value, 10),
    price50ml:     parseFloat(document.getElementById('p-price50').value),
    price100ml:    parseFloat(document.getElementById('p-price100').value),
    imageUrl:      document.getElementById('p-image').value.trim() || null,
    badge:         document.getElementById('p-badge').value.trim() || '',
  }

  submitBtn.disabled    = true
  submitBtn.textContent = 'Saving…'

  try {
    if (id) {
      const updated = await adminUpdateProduct(id, payload)
      allProducts = allProducts.map(p => p.id === id ? updated : p)
    } else {
      const created = await adminCreateProduct(payload)
      allProducts.unshift(created)
    }
    renderProductsTable(allProducts)
    loadDashboardMetrics()
    closeModal()
  } catch (err) {
    modalError.textContent   = err.message
    modalError.style.display = 'block'
  } finally {
    submitBtn.disabled    = false
    submitBtn.textContent = 'Save Product'
  }
})

// ── Delete product ────────────────────────────────────────────────────────────

async function handleDelete(productId, productName) {
  if (!confirm(`Delete "${productName}"? This cannot be undone.`)) return
  try {
    await adminDeleteProduct(productId)
    allProducts = allProducts.filter(p => p.id !== productId)
    renderProductsTable(allProducts)
    loadDashboardMetrics()
  } catch (err) {
    alert(`Delete failed: ${err.message}`)
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────

let analyticsLoaded = false

async function loadAnalytics() {
  const period = parseInt(document.getElementById('analytics-period')?.value || '30', 10)
  analyticsLoaded = true

  try {
    const data = await adminGetAnalytics(period)

    // Revenue cards
    document.getElementById('an-revenue').textContent = `R${Math.round(data.revenue.total).toLocaleString()}`
    document.getElementById('an-avg').textContent     = `R${Math.round(data.revenue.average).toLocaleString()}`
    document.getElementById('an-month').textContent   = `R${Math.round(data.revenue.thisMonth).toLocaleString()}`

    const growthEl = document.getElementById('an-growth')
    if (data.revenue.growth !== null) {
      const sign = data.revenue.growth >= 0 ? '+' : ''
      growthEl.textContent = `${sign}${data.revenue.growth}%`
      growthEl.style.color = data.revenue.growth >= 0 ? '#27ae60' : '#c0392b'
    } else {
      growthEl.textContent = 'N/A'
      growthEl.style.color = 'var(--color-text-light)'
    }

    // Daily orders bar chart
    renderDailyChart(data.daily)

    // Funnel
    renderFunnel(data.funnel, data.totalOrders)

    // Top products
    renderTopProducts(data.topProducts)

  } catch (err) {
    document.getElementById('an-revenue').textContent = 'Error'
    console.error('[Analytics]', err.message)
  }
}

function renderDailyChart(daily) {
  const el = document.getElementById('daily-chart')
  if (!el || !daily.length) { el.innerHTML = '<div style="color:var(--color-text-light);font-size:0.8rem;padding:40px 0;text-align:center;">No data for this period</div>'; return }

  const maxCount = Math.max(...daily.map(d => d.count), 1)
  el.innerHTML = daily.map(d => {
    const pct     = Math.round((d.count / maxCount) * 100)
    const dateStr = d.date.slice(5)  // MM-DD
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;">
        <div style="font-size:0.6rem;color:var(--color-text-light);white-space:nowrap;">${d.count}</div>
        <div style="width:100%;background:var(--color-gold);border-radius:2px 2px 0 0;height:${Math.max(pct, 4)}%;opacity:0.85;min-height:4px;" title="${d.date}: ${d.count} orders, R${Math.round(d.revenue).toLocaleString()}"></div>
        <div style="font-size:0.55rem;color:var(--color-text-light);transform:rotate(-45deg);transform-origin:top left;white-space:nowrap;overflow:hidden;">${dateStr}</div>
      </div>`
  }).join('')
}

function renderFunnel(funnel, total) {
  const el = document.getElementById('funnel-chart')
  if (!el) return
  const STATUS_ORDER = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
  const sorted = [...funnel].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))

  el.innerHTML = sorted.map(f => {
    const pct = total > 0 ? Math.round((f.count / total) * 100) : 0
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px;">
          <span><span class="badge badge--${f.status}">${f.status}</span></span>
          <span style="color:var(--color-text-light);">${f.count} (${pct}%)</span>
        </div>
        <div style="height:6px;background:var(--color-border);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--color-gold);border-radius:3px;transition:width 0.4s;"></div>
        </div>
      </div>`
  }).join('')
}

function renderTopProducts(products) {
  const tbody = document.getElementById('top-products-body')
  if (!tbody) return
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No sales data yet.</td></tr>'
    return
  }
  tbody.innerHTML = products.map((p, i) => `
    <tr>
      <td style="color:var(--color-gold);font-weight:700;">${i + 1}</td>
      <td>${escHtml(p.name)}</td>
      <td style="font-family:monospace;font-size:0.75rem;">${escHtml(p.sku)}</td>
      <td>${p.totalUnits.toLocaleString()} units</td>
      <td>R${Math.round(p.totalRevenue).toLocaleString()}</td>
    </tr>`).join('')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' })
}
