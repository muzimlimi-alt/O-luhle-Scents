/* ============================================================
   TOCA — Main JavaScript
   Cart, Filtering, UI Interactions, Multi-Currency
   ============================================================ */

let PRODUCTS = [];
let currentCurrency = localStorage.getItem('toca_currency') || 'ZAR';

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
    // The API pages at 10 by default; the storefront shows the whole catalogue.
    if (params.limit == null) params.limit = 200;
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
function getPlaceholderImage(name, family) {
  const initials = (name || 'OS').split(' ').map(w => w[0]).join('').substring(0, 2);
  const tagline = family === 'CANDLE' ? 'SCENTED CANDLE'
    : family === 'BATH_SALT' ? 'BATH SALTS'
    : family === 'HOME_FRAGRANCE' ? 'HOME FRAGRANCE'
    : 'EXTRAIT DE PARFUM';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f2ede7"/><stop offset="100%" stop-color="#e8e0d4"/></linearGradient></defs>
    <rect width="400" height="520" fill="url(#bg)"/>
    <text x="200" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="48" fill="#b89b6a" opacity="0.5">${initials}</text>
    <text x="200" y="290" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#b89b6a" opacity="0.4" letter-spacing="4">${tagline}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// --- Cart State ---
function getSanitizedCart() {
  try {
    const raw = JSON.parse(localStorage.getItem('toca_cart') || '[]');
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
  localStorage.setItem('toca_cart', JSON.stringify(cart));
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
      panelItems.innerHTML = `<div class="cart-panel__empty"><p>Your next discovery awaits.</p><a href="shop.html" class="btn btn--outline-dark btn--sm">Explore the collection</a></div>`;
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
    cartBody.innerHTML = `<tr><td colspan="5"><div class="shop-empty"><h3>Your next discovery awaits.</h3><p>Your selection is empty for now.</p><a href="shop.html" class="btn btn--outline-dark btn--sm">Explore the collection</a></div></td></tr>`;
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

// List responses include each size's stock record; a size with no record
// (null) can't be bought. When stock wasn't included at all, assume available.
function isVariantAvailable(v) {
  if (v.inventory === undefined) return true;
  if (!v.inventory) return false;
  return Number(v.inventory.quantity) - Number(v.inventory.reserved || 0) > 0;
}

function variantSizeLabel(v) {
  const volume = Number(v.volume);
  if (volume > 0 && (v.uom === 'ml' || v.uom === 'g')) return `${volume}${v.uom}`;
  return v.size || '';
}

function renderProducts(containerId, products, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<div class="shop-empty">
      <h3>Nothing matches just yet</h3>
      <p>Try widening your price range or choosing a different collection.</p>
      <button type="button" class="btn btn--outline-dark btn--sm js-clear-filters">Clear all filters</button>
    </div>`;
    return;
  }

  const items = limit ? products.slice(0, limit) : products;

  container.innerHTML = items.map(product => {
    const variants = [...(product.variants || [])].sort((a, b) => Number(a.price) - Number(b.price));
    const inStock = variants.filter(isVariantAvailable);
    const soldOut = variants.length > 0 && inStock.length === 0;
    // "From" price is the cheapest size; Quick Add uses the cheapest size in stock.
    const variant = variants[0] || { price: 0, id: null };
    const quickAddVariant = inStock[0];
    const sizes = variants.map(variantSizeLabel).filter(Boolean).join(' · ');
    const badgeHtml = product.cardBadge ? `<div style="position: absolute; top: 12px; left: 12px; background: #ffffff; color: #000000; font-size: 0.65rem; font-weight: 700; padding: 4px 10px; text-transform: uppercase; letter-spacing: 1px; z-index: 2; border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${product.cardBadge}</div>` : '';
    const familyLabel = { CANDLE: 'Scented Candle', BATH_SALT: 'Bath Salts', HOME_FRAGRANCE: 'Home Fragrance', ACCESSORY: 'Accessory', GIFT_SET: 'Gift Set' }[product.family] || 'Extrait de Parfum';
    const brandType = product.type || familyLabel;

    return `
    <div class="product-card reveal${soldOut ? ' product-card--soldout' : ''}">
      ${badgeHtml}
      ${soldOut ? '<span class="product-card__soldout">Sold out</span>' : ''}
      <div class="product-card__image">
        <a href="product-detail.html?id=${product.id}">
          <img src="images/products/${product.primaryImage}" alt="${product.name}" onerror="this.src='${getPlaceholderImage(product.name, product.family)}'">
        </a>
        ${quickAddVariant ? `
        <div class="product-card__actions">
          <button class="btn btn--sm" onclick="event.preventDefault();addToCart('${product.id}', '${quickAddVariant.id}')">
            Quick Add
          </button>
        </div>` : ''}
      </div>
      <div class="product-card__info">
        <p class="product-card__brand" style="font-size: 0.70rem; color: var(--color-gold); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em;">
          ${brandType}
        </p>
        <h4 class="product-card__name"><a href="product-detail.html?id=${product.id}" style="color: inherit; text-decoration: none;">${product.name}</a></h4>
        <div class="product-card__price">From ${formatPrice(variant.price)}</div>
        ${sizes ? `<div class="product-card__sizes">${sizes}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  initScrollReveal();
}

// --- Shop page ---------------------------------------------------------------
// Sidebar filters in the style of a luxury catalogue: collapsible groups of
// tick-boxes (multi-select within a group, AND across groups). The URL is the
// single source of truth, so deep links, the back button and a currency
// switch (which re-runs initShopFilters) all restore the same view.
const SHOP_DEFAULT_TITLE = 'Discover the Art of Scent';
const SHOP_PRICE_LABELS = {
  '0-500': 'Under R500',
  '500-1000': 'R500 – R1,000',
  '1000-2000': 'R1,000 – R2,000',
  '2000-': 'R2,000 and over',
};
let shopState = null;
let shopFacets = null;
let shopRequestSeq = 0;
let shopFacetsSeq = 0;
let shopEventsBound = false;
let shopCategoriesCache = null;
let shopCollectionsCache = null;
const shopCollapsedGroups = new Set();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function emptyShopFilters() {
  return { collection: [], scentFamily: [], price: [], attributes: {} };
}

const splitList = (raw) => (raw || '').split(',').map((v) => v.trim()).filter(Boolean);

function readShopState() {
  const params = new URLSearchParams(window.location.search);
  const state = { cat: params.get('cat') || 'all', sort: params.get('sort') || 'default', q: (params.get('q') || '').trim().slice(0, 100), ...emptyShopFilters() };
  state.collection = splitList(params.get('collection'));
  state.scentFamily = splitList(params.get('scentFamily'));
  state.price = splitList(params.get('price')).filter((id) => SHOP_PRICE_LABELS[id]);
  for (const [key, value] of params.entries()) {
    if (key.startsWith('attr_')) {
      const values = splitList(value);
      if (values.length) state.attributes[key.slice(5)] = values;
    }
  }
  return state;
}

function writeShopState({ push = false } = {}) {
  const s = shopState;
  const params = new URLSearchParams();
  if (s.cat !== 'all') params.set('cat', s.cat);
  if (s.collection.length) params.set('collection', s.collection.join(','));
  if (s.scentFamily.length) params.set('scentFamily', s.scentFamily.join(','));
  for (const [key, values] of Object.entries(s.attributes)) {
    if (values.length) params.set(`attr_${key}`, values.join(','));
  }
  if (s.price.length) params.set('price', s.price.join(','));
  if (s.sort !== 'default') params.set('sort', s.sort);
  if (s.q) params.set('q', s.q);
  const qs = params.toString().replace(/%2C/g, ',');
  const url = `${window.location.pathname}${qs ? '?' + qs : ''}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  history[push ? 'pushState' : 'replaceState'](null, '', url);
}

function activeShopFilterCount() {
  const s = shopState;
  return (s.q ? 1 : 0) + s.collection.length + s.scentFamily.length + s.price.length
    + Object.values(s.attributes).reduce((n, v) => n + v.length, 0);
}

async function getShopCategories() {
  if (!shopCategoriesCache) shopCategoriesCache = await fetchCategories();
  return shopCategoriesCache;
}

async function getShopCollections() {
  if (!shopCollectionsCache) {
    try {
      const res = await fetch('/api/collections');
      shopCollectionsCache = res.ok ? await res.json() : [];
    } catch {
      shopCollectionsCache = [];
    }
  }
  return shopCollectionsCache;
}

// Title, subtitle, breadcrumb and (when exactly one collection with a hero
// image is selected) the banner background follow the current selection.
async function updateShopBanner() {
  const titleEl = document.querySelector('[data-shop-title]');
  const breadcrumbEl = document.querySelector('[data-shop-breadcrumb]');
  const subtitleEl = document.querySelector('[data-shop-subtitle]');
  const banner = document.querySelector('.page-banner');
  if (!titleEl) return;

  let heading = SHOP_DEFAULT_TITLE;
  let description = '';
  let heroImage = null;
  try {
    if (shopState.cat !== 'all') {
      const cat = (await getShopCategories()).find((c) => c.slug === shopState.cat);
      if (cat) {
        heading = cat.name;
        description = cat.description || '';
        if (cat.image) heroImage = `/images/categories/${encodeURIComponent(cat.image)}`;
      }
    }
    if (shopState.collection.length === 1) {
      const col = (await getShopCollections()).find((c) => c.slug === shopState.collection[0]);
      if (col) {
        heading = col.name;
        description = col.description || description;
        if (col.image) heroImage = `/images/collections/${encodeURIComponent(col.image)}`;
      }
    }
    if (shopState.q) {
      const scope = heading === SHOP_DEFAULT_TITLE ? '' : ` in ${heading}`;
      heading = `Results for “${shopState.q}”`;
      description = scope ? `Showing matches${scope}.` : '';
      heroImage = null;
    }
  } catch (err) {
    console.warn('[shop] banner lookup failed', err);
  }

  titleEl.textContent = heading;
  if (breadcrumbEl) breadcrumbEl.textContent = heading === SHOP_DEFAULT_TITLE ? 'Shop' : heading;
  if (subtitleEl) {
    subtitleEl.textContent = description;
    subtitleEl.hidden = !description;
  }
  if (banner) {
    banner.classList.toggle('page-banner--hero', !!heroImage);
    banner.style.backgroundImage = heroImage ? `url('${heroImage}')` : '';
  }
  document.title = heading === SHOP_DEFAULT_TITLE ? 'Shop | TOCA' : `${heading} | TOCA`;
}

function updateShopNav() {
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('shop.html')) return;
    const linkCat = new URLSearchParams(href.split('?')[1] || '').get('cat') || 'all';
    a.classList.toggle('active', linkCat === shopState.cat);
  });
}

// One collapsible group. `type` is "radio" for Category, "checkbox" otherwise.
function facetGroupHtml({ key, label, type, options, selected }) {
  const collapsed = shopCollapsedGroups.has(key);
  const id = `facet-${key.replace(/[^a-z0-9]+/gi, '-')}`;
  return `
    <div class="shop-facet${collapsed ? ' is-collapsed' : ''}" data-group="${escapeHtml(key)}">
      <button type="button" class="shop-facet__head" aria-expanded="${!collapsed}" aria-controls="${id}">
        <span>${escapeHtml(label)}</span><span class="shop-facet__icon" aria-hidden="true"></span>
      </button>
      <ul class="shop-facet__list" id="${id}" role="${type === 'radio' ? 'radiogroup' : 'group'}" aria-label="${escapeHtml(label)}">
        ${options.map((o) => `
          <li>
            <label class="shop-check">
              <input type="${type}" name="${escapeHtml(key)}" value="${escapeHtml(o.value)}" data-facet-key="${escapeHtml(key)}"${selected.includes(o.value) ? ' checked' : ''}>
              <span class="shop-check__box" aria-hidden="true"></span>
              <span class="shop-check__label">${escapeHtml(o.label)}</span>
            </label>
          </li>`).join('')}
      </ul>
    </div>`;
}

function renderShopSidebar() {
  const container = document.querySelector('.shop-facets');
  if (!container || !shopFacets) return;
  const { facets, categories, collectionOrder } = shopFacets;
  const groups = [];

  groups.push({
    key: 'category', label: 'Category', type: 'radio', selected: [shopState.cat],
    options: [{ value: 'all', label: 'All products' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))],
  });

  const collections = [...(facets.collections || [])].sort((a, b) => {
    const ia = collectionOrder.indexOf(a.slug);
    const ib = collectionOrder.indexOf(b.slug);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  if (collections.length > 1) {
    groups.push({ key: 'collection', label: 'Collection', type: 'checkbox', selected: shopState.collection,
      options: collections.map((c) => ({ value: c.slug, label: c.name })) });
  }

  const scents = facets.scentFamilies || [];
  if (scents.length > 1) {
    groups.push({ key: 'scentFamily', label: 'Scent Family', type: 'checkbox', selected: shopState.scentFamily,
      options: scents.map((v) => ({ value: v, label: v })) });
  }

  if (shopState.cat !== 'all') {
    for (const def of (facets.attributes || [])) {
      if (def.values.length < 2) continue;
      groups.push({ key: `attr:${def.key}`, label: def.label, type: 'checkbox', selected: shopState.attributes[def.key] || [],
        options: def.values.map((v) => ({ value: v, label: v })) });
    }
  }

  const buckets = facets.priceBuckets || [];
  if (buckets.length > 1) {
    groups.push({ key: 'price', label: 'Price', type: 'checkbox', selected: shopState.price,
      options: buckets.map((b) => ({ value: b.id, label: SHOP_PRICE_LABELS[b.id] || b.id })) });
  }

  container.innerHTML = groups.map(facetGroupHtml).join('');
}

// Drops selections that don't exist in the current category (stale links,
// or a category switch from the header).
function pruneShopState() {
  const { facets } = shopFacets;
  const keep = (list, allowed) => list.filter((v) => allowed.includes(v));
  shopState.collection = keep(shopState.collection, (facets.collections || []).map((c) => c.slug));
  shopState.scentFamily = keep(shopState.scentFamily, facets.scentFamilies || []);
  shopState.price = keep(shopState.price, (facets.priceBuckets || []).map((b) => b.id));
  const attrs = {};
  if (shopState.cat !== 'all') {
    for (const def of (facets.attributes || [])) {
      const values = keep(shopState.attributes[def.key] || [], def.values);
      if (values.length) attrs[def.key] = values;
    }
  }
  shopState.attributes = attrs;
}

async function loadShopFacets() {
  const seq = ++shopFacetsSeq;
  try {
    const [res, categories, collections] = await Promise.all([
      fetch(`/api/products/facets?${new URLSearchParams({ category: shopState.cat, ...(shopState.q ? { search: shopState.q } : {}) })}`),
      getShopCategories(),
      getShopCollections(),
    ]);
    if (!res.ok) throw new Error('facets fetch failed');
    const facets = await res.json();
    if (seq !== shopFacetsSeq) return false;
    if (!categories.some((c) => c.slug === shopState.cat)) shopState.cat = 'all';
    shopFacets = { facets, categories, collectionOrder: collections.map((c) => c.slug) };
    pruneShopState();
    renderShopSidebar();
    return true;
  } catch (err) {
    console.warn('[shop] facets lookup failed', err);
    return false;
  }
}

function renderActiveFilters() {
  const bar = document.querySelector('.shop-active-filters');
  const s = shopState;
  const chips = [];
  if (shopFacets) {
    const { facets } = shopFacets;
    const colName = (slug) => (facets.collections || []).find((c) => c.slug === slug)?.name || slug;
    if (s.q) chips.push({ key: 'q', value: s.q, label: `“${s.q}”` });
    s.collection.forEach((v) => chips.push({ key: 'collection', value: v, label: colName(v) }));
    s.scentFamily.forEach((v) => chips.push({ key: 'scentFamily', value: v, label: v }));
    for (const [key, values] of Object.entries(s.attributes)) values.forEach((v) => chips.push({ key: `attr:${key}`, value: v, label: v }));
    s.price.forEach((v) => chips.push({ key: 'price', value: v, label: SHOP_PRICE_LABELS[v] || v }));
  }
  const count = chips.length;
  const toggleCount = document.querySelector('.shop-filter-toggle__count');
  if (toggleCount) { toggleCount.textContent = count; toggleCount.hidden = !count; }
  if (!bar) return;
  bar.hidden = !count;
  bar.innerHTML = count ? `${chips.map((c) => `
      <button type="button" class="shop-chip" data-facet-key="${escapeHtml(c.key)}" data-facet-value="${escapeHtml(c.value)}" aria-label="Remove filter ${escapeHtml(c.label)}">
        ${escapeHtml(c.label)}<span aria-hidden="true">&times;</span>
      </button>`).join('')}
      <button type="button" class="shop-chip shop-chip--clear js-clear-filters">Clear all</button>` : '';
}

// Sorts that need sales data or launch dates are ordered by the server.
const SERVER_SORTS = ['bestselling', 'newest'];

function sortShopProducts(products) {
  const minPrice = (p) => {
    const prices = (p.variants || []).map((v) => Number(v.price)).filter(Number.isFinite);
    return prices.length ? Math.min(...prices) : 0;
  };
  const sorted = [...products];
  if (SERVER_SORTS.includes(shopState.sort)) return sorted;
  switch (shopState.sort) {
    case 'price-low': sorted.sort((a, b) => minPrice(a) - minPrice(b)); break;
    case 'price-high': sorted.sort((a, b) => minPrice(b) - minPrice(a)); break;
    case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: {
      // "Featured": hand-picked favourites first, then (on All) category order.
      const rank = shopState.cat === 'all' && shopCategoriesCache
        ? new Map(shopCategoriesCache.map((c, i) => [c.id, i]))
        : null;
      sorted.sort((a, b) =>
        (Number(!!b.isFeatured) - Number(!!a.isFeatured))
        || (a.isFeatured && b.isFeatured ? (a.featuredOrder || 0) - (b.featuredOrder || 0) : 0)
        || (rank ? (rank.get(a.categoryId) ?? 99) - (rank.get(b.categoryId) ?? 99) : 0));
    }
  }
  return sorted;
}

async function refreshShopProducts() {
  const grid = document.getElementById('shop-products');
  if (!grid) return;
  const seq = ++shopRequestSeq;
  grid.classList.add('is-loading');
  renderActiveFilters();

  const s = shopState;
  const params = { category: s.cat };
  if (SERVER_SORTS.includes(s.sort)) params.sort = s.sort;
  if (s.q) params.search = s.q;
  if (s.collection.length) params.collection = s.collection.join(',');
  if (s.scentFamily.length) params.scentFamily = s.scentFamily.join(',');
  if (s.price.length) params.priceRanges = s.price.join(',');
  for (const [key, values] of Object.entries(s.attributes)) {
    if (values.length) params[`attr_${key}`] = values.join(',');
  }

  const products = await fetchProducts(params);
  if (seq !== shopRequestSeq) return; // a newer request superseded this one

  PRODUCTS = products;
  renderProducts('shop-products', sortShopProducts(products));
  grid.classList.remove('is-loading');

  const label = `${products.length} ${products.length === 1 ? 'Product' : 'Products'}`;
  document.querySelectorAll('.results-count').forEach((el) => { el.textContent = label; });
  const apply = document.querySelector('.shop-sidebar__apply');
  if (apply) apply.textContent = `View ${label.toLowerCase()}`;
}

async function renderShop() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = shopState.sort;
  updateShopNav();
  // Facets prune stale selections, so they must settle before products load.
  await loadShopFacets();
  writeShopState();
  await Promise.all([updateShopBanner(), refreshShopProducts()]);
}

async function setShopCategory(slug, { scroll = false } = {}) {
  shopState = { ...shopState, ...emptyShopFilters(), cat: slug };
  writeShopState({ push: true });
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  await renderShop();
}

function toggleShopValue(key, value, on) {
  const s = shopState;
  const apply = (list) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));
  if (key === 'q') {
    s.q = on ? value : '';
    writeShopState();
    renderShop();
    return;
  }
  if (key === 'collection') s.collection = apply(s.collection);
  else if (key === 'scentFamily') s.scentFamily = apply(s.scentFamily);
  else if (key === 'price') s.price = apply(s.price);
  else if (key.startsWith('attr:')) {
    const attrKey = key.slice(5);
    const next = apply(s.attributes[attrKey] || []);
    if (next.length) s.attributes[attrKey] = next; else delete s.attributes[attrKey];
  }
  const input = [...document.querySelectorAll('.shop-facets input[data-facet-key]')]
    .find((i) => i.dataset.facetKey === key && i.value === value);
  if (input) input.checked = on;
  writeShopState();
  if (key === 'collection') updateShopBanner();
  refreshShopProducts();
}

function clearShopFilters() {
  const hadSearch = !!shopState.q;
  shopState = { ...shopState, ...emptyShopFilters(), q: '' };
  if (hadSearch) {
    // Search narrows the facet options too, so they need reloading.
    writeShopState();
    renderShop();
    return;
  }
  document.querySelectorAll('.shop-facets input[type="checkbox"]').forEach((i) => { i.checked = false; });
  writeShopState();
  updateShopBanner();
  refreshShopProducts();
}

function setShopDrawer(open) {
  const sidebar = document.querySelector('.shop-sidebar');
  const overlay = document.querySelector('.shop-sidebar-overlay');
  const toggle = document.querySelector('.shop-filter-toggle');
  if (!sidebar) return;
  sidebar.classList.toggle('is-open', open);
  if (overlay) overlay.hidden = !open;
  if (toggle) toggle.setAttribute('aria-expanded', open);
  document.documentElement.classList.toggle('shop-drawer-open', open);
  if (open) sidebar.querySelector('button, input')?.focus();
  else if (toggle && sidebar.contains(document.activeElement)) toggle.focus();
}

function bindShopEvents() {
  if (shopEventsBound) return;
  shopEventsBound = true;

  const facets = document.querySelector('.shop-facets');
  facets?.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-facet-key]');
    if (!input) return;
    if (input.dataset.facetKey === 'category') setShopCategory(input.value);
    else toggleShopValue(input.dataset.facetKey, input.value, input.checked);
  });
  facets?.addEventListener('click', (e) => {
    const head = e.target.closest('.shop-facet__head');
    if (!head) return;
    const group = head.closest('.shop-facet');
    const collapsed = group.classList.toggle('is-collapsed');
    head.setAttribute('aria-expanded', !collapsed);
    if (collapsed) shopCollapsedGroups.add(group.dataset.group);
    else shopCollapsedGroups.delete(group.dataset.group);
  });

  document.querySelector('.shop-active-filters')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.shop-chip[data-facet-key]');
    if (chip) toggleShopValue(chip.dataset.facetKey, chip.dataset.facetValue, false);
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.js-clear-filters')) clearShopFilters();
    if (e.target.closest('.js-open-filters')) setShopDrawer(true);
    if (e.target.closest('.js-close-filters')) setShopDrawer(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('.shop-sidebar.is-open')) setShopDrawer(false);
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) setShopDrawer(false); });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    shopState.sort = e.target.value;
    writeShopState();
    refreshShopProducts();
  });

  // Category links in the header switch in place instead of reloading.
  document.querySelectorAll('.nav-links a[href^="shop.html"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const slug = new URLSearchParams(a.getAttribute('href').split('?')[1] || '').get('cat') || 'all';
      setShopCategory(slug, { scroll: true });
    });
  });

  window.addEventListener('popstate', () => {
    shopState = readShopState();
    renderShop();
  });
}

// Also re-run on currency change; state comes back from the URL.
async function initShopFilters() {
  if (!document.getElementById('shop-products')) return;
  shopState = readShopState();
  bindShopEvents();
  // Lets the header search (js/header.js) search in place on the shop page.
  window.tocaShopSearch = (term) => {
    shopState = { ...shopState, ...emptyShopFilters(), q: term.trim().slice(0, 100) };
    writeShopState({ push: true });
    renderShop();
  };
  await renderShop();
}

// Homepage "Discover Our Favourites": tabs switch between hand-picked/best
// sellers and the newest arrivals, both ordered by the server.
let featuredSeq = 0;
let featuredTabsBound = false;
async function initFeaturedProducts() {
  const grid = document.getElementById('featured-products');
  if (!grid) return;
  const tabs = [...document.querySelectorAll('[data-featured-sort]')];
  const allLink = document.querySelector('.js-featured-all');

  const load = async (sort) => {
    const seq = ++featuredSeq;
    grid.classList.add('is-loading');
    tabs.forEach((t) => {
      const on = t.dataset.featuredSort === sort;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
    });
    if (allLink) allLink.href = sort === 'newest' ? 'shop.html?sort=newest' : 'shop.html';
    const products = await fetchProducts({ sort, limit: 8 });
    if (seq !== featuredSeq) return;
    renderProducts('featured-products', products);
    grid.classList.remove('is-loading');
  };

  if (!featuredTabsBound) {
    featuredTabsBound = true;
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => load(tab.dataset.featuredSort));
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        load(next.dataset.featuredSort);
      });
    });
  }
  const active = tabs.find((t) => t.classList.contains('is-active'));
  await load(active?.dataset.featuredSort || 'favourites');
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
  localStorage.setItem('toca_currency', newCurrency);
  
  // Reload shop if present
  if (document.getElementById('shop-products')) {
    initShopFilters();
  } else {
    // Reload other globals
    PRODUCTS = await fetchProducts();
    initFeaturedProducts();
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
    initShopFilters();
  } else {
    PRODUCTS = await fetchProducts();
    initFeaturedProducts();
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

    window.addEventListener('toca_message', (e) => {
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
