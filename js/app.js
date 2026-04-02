/* ============================================================
   O'luhle Scents — Main JavaScript
   Cart, Filtering, UI Interactions
   ============================================================ */

// --- Product Data (from Official Price List) ---
const PRODUCTS = [
  { id: 1,  name: "Zale",             category: "premium",  price100: 2000, price50: 1100, notes: "A bold, captivating blend of oud and amber",          badge: "Bestseller", image: "products/zale.jpg" },
  { id: 2,  name: "Mika",             category: "premium",  price100: 2000, price50: 1100, notes: "Warm spice meets soft vanilla undertones",             badge: "",           image: "products/mika.jpg" },
  { id: 3,  name: "Koah",             category: "premium",  price100: 2000, price50: 1100, notes: "Deep woody fragrance with smoky leather accents",     badge: "New",        image: "products/koah.jpg" },
  { id: 4,  name: "Yugen",            category: "signature", price100: 1500, price50: 900,  notes: "Mysterious oriental with exotic floral heart",        badge: "",           image: "products/yugen.jpg" },
  { id: 5,  name: "Antiqué",          category: "signature", price100: 1500, price50: 900,  notes: "Timeless elegance with bergamot and sandalwood",      badge: "Popular",    image: "products/antique.jpg" },
  { id: 6,  name: "Edan",             category: "signature", price100: 1500, price50: 900,  notes: "Fresh green notes grounded in earthy vetiver",        badge: "",           image: "products/edan.jpg" },
  { id: 7,  name: "Aurelia",          category: "signature", price100: 1500, price50: 900,  notes: "Golden florals with a luminous musk finish",          badge: "",           image: "products/aurelia.jpg" },
  { id: 8,  name: "Il Piano",         category: "signature", price100: 1500, price50: 900,  notes: "Harmonious blend of lavender, cedar and tonka",       badge: "",           image: "products/ilpiano.jpg" },
  { id: 9,  name: "Satin",            category: "classic",   price100: 1200, price50: 700,  notes: "Silky smooth rose and white musk composition",        badge: "",           image: "products/satin.jpg" },
  { id: 10, name: "Luna",             category: "classic",   price100: 1200, price50: 700,  notes: "Dreamy night jasmine with powdery iris",              badge: "Bestseller", image: "products/luna.jpg" },
  { id: 11, name: "Absolute",         category: "classic",   price100: 1200, price50: 700,  notes: "Refined patchouli with sweet amber warmth",           badge: "",           image: "products/absolute.jpg" },
  { id: 12, name: "Sublime Rose Oud", category: "essentials", price100: 1000, price50: 600,  notes: "Damascena rose layered with rich oud",                badge: "",           image: "products/sublimerose.jpg" },
  { id: 13, name: "Kairos",           category: "essentials", price100: 1000, price50: 600,  notes: "Citrus opening with deep amber base",                badge: "",           image: "products/kairos.jpg" },
  { id: 14, name: "Assassin",         category: "essentials", price100: 1000, price50: 600,  notes: "Dark and seductive with black pepper and oud",        badge: "New",        image: "products/assassin.jpg" },
  { id: 15, name: "Mi Amor",          category: "essentials", price100: 1000, price50: 600,  notes: "Passionate blend of tuberose, vanilla and musk",      badge: "",           image: "products/miamor.jpg" },
  { id: 16, name: "Eminence",         category: "essentials", price100: 1000, price50: 600,  notes: "Distinguished woody aromatic with saffron",           badge: "",           image: "products/eminence.jpg" },
  { id: 17, name: "Chypre Fruity",    category: "essentials", price100: 1000, price50: 600,  notes: "Vibrant fruits over classic oakmoss and bergamot",    badge: "",           image: "products/chyprefruity.jpg" },
];

// Placeholder image generator (SVG data URI with gold gradient)
function getPlaceholderImage(name) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f2ede7"/>
        <stop offset="100%" stop-color="#e8e0d4"/>
      </linearGradient>
    </defs>
    <rect width="400" height="520" fill="url(#bg)"/>
    <text x="200" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="48" fill="#b89b6a" opacity="0.5">${initials}</text>
    <text x="200" y="290" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#b89b6a" opacity="0.4" letter-spacing="4">EXTRAIT DE PARFUM</text>
    <rect x="140" y="245" width="120" height="1" fill="#b89b6a" opacity="0.2"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// --- Cart State ---
let cart = JSON.parse(localStorage.getItem('oluhle_cart') || '[]');

function saveCart() {
  localStorage.setItem('oluhle_cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(productId, size = '100ml') {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  
  const price = size === '100ml' ? product.price100 : product.price50;
  const existing = cart.find(item => item.id === productId && item.size === size);
  
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: productId,
      name: product.name,
      size: size,
      price: price,
      qty: 1,
      image: product.image
    });
  }
  
  saveCart();
  showToast(`${product.name} added to cart`);
}

function removeFromCart(productId, size) {
  cart = cart.filter(item => !(item.id === productId && item.size === size));
  saveCart();
}

function updateCartQty(productId, size, qty) {
  const item = cart.find(i => i.id === productId && i.size === size);
  if (item) {
    item.qty = Math.max(0, qty);
    if (item.qty === 0) {
      removeFromCart(productId, size);
    } else {
      saveCart();
    }
  }
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

// --- Update all cart UI elements ---
function updateCartUI() {
  // Badge counts
  document.querySelectorAll('.cart-count').forEach(el => {
    const count = getCartCount();
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });

  // Cart panel items
  const panelItems = document.querySelector('.cart-panel__items');
  if (panelItems) {
    if (cart.length === 0) {
      panelItems.innerHTML = `
        <div class="cart-panel__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          <p>Your cart is empty</p>
          <a href="shop.html" class="btn btn--outline-dark btn--sm">Shop Now</a>
        </div>`;
    } else {
      panelItems.innerHTML = cart.map(item => `
        <div class="cart-panel-item">
          <div class="cart-panel-item__image">
            <img src="images/${item.image}" alt="${item.name}" onerror="this.src='${getPlaceholderImage(item.name)}'">
          </div>
          <div class="cart-panel-item__info">
            <div class="cart-panel-item__name">${item.name}</div>
            <div class="cart-panel-item__variant">${item.size} · Qty: ${item.qty}</div>
            <div class="cart-panel-item__bottom">
              <span class="cart-panel-item__price">R${(item.price * item.qty).toLocaleString()}</span>
              <span class="cart-panel-item__remove" onclick="removeFromCart(${item.id}, '${item.size}')">Remove</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  // Cart panel total
  const panelTotal = document.querySelector('.cart-panel__total-amount');
  if (panelTotal) {
    panelTotal.textContent = `R${getCartTotal().toLocaleString()}`;
  }

  // Full cart page
  renderCartPage();
}

// --- Render full cart page ---
function renderCartPage() {
  const cartBody = document.querySelector('.cart-table-body');
  if (!cartBody) return;

  if (cart.length === 0) {
    cartBody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            <h3>Your cart is empty</h3>
            <p>Discover our exquisite collection of fragrances</p>
            <a href="shop.html" class="btn btn--primary">Explore Collection</a>
          </div>
        </td>
      </tr>`;
    return;
  }

  cartBody.innerHTML = cart.map(item => `
    <tr>
      <td>
        <div style="display:flex;gap:16px;align-items:center">
          <div class="cart-item__image">
            <img src="images/${item.image}" alt="${item.name}" onerror="this.src='${getPlaceholderImage(item.name)}'">
          </div>
          <div class="cart-item__details">
            <div class="cart-item__name">${item.name}</div>
            <div class="cart-item__variant">${item.size}</div>
            <span class="cart-item__remove" onclick="removeFromCart(${item.id}, '${item.size}')">Remove</span>
          </div>
        </div>
      </td>
      <td data-label="Price">R${item.price.toLocaleString()}</td>
      <td data-label="Quantity">
        <div class="quantity-selector" style="margin:0">
          <button class="qty-btn" onclick="updateCartQty(${item.id}, '${item.size}', ${item.qty - 1})">−</button>
          <input type="text" class="qty-input" value="${item.qty}" readonly>
          <button class="qty-btn" onclick="updateCartQty(${item.id}, '${item.size}', ${item.qty + 1})">+</button>
        </div>
      </td>
      <td data-label="Total"><strong>R${(item.price * item.qty).toLocaleString()}</strong></td>
    </tr>
  `).join('');

  // Update summary
  const subtotalEl = document.querySelector('.cart-subtotal');
  const totalEl = document.querySelector('.cart-total');
  if (subtotalEl) subtotalEl.textContent = `R${getCartTotal().toLocaleString()}`;
  if (totalEl) totalEl.textContent = `R${getCartTotal().toLocaleString()}`;
}

// --- Product Grid Rendering ---
function renderProducts(containerId, products, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const items = limit ? products.slice(0, limit) : products;

  container.innerHTML = items.map(product => `
    <div class="product-card reveal" data-category="${product.category}">
      <a href="product-detail.html?id=${product.id}" class="product-card__image">
        <img src="images/${product.image}" alt="${product.name}" onerror="this.src='${getPlaceholderImage(product.name)}'">
        ${product.badge ? `<span class="product-card__badge">${product.badge}</span>` : ''}
        <div class="product-card__actions">
          <button class="btn" onclick="event.preventDefault();addToCart(${product.id}, '100ml')">Add to Cart</button>
        </div>
      </a>
      <div class="product-card__info">
        <div class="product-card__category">Extrait de Parfum</div>
        <h4 class="product-card__name">${product.name}</h4>
        <div class="product-card__price">
          R${product.price100.toLocaleString()}
          <span class="price-divider">|</span>
          R${product.price50.toLocaleString()}
        </div>
      </div>
    </div>
  `).join('');

  // Trigger reveal animations
  requestAnimationFrame(() => initScrollReveal());
}

// --- Filtering ---
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const productsContainer = document.getElementById('shop-products');
  if (!filterBtns.length || !productsContainer) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      const filtered = filter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === filter);
      renderProducts('shop-products', filtered);

      // Update count
      const countEl = document.querySelector('.results-count');
      if (countEl) countEl.textContent = `${filtered.length} fragrances`;
    });
  });
}

// --- Product Detail Page ---
function initProductDetail() {
  const container = document.querySelector('.product-detail');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get('id')) || 1;
  const product = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];

  document.title = `${product.name} — O'luhle Scents`;

  // Fill in product details
  const nameEl = container.querySelector('.product-info__name');
  const priceEl = container.querySelector('.product-info__price');
  const descEl = container.querySelector('.product-info__desc');
  const imgEl = container.querySelector('.product-gallery__main img');
  const breadcrumbName = container.querySelector('.product-breadcrumb-name');

  if (nameEl) nameEl.textContent = product.name;
  if (priceEl) priceEl.innerHTML = `R${product.price100.toLocaleString()} <span style="font-size:0.85em;color:var(--color-text-light);">/ 100ml</span>`;
  if (descEl) descEl.textContent = product.notes + '. This luxurious extrait de parfum is crafted with the finest ingredients, offering exceptional longevity and sillage that will leave a lasting impression.';
  if (imgEl) {
    imgEl.src = `images/${product.image}`;
    imgEl.onerror = function() { this.src = getPlaceholderImage(product.name); };
  }
  if (breadcrumbName) breadcrumbName.textContent = product.name;

  // Size selection
  let selectedSize = '100ml';
  const sizeButtons = container.querySelectorAll('.size-option');
  sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
      const price = selectedSize === '100ml' ? product.price100 : product.price50;
      if (priceEl) priceEl.innerHTML = `R${price.toLocaleString()} <span style="font-size:0.85em;color:var(--color-text-light);">/ ${selectedSize}</span>`;
    });
  });

  // Quantity
  let qty = 1;
  const qtyInput = container.querySelector('.qty-input');
  container.querySelector('.qty-down')?.addEventListener('click', () => {
    if (qty > 1) { qty--; qtyInput.value = qty; }
  });
  container.querySelector('.qty-up')?.addEventListener('click', () => {
    qty++; qtyInput.value = qty;
  });

  // Add to cart
  container.querySelector('.btn-add-cart')?.addEventListener('click', () => {
    for (let i = 0; i < qty; i++) {
      addToCart(product.id, selectedSize);
    }
  });

  // Related products
  const related = PRODUCTS.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);
  if (related.length < 4) {
    const extra = PRODUCTS.filter(p => p.id !== product.id && p.category !== product.category).slice(0, 4 - related.length);
    related.push(...extra);
  }
  renderProducts('related-products', related, 4);
}

// --- Toast Notification ---
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span class="toast__message"></span>`;
    document.body.appendChild(toast);
  }

  toast.querySelector('.toast__message').textContent = message;
  toast.classList.add('show');

  setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- Cart Panel Toggle ---
function openCartPanel() {
  document.querySelector('.cart-panel')?.classList.add('open');
  document.querySelector('.cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCartPanel() {
  document.querySelector('.cart-panel')?.classList.remove('open');
  document.querySelector('.cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// --- Mobile Menu ---
function toggleMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  hamburger?.classList.toggle('active');
  mobileMenu?.classList.toggle('open');
  document.body.style.overflow = mobileMenu?.classList.contains('open') ? 'hidden' : '';
}

// --- Scroll Reveal ---
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal:not(.visible)');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => observer.observe(el));
}

// --- Header Scroll Effect ---
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const announcementBar = document.querySelector('.announcement-bar');
  if (announcementBar) {
    header.classList.add('has-announcement');
  }

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      header.classList.add('scrolled');
      if (announcementBar) {
        header.style.top = '0';
        announcementBar.style.transform = 'translateY(-100%)';
      }
    } else {
      header.classList.remove('scrolled');
      if (announcementBar) {
        header.style.top = '34px';
        announcementBar.style.transform = 'translateY(0)';
      }
    }
  });
}

// --- Back to Top ---
function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// --- Hero Particles ---
function initHeroParticles() {
  const container = document.querySelector('.hero__particles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'hero__particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${50 + Math.random() * 50}%`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particle.style.animationDuration = `${6 + Math.random() * 6}s`;
    container.appendChild(particle);
  }
}

// --- Page Loader ---
function hideLoader() {
  const loader = document.querySelector('.page-loader');
  if (loader) {
    setTimeout(() => loader.classList.add('hidden'), 300);
  }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  hideLoader();
  initHeader();
  initBackToTop();
  initScrollReveal();
  initHeroParticles();
  updateCartUI();

  // Cart panel events
  document.querySelectorAll('.js-open-cart').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); openCartPanel(); });
  });
  document.querySelector('.cart-panel__close')?.addEventListener('click', closeCartPanel);
  document.querySelector('.cart-overlay')?.addEventListener('click', closeCartPanel);

  // Mobile menu
  document.querySelector('.hamburger')?.addEventListener('click', toggleMobileMenu);

  // Page-specific init
  if (document.getElementById('featured-products')) {
    renderProducts('featured-products', PRODUCTS.filter(p => p.badge), 8);
  }
  if (document.getElementById('shop-products')) {
    renderProducts('shop-products', PRODUCTS);
    initFilters();
  }
  if (document.querySelector('.product-detail')) {
    initProductDetail();
  }
  if (document.querySelector('.cart-table-body')) {
    renderCartPage();
  }
});
