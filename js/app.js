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
          </div>
        </a>
      </td>
      <td data-label="Price">${formatPrice(item.price)}</td>
      <td data-label="Quantity">
        <div class="quantity-selector">
          <button onclick="event.stopPropagation();updateCartQtyByVariant('${item.variantId}', ${item.qty - 1})">−</button>
          <input type="text" value="${item.qty}" readonly>
          <button onclick="event.stopPropagation();updateCartQtyByVariant('${item.variantId}', ${item.qty + 1})">+</button>
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

  const items = limit ? products.slice(0, limit) : products;

  container.innerHTML = items.map(product => {
    const variant = product.variants?.[0] || { price: 0, id: null };
    return `
    <div class="product-card reveal">
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
        <h4 class="product-card__name">${product.name}</h4>
        <div class="product-card__price">From ${formatPrice(variant.price)}</div>
      </div>
    </div>`;
  }).join('');
  initScrollReveal();
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

async function handleCurrencyChange(e) {
  const newCurrency = e.target.value;
  currentCurrency = newCurrency;
  localStorage.setItem('oluhle_currency', newCurrency);
  
  // Reload products with new currency
  PRODUCTS = await fetchProducts();
  
  // Update UI
  if (document.getElementById('featured-products')) renderProducts('featured-products', PRODUCTS.filter(p => p.isActive), 8);
  if (document.getElementById('shop-products')) renderProducts('shop-products', PRODUCTS);
  if (document.querySelector('.product-detail')) initProductDetail();
  
  // Note: Cart items stay at their original price or you can update them.
  // Generally, standard is to clear cart or update prices. Let's update if possible.
  updateCartPrices();
}

async function updateCartPrices() {
  // If we wanted to be perfect, we'd loop through cart and re-fetch prices for each variantId
  // For now, let's just clear cart on currency change to avoid arbitrage or keep it.
  // Luxury stores often clear cart or lock currency at start.
  // We'll just refresh UI for now.
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

  PRODUCTS = await fetchProducts();
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

  if (document.getElementById('featured-products')) {
    const featured = PRODUCTS.filter(p => p.isActive).slice(0, 8);
    renderProducts('featured-products', featured);
  }
  if (document.getElementById('shop-products')) renderProducts('shop-products', PRODUCTS);
  
  // Update UI on load
  updateCartUI();
  
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
function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.className = `toast show toast--${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
