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
function applyGuard() {
  if (!isAdmin()) {
    const adminWrapper = document.getElementById('admin-wrapper')
    const loginContainer = document.getElementById('login-container')
    if (adminWrapper) adminWrapper.style.display = 'none'
    if (loginContainer) loginContainer.style.display = 'flex'
    
    const loader = document.querySelector('.page-loader')
    if (loader) {
      loader.style.opacity = '0'
      setTimeout(() => loader.style.display = 'none', 500)
    }
  } else {
    const adminWrapper = document.getElementById('admin-wrapper')
    if (adminWrapper) adminWrapper.style.display = 'block'
    const emailEl = document.getElementById('admin-email')
    if (emailEl) emailEl.textContent = getUser()?.email || ''
  }
}

// ── Auth Handlers ─────────────────────────────────────────────────────────────

document.getElementById('admin-login-form')?.addEventListener('submit', async e => {
  e.preventDefault()
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const errorEl = document.getElementById('login-error')
  
  try {
    const data = await login(email, password)
    if (data.user.role !== 'ADMIN') {
      throw new Error('Admin access required.')
    }
    window.location.reload()
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message
      errorEl.style.display = 'block'
    }
  }
})

document.getElementById('logout-btn')?.addEventListener('click', () => {
  logout()
  window.location.reload()
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyGuard)
} else {
  applyGuard()
}

// ── Preferences ───────────────────────────────────────────────────────────────

const PREF_KEY = 'oluhle_admin_prefs'

function defaultPrefs() {
  return { theme: 'dark', defaultSection: 'overview', lowStockThreshold: 5, compactMode: false }
}

function loadPrefs() {
  try { return { ...defaultPrefs(), ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') } }
  catch { return defaultPrefs() }
}

function savePrefs(prefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Update chart grid colours to match theme
  if (salesChart) {
    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
    salesChart.options.scales.y.grid.color = gridColor
    salesChart.update()
  }
}

function applyCompact(compact) {
  document.documentElement.classList.toggle('compact-mode', compact)
}

function initPreferences() {
  const prefs = loadPrefs()
  applyTheme(prefs.theme)
  applyCompact(prefs.compactMode)

  const themeOpts        = document.querySelectorAll('.theme-opt')
  const defaultSectionEl = document.getElementById('pref-default-section')
  const lowStockThreshEl = document.getElementById('pref-low-stock-thresh')
  const compactEl        = document.getElementById('pref-compact')
  const savedMsg         = document.getElementById('prefs-saved')

  // Populate UI with stored prefs
  themeOpts.forEach(opt => opt.classList.toggle('active', opt.dataset.themeVal === prefs.theme))
  if (defaultSectionEl) defaultSectionEl.value = prefs.defaultSection
  if (lowStockThreshEl) lowStockThreshEl.value  = prefs.lowStockThreshold
  if (compactEl)        compactEl.checked        = prefs.compactMode

  // Live theme preview on card click (before Save)
  themeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      themeOpts.forEach(o => o.classList.remove('active'))
      opt.classList.add('active')
      applyTheme(opt.dataset.themeVal)
    })
  })

  function collectAndSave() {
    const newPrefs = {
      theme:             document.querySelector('.theme-opt.active')?.dataset.themeVal || 'dark',
      defaultSection:    defaultSectionEl?.value  || 'overview',
      lowStockThreshold: parseInt(lowStockThreshEl?.value || 5, 10),
      compactMode:       compactEl?.checked || false,
    }
    savePrefs(newPrefs)
    applyTheme(newPrefs.theme)
    applyCompact(newPrefs.compactMode)
    if (savedMsg) {
      savedMsg.textContent = '✓  Preferences saved.'
      savedMsg.style.display = 'flex'
      clearTimeout(savedMsg._t)
      savedMsg._t = setTimeout(() => { savedMsg.style.display = 'none' }, 3000)
    }
    return newPrefs
  }

  document.getElementById('save-prefs-btn')?.addEventListener('click', collectAndSave)

  document.getElementById('reset-prefs-btn')?.addEventListener('click', () => {
    const d = defaultPrefs()
    savePrefs(d)
    applyTheme(d.theme)
    applyCompact(d.compactMode)
    themeOpts.forEach(opt => opt.classList.toggle('active', opt.dataset.themeVal === d.theme))
    if (defaultSectionEl) defaultSectionEl.value = d.defaultSection
    if (lowStockThreshEl) lowStockThreshEl.value  = d.lowStockThreshold
    if (compactEl)        compactEl.checked        = d.compactMode
    if (savedMsg) {
      savedMsg.textContent = '↺  Reset to defaults.'
      savedMsg.style.display = 'flex'
      clearTimeout(savedMsg._t)
      savedMsg._t = setTimeout(() => { savedMsg.style.display = 'none' }, 3000)
    }
  })
}

// ── Page init ─────────────────────────────────────────────────────────────────

// ── Page init ─────────────────────────────────────────────────────────────────

let allOrders   = []
let allProducts = []
let categories  = []

// State for filtering
let currentFilters = {
  category: 'all',
  search: '',
  sort: 'default',
  priceRanges: [],
  colors: [],
  tags: []
}

// Temporary storage for modal image management
let stagedFiles = []      // New files to upload
let existingImages = []   // Filenames already in DB

async function initAdminPage() {
  console.log('[Admin Init] Starting init sequence...')
  
  function forceHideLoader(reason) {
    const loader = document.querySelector('.page-loader')
    if (loader && loader.style.display !== 'none') {
      loader.style.opacity = '0'
      setTimeout(() => loader.style.display = 'none', 500)
    }
  }

  if (!isAdmin()) {
    applyGuard()
    forceHideLoader('Not authenticated as admin')
    return
  }

  try {
    const user = getUser()
    const emailEl = document.getElementById('admin-email')
    if (emailEl && user) emailEl.textContent = user.email
    initPreferences()
    initProductFilters()
  } catch (err) {
    console.warn('[Admin Init] Non-critical UI setup error:', err)
  }

  // Sidebar navigation
  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'))
      btn.classList.add('active')
      const target = document.getElementById(`section-${btn.dataset.section}`)
      if (target) target.classList.add('active')
      if (btn.dataset.section === 'analytics') loadAnalytics()
    })
  })

  document.getElementById('analytics-period')?.addEventListener('change', loadAnalytics)

  // Spawning background data loaders
  const tasks = [
    { fn: loadOrders, name: 'Orders' },
    { fn: () => loadProducts(), name: 'Products' },
    { fn: loadCategories, name: 'Categories' },
    { fn: loadDashboardMetrics, name: 'Metrics' }
  ].map(async ({ fn, name }) => {
    try {
      await fn()
    } catch (err) {
      console.error(`[Loader] ${name} fatal error:`, err)
      if (err.status === 401) { logout(); window.location.reload() }
    }
  })
  
  forceHideLoader('Initialization sequence reached background loading phase.')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPage)
} else {
  initAdminPage()
}

// ── Product Filtering Logic ───────────────────────────────────────────────────

function initProductFilters() {
  // Category tabs
  document.getElementById('category-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab')
    if (!tab) return
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentFilters.category = tab.dataset.category
    loadProducts()
  })

  // Search with debounce
  let searchTimeout
  document.getElementById('product-search')?.addEventListener('input', e => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      currentFilters.search = e.target.value.trim()
      loadProducts()
    }, 400)
  })

  // Sort
  document.getElementById('product-sort')?.addEventListener('change', e => {
    currentFilters.sort = e.target.value
    loadProducts()
  })

  // Sidebar filters toggle
  const sidebar = document.getElementById('filter-sidebar')
  document.getElementById('toggle-filters')?.addEventListener('click', () => {
    sidebar.classList.toggle('active')
  })

  // Price range checkboxes
  sidebar?.querySelectorAll('input[name="price-range"]').forEach(ck => {
    ck.addEventListener('change', () => {
      const checked = Array.from(sidebar.querySelectorAll('input[name="price-range"]:checked')).map(i => i.value)
      currentFilters.priceRanges = checked
      loadProducts()
    })
  })

  // Color options
  document.getElementById('color-filter-options')?.addEventListener('click', e => {
    const btn = e.target.closest('.color-btn')
    if (!btn) return
    btn.classList.toggle('active')
    const active = Array.from(document.querySelectorAll('.color-btn.active')).map(b => b.dataset.color)
    currentFilters.colors = active
    loadProducts()
  })

  // Tag options
  document.getElementById('tag-filter-options')?.addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn')
    if (!btn) return
    btn.classList.toggle('active')
    const active = Array.from(document.querySelectorAll('.tag-btn.active')).map(b => b.dataset.tag)
    currentFilters.tags = active
    loadProducts()
  })

  // Clear filters
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    currentFilters = { category: 'all', search: '', sort: 'default', priceRanges: [], colors: [], tags: [] }
    document.getElementById('product-search').value = ''
    document.getElementById('product-sort').value = 'default'
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.category === 'all'))
    sidebar?.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false)
    document.querySelectorAll('.color-btn, .tag-btn').forEach(b => b.classList.remove('active'))
    loadProducts()
  })
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadOrders() {
  try {
    allOrders = await adminGetOrders()
    renderOrdersTable(allOrders)
  } catch (err) {
    document.getElementById('orders-body').innerHTML = `<tr><td colspan="7" class="empty-state" style="color:#c0392b;">${err.message}</td></tr>`
  }
}

async function loadProducts() {
  const tbody = document.getElementById('products-body')
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Loading…</td></tr>'

  try {
    const params = {
      category: currentFilters.category,
      search: currentFilters.search,
      sort: currentFilters.sort,
      colors: currentFilters.colors.join(','),
      tags: currentFilters.tags.join(',')
    }

    // Combine price ranges if possible, or handle individually
    // For now we'll just handle the first checked for simplicity
    if (currentFilters.priceRanges.length > 0) {
      const range = currentFilters.priceRanges[0]
      if (range === '200+') { params.minPrice = 200 }
      else {
        const [min, max] = range.split('-')
        params.minPrice = min; params.maxPrice = max
      }
    }

    const { count, products } = await getProducts(params)
    allProducts = products
    renderProductsTable(products)
    
    const countEl = document.getElementById('products-count')
    if (countEl) countEl.textContent = `Showing ${products.length} of ${count} products`
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color:#c0392b;">${err.message}</td></tr>`
  }
}

async function loadCategories() {
  try {
    categories = await getCategories()
    const sel = document.getElementById('p-category')
    if (sel) {
      sel.innerHTML = '<option value="">Select…</option>' +
        categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
    }
  } catch (err) {
    console.error('[loadCategories]', err.message)
  }
}

async function loadDashboardMetrics() {
  try {
    const [metrics, lowStock, sales] = await Promise.all([
      adminGetMetrics(),
      adminGetLowStock(),
      adminGetSales(30)
    ])
    updateEl('stat-revenue', `R${Math.round(metrics.totalRevenue || 0).toLocaleString()}`)
    updateEl('stat-orders', (metrics.totalOrders || 0).toLocaleString())
    updateEl('stat-customers', (metrics.totalCustomers || 0).toLocaleString())
    updateEl('stat-low-stock', lowStock.length)

    const alertPanel = document.getElementById('low-stock-alert')
    const alertList  = document.getElementById('low-stock-list')
    if (lowStock.length > 0) {
      if (alertPanel) alertPanel.style.display = 'block'
      if (alertList) {
        alertList.innerHTML = lowStock.map(p => `
          <div class="alert-item">
            <span><strong>${escHtml(p.name)}</strong></span>
            <span style="font-weight:600;">Stock: ${p.stockQty}</span>
          </div>
        `).join('')
      }
    } else if (alertPanel) alertPanel.style.display = 'none'

    initSalesChart(sales)

    const recent = (allOrders || []).slice(0, 8)
    const tbody = document.getElementById('recent-orders-body')
    if (tbody) {
      tbody.innerHTML = recent.length
        ? recent.map(o => `
            <tr>
              <td style="font-size:0.75rem;font-family:monospace;">${o.id.slice(0, 8)}…</td>
              <td>${escHtml(o.email)}</td>
              <td>R${(o.total || 0).toLocaleString()}</td>
              <td><span class="badge badge--${o.status}">${o.status}</span></td>
              <td>${fmtDate(o.createdAt)}</td>
            </tr>`).join('')
        : '<tr><td colspan="5" class="empty-state">No orders yet.</td></tr>'
    }
  } catch (err) {
    console.error('[Metrics] Failed to load dashboard metrics:', err)
  }
}

function updateEl(id, text) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
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
        y: { beginAtZero: true, grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  })
}

// ── Orders ────────────────────────────────────────────────────────────────────

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

  tbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const orderId = sel.dataset.orderId
      const newStatus = sel.value
      const prev = sel.dataset.current
      try {
        await adminUpdateOrderStatus(orderId, newStatus)
        sel.dataset.current = newStatus
        loadDashboardMetrics()
      } catch (err) {
        alert(`Failed to update status: ${err.message}`)
        sel.value = prev
      }
    })
  })
}

// ── Products ──────────────────────────────────────────────────────────────────

function renderProductsTable(products) {
  const tbody = document.getElementById('products-body')
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No products found.</td></tr>'
    return
  }
  tbody.innerHTML = products.map(p => {
    const thumb = p.primaryImage || (p.images ? JSON.parse(p.images)[0] : '')
    const thumbUrl = thumb ? `/images/products/${thumb}` : '/images/placeholder.jpg'
    
    return `
    <tr>
      <td><img src="${thumbUrl}" class="product-thumb" alt="${escHtml(p.name)}"></td>
      <td style="font-size:0.75rem;font-family:monospace;">${escHtml(p.sku)}</td>
      <td>${escHtml(p.name)}${p.badge ? ` <span class="badge badge--paid">${escHtml(p.badge)}</span>` : ''}</td>
      <td>${escHtml(p.category?.name || '—')}</td>
      <td>R${(p.price || 0).toLocaleString()}</td>
      <td>
        <span style="color:${p.stockQty > 0 ? 'inherit' : '#c0392b'};">${p.stockQty}</span>
      </td>
      <td><span class="badge badge--${p.active ? 'paid' : 'cancelled'}">${p.active ? 'Active' : 'Hidden'}</span></td>
      <td style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn--outline btn--xs" data-edit="${p.id}">Edit</button>
        <button class="btn btn--danger btn--xs" data-delete="${p.id}" data-name="${escHtml(p.name)}"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`
  }).join('')

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
const previewDir  = document.getElementById('p-image-previews')

function openModal(title) {
  modalTitle.textContent = title
  modalError.style.display = 'none'
  modalError.textContent  = ''
  modal.classList.add('open')
  stagedFiles = []
  existingImages = []
  updateImagePreviews()
  document.getElementById('p-audit-info').style.display = 'none'
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
  const p = allProducts.find(x => x.id == productId)
  if (!p) return
  openModal('Edit Product')
  
  document.getElementById('product-id').value    = p.id
  document.getElementById('p-name').value        = p.name
  document.getElementById('p-sku').value         = p.sku
  document.getElementById('p-description').value = p.description
  document.getElementById('p-category').value    = p.categoryId || ''
  document.getElementById('p-stock').value       = p.stockQty
  document.getElementById('p-price').value       = p.price || ''
  document.getElementById('p-price50').value     = p.price50ml || ''
  document.getElementById('p-price100').value    = p.price100ml || ''
  document.getElementById('p-colors').value      = p.colors ? p.colors.replace(/[\[\]"]/g, '') : ''
  document.getElementById('p-tags').value        = p.tags ? p.tags.replace(/[\[\]"]/g, '') : ''
  document.getElementById('p-badge').value       = p.badge || ''
  
  // Images
  if (p.images) {
    try { existingImages = JSON.parse(p.images) } catch { existingImages = [] }
  }
  updateImagePreviews()

  // Audits
  const auditDiv = document.getElementById('p-audit-info')
  const createdEl = document.getElementById('audit-created')
  const updatedEl = document.getElementById('audit-updated')
  if (auditDiv) {
    auditDiv.style.display = 'block'
    createdEl.textContent = `Created by ${p.createdBy || 'Unknown'} on ${fmtDate(p.createdAt)}`
    updatedEl.textContent = p.updatedBy ? `Last updated by ${p.updatedBy} on ${fmtDate(p.updatedAt)}` : ''
  }
}

// Image handling
document.getElementById('p-images')?.addEventListener('change', e => {
  const files = Array.from(e.target.files)
  stagedFiles = [...stagedFiles, ...files]
  updateImagePreviews()
  e.target.value = '' // Reset so same file can be picked again
})

function updateImagePreviews() {
  if (!previewDir) return
  previewDir.innerHTML = ''

  // 1. Render Existing Images
  existingImages.forEach((img, idx) => {
    const item = document.createElement('div')
    item.className = `preview-item ${idx === 0 ? 'is-primary' : ''}`
    item.innerHTML = `
      <img src="/images/products/${img}">
      <button type="button" class="preview-item__remove" onclick="removeExistingImage(${idx})">&times;</button>
    `
    previewDir.appendChild(item)
  })

  // 2. Render Staged Files
  stagedFiles.forEach((file, idx) => {
    const item = document.createElement('div')
    item.className = 'preview-item'
    const reader = new FileReader()
    reader.onload = e => {
      item.innerHTML = `
        <img src="${e.target.result}">
        <button type="button" class="preview-item__remove" onclick="removeStagedFile(${idx})">&times;</button>
      `
    }
    reader.readAsDataURL(file)
    previewDir.appendChild(item)
  })
}

window.removeExistingImage = (idx) => {
  existingImages.splice(idx, 1)
  updateImagePreviews()
}

window.removeStagedFile = (idx) => {
  stagedFiles.splice(idx, 1)
  updateImagePreviews()
}

productForm.addEventListener('submit', async e => {
  e.preventDefault()
  modalError.style.display = 'none'

  const submitBtn = document.getElementById('modal-submit')
  const id        = document.getElementById('product-id').value

  const formData = new FormData()
  formData.append('name', document.getElementById('p-name').value.trim())
  formData.append('sku', document.getElementById('p-sku').value.trim())
  formData.append('description', document.getElementById('p-description').value.trim())
  formData.append('categoryId', document.getElementById('p-category').value)
  formData.append('stockQty', document.getElementById('p-stock').value)
  formData.append('price', document.getElementById('p-price').value)
  formData.append('price50ml', document.getElementById('p-price50').value || 0)
  formData.append('price100ml', document.getElementById('p-price100').value || 0)
  formData.append('badge', document.getElementById('p-badge').value)
  
  // Form list formatting
  const colorsRaw = document.getElementById('p-colors').value.split(',').map(s => s.trim()).filter(Boolean)
  const tagsRaw   = document.getElementById('p-tags').value.split(',').map(s => s.trim()).filter(Boolean)
  formData.append('colors', JSON.stringify(colorsRaw))
  formData.append('tags', JSON.stringify(tagsRaw))

  // Images
  existingImages.forEach(img => formData.append('existingImages', img))
  stagedFiles.forEach(file => formData.append('images', file))

  submitBtn.disabled    = true
  submitBtn.textContent = 'Saving…'

  try {
    if (id) {
      await adminUpdateProduct(id, formData)
    } else {
      await adminCreateProduct(formData)
    }
    loadProducts()
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
  if (!confirm(`Move "${productName}" to trash? It will be hidden from the storefront but preserved in the audit log.`)) return
  try {
    await adminDeleteProduct(productId)
    loadProducts()
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

    renderDailyChart(data.daily)
    renderFunnel(data.funnel, data.totalOrders)
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
