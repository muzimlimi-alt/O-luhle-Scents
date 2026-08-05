/* ============================================================
   O'luhle Scents — Main JavaScript
   Cart, Filtering, UI Interactions, Multi-Currency
   ============================================================ */

let PRODUCTS = [];
let currentCurrency = localStorage.getItem('oluhle_currency') || 'ZAR';

const CURRENCY_SYMBOLS = {
  'ZAR': 'R',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'AUD': 'A$'
};

function formatPrice(amount) {
  const symbol = CURRENCY_SYMBOLS[currentCurrency] || 'R';
  return `${symbol}${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

async function fetchProducts(params = {}) {
  try {
    params.currency = currentCurrency;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/products${qs ? '?' + qs : ''}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    const data = await res.json();
    return data.products;
  } catch (err) {
    console.error('[fetchProducts] Error:', err);
    return [];
  }
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return await res.json();
  } catch (err) {
    console.error('[fetchCategories] Error:', err);
    return [];
  }
}

// Placeholder image generator
function getPlaceholderImage(name) {
  const initials = (name || 'OS').split(' ').map(w => w[0]).join('').substring(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f2ede7"/><stop offset="100%" stop-color="#e8e0d4"/></linearGradient></defs>
    <rect width="400" height="520" fill="url(#bg)"/>
    <text x="200" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="48" fill="#b89b6a" opacity="0.5">${initials}</text>
    <text x="200" y="290" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#b89b6a" opacity="0.4" letter-spacing="4">EXTRAIT DE PARFUM</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// --- Cart State ---
function getSanitizedCart() {
  try {
    const raw = JSON.parse(localStorage.getItem('oluhle_cart') || '[]');
    return raw.map(item => ({
      id: item.id || item.productId, // Support both legacy and new naming
      variantId: item.variantId,
      name: item.name || 'Unknown Product',
      size: item.size || 'Standard',
      price: Number(item.price) || 0,
      qty: Number(item.qty || item.quantity) || 1, // Fix 'undefined' qty
      image: item.image || '',
      currency: item.currency || 'ZAR'
    }));
  } catch (e) {
    console.error('[Cart] Sanitization failed:', e);
    return [];
  }
}

let cart = getSanitizedCart();

function saveCart() {
  localStorage.setItem('oluhle_cart', JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
  updateCartUI();
}

function addToCart(productId, variantId, qty = 1) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product || !variantId) return;
  
  const variant = product.variants?.find(v => v.id === variantId);
  if (!variant) return;
  
  const existing = cart.find(item => item.variantId === variantId);
  const img = product.primaryImage || '';
  const imagePath = img ? `products/${img}` : '';

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: productId,
      variantId: variantId,
      name: product.name,
      size: variant.size,
      price: Number(variant.price), // This is the converted price from API
      qty: qty,
      image: imagePath,
      currency: currentCurrency
    });
  }
  
  saveCart();
  showToast(`${product.name} (${variant.size}) added to cart`, 'success');
  openCartPanel(); // Open drawer for immediate checkout path
}

function removeFromCartByVariant(variantId) {
  cart = cart.filter(item => item.variantId !== variantId);
  saveCart();
}

function updateCartQtyByVariant(variantId, qty) {
  const item = cart.find(i => i.variantId === variantId);
  if (item) {
    item.qty = Math.max(0, qty);
    if (item.qty === 0) removeFromCartByVariant(variantId);
    else saveCart();
  }
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartUI() {
  const counts = document.querySelectorAll('.cart-count');
  const totalQty = getCartCount();
  
  counts.forEach(el => {
    el.textContent = totalQty;
    el.style.display = totalQty > 0 ? 'flex' : 'none';
    
    // Trigger "bump" animation
    el.classList.remove('bump');
    void el.offsetWidth; // Force reflow
    el.classList.add('bump');
  });

  const panelItems = document.querySelector('.cart-panel__items');
  if (panelItems) {
    if (cart.length === 0) {
      panelItems.innerHTML = `<div class="cart-panel__empty"><p>Your cart is empty</p></div>`;
    } else {
      panelItems.innerHTML = cart.map(item => `
        <div class="cart-panel-item">
          <a href="product-detail.html?id=${item.id}" class="cart-panel-item__link">
            <div class="cart-panel-item__image">
               <img src="images/${item.image}" alt="${item.name}" onerror="this.src='${getPlaceholderImage(item.name)}'">
            </div>
            <div class="cart-panel-item__info">
              <div class="cart-panel-item__name">${item.name}</div>
              <div class="cart-panel-item__variant">${item.size} · Qty: ${item.qty}</div>
              <div class="cart-panel-item__bottom">
                <span class="cart-panel-item__price">${formatPrice(item.price * item.qty)}</span>
              </div>
            </div>
          </a>
          <span class="cart-panel-item__remove" onclick="event.stopPropagation();removeFromCartByVariant('${item.variantId}')">Remove</span>
        </div>
      `).join('');
    }
  }

  const panelTotal = document.querySelector('.cart-panel__total-amount');
  if (panelTotal) panelTotal.textContent = formatPrice(getCartTotal());

  renderCartPage();
}

function renderCartPage() {
  const cartBody = document.querySelector('.cart-table-body');
  if (!cartBody) return;

  if (cart.length === 0) {
    cartBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><h3>Your cart is empty</h3></div></td></tr>`;
    return;
  }

  cartBody.innerHTML = cart.map(item => `
    <tr>
      <td class="cart-table__product">
        <a href="product-detail.html?id=${item.id}" class="cart-table__link">
          <div class="cart-table__image"><img src="images/${item.image}" alt="${item.name}"></div>
          <div class="cart-table__info">
            <div class="cart-table__name">${item.name}</div>
            <div class="cart-table__size">${item.size}</div>
            <div class="cart-item__remove" onclick="event.preventDefault();event.stopPropagation();removeFromCartByVariant('${item.variantId}')">Remove</div>
          </div>
        </a>
      </td>
      <td data-label="Price">${formatPrice(item.price)}</td>
      <td data-label="Quantity">
        <div class="quantity-selector">
          <button class="qty-btn" onclick="event.stopPropagation();updateCartQtyByVariant('${item.variantId}', ${item.qty - 1})">−</button>
          <input type="text" class="qty-input" value="${item.qty}" readonly>
          <button class="qty-btn" onclick="event.stopPropagation();updateCartQtyByVariant('${item.variantId}', ${item.qty + 1})">+</button>
        </div>
      </td>
      <td data-label="Total"><strong>${formatPrice(item.price * item.qty)}</strong></td>
    </tr>
  `).join('');

  const subtotalEl = document.querySelector('.cart-subtotal');
  const totalEl = document.querySelector('.cart-total');
  if (subtotalEl) subtotalEl.textContent = formatPrice(getCartTotal());
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

function renderProducts(containerId, products, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const countEl = document.querySelector('.results-count');
  if (countEl) {
    countEl.textContent = `${products.length} ${products.length === 1 ? 'fragrance' : 'fragrances'}`;
  }

  if (products.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; padding: 100px 0;">
      <h3 style="font-family: var(--font-display); font-size: 1.5rem; color: var(--color-gold); margin-bottom: 20px;">No Scents Found</h3>
      <p style="color: rgba(255,255,255,0.5);">Try adjusting your filters or collection selection.</p>
    </div>`;
    return;
  }

  const items = limit ? products.slice(0, limit) : products;

  container.innerHTML = items.map(product => {
    const variant = product.variants?.[0] || { price: 0, id: null };
    const badgeHtml = product.cardBadge ? `<div style="position: absolute; top: 12px; left: 12px; background: #ffffff; color: #000000; font-size: 0.65rem; font-weight: 700; padding: 4px 10px; text-transform: uppercase; letter-spacing: 1px; z-index: 2; border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${product.cardBadge}</div>` : '';
    const brandType = product.brand ? `${product.brand} · ${product.type || 'Extrait'}` : (product.type || 'Extrait');

    return `
    <div class="product-card reveal">
      ${badgeHtml}
      <div class="product-card__image">
        <a href="product-detail.html?id=${product.id}">
          <img src="images/products/${product.primaryImage}" alt="${product.name}" onerror="this.src='${getPlaceholderImage(product.name)}'">
        </a>
        <div class="product-card__actions">
          <button class="btn btn--sm" onclick="event.preventDefault();addToCart('${product.id}', '${variant.id}')">
            Quick Add
          </button>
        </div>
      </div>
      <div class="product-card__info">
        <p class="product-card__brand" style="font-size: 0.70rem; color: var(--color-gold); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em;">
          ${brandType}
        </p>
        <h4 class="product-card__name"><a href="product-detail.html?id=${product.id}" style="color: inherit; text-decoration: none;">${product.name}</a></h4>
        <div class="product-card__price">From ${formatPrice(variant.price)}</div>
      </div>
    </div>`;
  }).join('');
  initScrollReveal();
}

async function initShopFilters() {
  const filterContainer = document.querySelector('.shop-filters');
  const sortSelect = document.getElementById('sort-select');
  if (!filterContainer && !sortSelect) return;

  // Category buttons are rendered from the live category list — any
  // category an admin adds/removes shows up here without a code change.
  // The "All" button is the one static entry; everything else is generated.
  // Preserves whichever filter was active before the rebuild (this runs
  // again on every currency change) — otherwise a rebuild would silently
  // reset the visitor back to "All".
  if (filterContainer) {
    const previousActive = filterContainer.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const categories = await fetchCategories();
    let allBtn = filterContainer.querySelector('.filter-btn[data-filter="all"]');
    filterContainer.querySelectorAll('.filter-btn:not([data-filter="all"])').forEach(b => b.remove());
    if (!allBtn) {
      allBtn = document.createElement('button');
      allBtn.className = 'filter-btn';
      allBtn.dataset.filter = 'all';
      allBtn.textContent = 'All';
      filterContainer.prepend(allBtn);
    }
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.filter = cat.slug;
      btn.textContent = cat.name;
      filterContainer.appendChild(btn);
    });
    filterContainer.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === previousActive);
    });
    // The category that was active got removed (e.g. deleted by an admin) — fall back to "All".
    if (!filterContainer.querySelector('.filter-btn.active')) allBtn.classList.add('active');
  }

  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length && !sortSelect) return;

  const updateShop = async () => {
    const activeBtn = document.querySelector('.filter-btn.active');
    const category = activeBtn?.dataset.filter || 'all';
    const sort = sortSelect?.value || 'default';

    // 1. Fetch filtered products from API (Applying category on server)
    const params = { category };
    const products = await fetchProducts(params);
    PRODUCTS = products; // Sync global state for Quick Add
    
    // 2. Perform Client-side sorting on the returned set
    let sorted = [...products];
    switch(sort) {
      case 'price-low': 
        sorted.sort((a,b) => (a.variants?.[0]?.price || 0) - (b.variants?.[0]?.price || 0)); 
        break;
      case 'price-high': 
        sorted.sort((a,b) => (b.variants?.[0]?.price || 0) - (a.variants?.[0]?.price || 0)); 
        break;
      case 'name': 
        sorted.sort((a,b) => a.name.localeCompare(b.name)); 
        break;
    }

    renderProducts('shop-products', sorted);
  };

  filterBtns.forEach(btn => {
    btn.onclick = (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateShop();
    };
  });

  if (sortSelect) sortSelect.onchange = updateShop;

  // Initial check for URL params
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat');
  if (cat) {
    const target = Array.from(filterBtns).find(b => b.dataset.filter === cat);
    if (target) {
      filterBtns.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      updateShop();
    }
  }

  // Always trigger an initial load if we are on the shop page
  updateShop();
}

function initScrollReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Toggles `.header.scrolled` once the hero scrolls out from behind the fixed
// nav — this is what flips the navbar from transparent-over-hero to the
// existing ivory/blur surface. No-ops on pages without a `.hero` section
// (or without the [data-hero-nav] opt-in), so it's safe to call from every
// page's DOMContentLoaded. Uses an IntersectionObserver (matching the
// .reveal pattern above) rather than a raw scroll listener: the hero itself
// is observed with the root shrunk by the header's rendered height (which
// already accounts for the announcement bar's push-down), so the callback
// only fires once the hero has actually scrolled out from under the nav —
// not on the first pixel of scroll.
function initHeaderScrollState() {
  const header = document.querySelector('.header[data-hero-nav]');
  const hero = document.querySelector('.hero');
  if (!header || !hero) return;

  const headerBottom = Math.round(header.getBoundingClientRect().bottom) || 72;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      header.classList.toggle('scrolled', !entry.isIntersecting);
    });
  }, { rootMargin: `-${headerBottom}px 0px 0px 0px`, threshold: 0 });

  observer.observe(hero);
}

async function handleCurrencyChange(e) {
  const newCurrency = e.target.value;
  currentCurrency = newCurrency;
  localStorage.setItem('oluhle_currency', newCurrency);
  
  // Reload shop if present
  if (document.getElementById('shop-products')) {
    initShopFilters();
  } else {
    // Reload other globals
    PRODUCTS = await fetchProducts();
    if (document.getElementById('featured-products')) renderProducts('featured-products', PRODUCTS.filter(p => p.status === 'ACTIVE'), 8);
    if (document.querySelector('.product-detail')) window.location.reload(); // Refresh detail page values
  }
  
  updateCartPrices();
}

async function updateCartPrices() {
  updateCartUI();
}

// --- Cart Synchronization & Validation ---
async function validateCartBeforeCheckout() {
  if (cart.length === 0) return false;
  
  const checkoutBtn = document.querySelector('a[href="checkout.html"]');
  if (checkoutBtn) {
    checkoutBtn.textContent = 'Validating...';
    checkoutBtn.style.pointerEvents = 'none';
    checkoutBtn.style.opacity = '0.7';
  }

  try {
    const items = cart.map(i => ({ variantId: i.variantId, quantity: i.qty }));
    const res = await fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, currency: currentCurrency })
    });
    
    if (!res.ok) throw new Error('Validation failed');
    const data = await res.json();
    
    if (!data.valid) {
      // Sync cart with latest valid data
      cart = cart.map(item => {
        const result = data.results.find(r => r.variantId === item.variantId);
        if (!result) return null; // Remove if no longer exists
        if (!result.valid) {
          showToast(`Note: ${item.name} stock has changed.`);
          item.qty = result.availableQuantity;
        }
        item.price = result.price; // Update to latest price
        return item.qty > 0 ? item : null;
      }).filter(Boolean);
      
      saveCart();
      showToast('Cart updated with latest stock & prices.');
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Cart Validation] Error:', err);
    showToast('Could not validate cart. Please try again.');
    return false;
  } finally {
    if (checkoutBtn) {
      checkoutBtn.textContent = 'Checkout';
      checkoutBtn.style.pointerEvents = 'auto';
      checkoutBtn.style.opacity = '1';
    }
  }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  const currencySelect = document.getElementById('js-currency-select');
  if (currencySelect) {
    currencySelect.value = currentCurrency;
    currencySelect.addEventListener('change', handleCurrencyChange);
  }

  initHeaderScrollState();

  // Initial load
  if (document.getElementById('shop-products')) {
    initShopFilters(); // Handle shop specifically
  } else {
    PRODUCTS = await fetchProducts();
    if (document.getElementById('featured-products')) {
      const featured = PRODUCTS.filter(p => p.status === 'ACTIVE').slice(0, 8);
      renderProducts('featured-products', featured);
    }
  }
  
  updateCartUI();
  
  // Checkout Validation Interceptor
  document.querySelectorAll('a[href="checkout.html"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const isValid = await validateCartBeforeCheckout();
      if (isValid) window.location.href = 'checkout.html';
    });
  });

  // Common UI Inits
  document.querySelectorAll('.js-open-cart').forEach(el => el.addEventListener('click', (e) => { e.preventDefault(); openCartPanel(); }));
  document.querySelector('.cart-panel__close')?.addEventListener('click', closeCartPanel);
  document.querySelector('.cart-overlay')?.addEventListener('click', closeCartPanel);
  document.querySelector('.hamburger')?.addEventListener('click', toggleMobileMenu);

  hideLoader();
});

// Global Event Listeners
window.addEventListener('cartUpdated', (e) => {
  console.log('[Cart] State synchronization triggered');
  // Sync local variable with event data or storage
  if (e.detail && e.detail.cart) {
    cart = e.detail.cart;
  } else {
    cart = getSanitizedCart();
  }
  updateCartUI();
});

function hideLoader() { document.querySelector('.page-loader')?.classList.add('hidden'); }
function openCartPanel() { document.querySelector('.cart-panel')?.classList.add('open'); document.querySelector('.cart-overlay')?.classList.add('open'); }
function closeCartPanel() { document.querySelector('.cart-panel')?.classList.remove('open'); document.querySelector('.cart-overlay')?.classList.remove('open'); }
function toggleMobileMenu() { document.querySelector('.mobile-menu')?.classList.toggle('open'); }
// --- Elite Messaging System ---
const EliteMessaging = {
  container: null,
  icons: {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  },

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }

    window.addEventListener('oluhle_message', (e) => {
      const { type, title, message } = e.detail;
      this.show(type, title, message);
    });
  },

  show(type = 'success', title = 'Notification', message = '', duration = 5000) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    toast.innerHTML = `
      <div class="toast__icon">${this.icons[type] || this.icons.info}</div>
      <div class="toast__content">
        <div class="toast__title">${title}</div>
        <div class="toast__message">${message}</div>
      </div>
      <button class="toast__close" aria-label="Dismiss">${this.icons.close}</button>
    `;

    this.container.appendChild(toast);
    
    // Force reflow for animation
    void toast.offsetWidth;
    toast.classList.add('show');

    const removeToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 500);
    };

    const timer = setTimeout(removeToast, duration);

    toast.querySelector('.toast__close').onclick = () => {
      clearTimeout(timer);
      removeToast();
    };
  }
};

// Initialize Elite Messaging
EliteMessaging.init();

function showToast(message, type = 'success') {
  const titles = {
    'success': 'Action Successful',
    'error': 'Interruption',
    'warning': 'Note',
    'info': 'Information'
  };
  EliteMessaging.show(type, titles[type], message);
}
