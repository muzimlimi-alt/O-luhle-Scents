/* ============================================================
   TOCA — Shared header utilities (every storefront page)
   Search overlay with live suggestions, account link, the
   admin-managed announcement bar and the footer note.
   Self-contained: works with or without js/app.js on the page.
   ============================================================ */
(function () {
  'use strict';

  const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
  const ICON_ACCOUNT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
  const ICON_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function isSignedIn() {
    try { return !!JSON.parse(localStorage.getItem('toca_user') || 'null'); } catch { return false; }
  }

  function priceLabel(product) {
    const prices = (product.variants || []).map((v) => Number(v.price)).filter(Number.isFinite);
    if (!prices.length) return '';
    const min = Math.min(...prices);
    return 'From ' + (typeof window.formatPrice === 'function' ? window.formatPrice(min) : 'R' + Math.round(min).toLocaleString());
  }

  function productImage(product) {
    if (product.primaryImage) return 'images/products/' + encodeURIComponent(product.primaryImage);
    return typeof window.getPlaceholderImage === 'function' ? window.getPlaceholderImage(product.name, product.family) : '';
  }

  // --- Header icons ----------------------------------------------------------
  function injectHeaderIcons() {
    const icons = document.querySelector('.nav-icons');
    if (!icons || icons.querySelector('.js-open-search')) return;
    const cart = icons.querySelector('.js-open-cart, a[href="cart.html"]');
    // Checkout's focused "Secure Checkout" header has no cart link; keep it free of distractions.
    if (!cart) return;

    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'nav-icon nav-icon--button js-open-search';
    search.setAttribute('aria-label', 'Search');
    search.innerHTML = ICON_SEARCH;

    const signedIn = isSignedIn();
    const account = document.createElement('a');
    account.className = 'nav-icon nav-icon--account';
    account.href = signedIn ? 'account.html' : 'account-login.html';
    account.setAttribute('aria-label', signedIn ? 'My account' : 'Sign in');
    account.innerHTML = ICON_ACCOUNT;

    const wishlist = document.createElement('a');
    wishlist.className = 'nav-icon js-wishlist-nav';
    wishlist.href = signedIn ? 'account.html#wishlist' : 'account.html#wishlist';
    wishlist.setAttribute('aria-label', 'My Favourites');
    const savedCount = (() => { try { return parseInt(localStorage.getItem('toca_wishlist_count') || '0', 10) || 0; } catch { return 0; } })();
    wishlist.innerHTML = ICON_HEART + `<span class="nav-icon__badge wishlist-count" style="display:${savedCount > 0 ? '' : 'none'}">${savedCount > 0 ? savedCount : ''}</span>`;

    icons.insertBefore(search, cart || null);
    icons.insertBefore(account, cart || null);
    icons.insertBefore(wishlist, cart || null);

    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu && !mobileMenu.querySelector('.js-mobile-account')) {
      const link = document.createElement('a');
      link.href = account.href;
      link.className = 'js-mobile-account';
      link.textContent = signedIn ? 'My Account' : 'Sign In';
      const cartLink = mobileMenu.querySelector('a[href="cart.html"]');
      mobileMenu.insertBefore(link, cartLink || mobileMenu.querySelector('.mobile-menu__footer'));
    }
  }

  // --- Search overlay --------------------------------------------------------
  let overlay = null;
  let lastFocus = null;
  let searchSeq = 0;
  let searchTimer = null;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="search-overlay__backdrop js-close-search"></div>
      <div class="search-overlay__panel" role="dialog" aria-modal="true" aria-label="Search TOCA">
        <form class="search-overlay__form" action="shop.html" role="search">
          ${ICON_SEARCH}
          <input type="search" name="q" class="search-overlay__input" placeholder="Search perfumes, candles, bath salts or a scent note" autocomplete="off" aria-label="Search products" maxlength="100">
          <button type="button" class="search-overlay__close js-close-search" aria-label="Close search">&times;</button>
        </form>
        <div class="search-overlay__results" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.search-overlay__input');
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => suggest(input.value.trim()), 250);
    });
    overlay.querySelector('form').addEventListener('submit', (e) => {
      const term = input.value.trim();
      if (!term) { e.preventDefault(); return; }
      if (typeof window.tocaShopSearch === 'function') {
        e.preventDefault();
        closeSearch();
        window.tocaShopSearch(term);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('.js-close-search')) closeSearch();
    });
  }

  function openSearch() {
    if (!overlay) buildOverlay();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add('search-open');
    const input = overlay.querySelector('.search-overlay__input');
    const current = new URLSearchParams(window.location.search).get('q');
    if (current && !input.value) input.value = current;
    requestAnimationFrame(() => { overlay.classList.add('is-open'); input.focus(); input.select(); });
    if (input.value.trim()) suggest(input.value.trim());
  }

  function closeSearch() {
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove('is-open');
    overlay.hidden = true;
    document.documentElement.classList.remove('search-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  async function suggest(term) {
    const results = overlay.querySelector('.search-overlay__results');
    const seq = ++searchSeq;
    if (term.length < 2) { results.innerHTML = ''; return; }
    results.classList.add('is-loading');
    let data;
    try {
      const currency = localStorage.getItem('toca_currency') || 'ZAR';
      const res = await fetch('/api/products?' + new URLSearchParams({ search: term, limit: 6, currency }));
      data = res.ok ? await res.json() : { products: [], total: 0 };
    } catch {
      data = { products: [], total: 0 };
    }
    if (seq !== searchSeq) return;
    results.classList.remove('is-loading');
    const products = data.products || [];
    const total = data.total ?? products.length;
    const all = 'shop.html?' + new URLSearchParams({ q: term });

    if (!products.length) {
      results.innerHTML = `<p class="search-overlay__empty">No matches for “${esc(term)}”. Try a scent note such as rose, oud or vanilla.</p>`;
      return;
    }
    results.innerHTML = `
      <ul class="search-overlay__list">
        ${products.map((p) => `
          <li>
            <a class="search-result" href="product-detail.html?id=${encodeURIComponent(p.id)}">
              <img class="search-result__img" src="${esc(productImage(p))}" alt="" loading="lazy">
              <span class="search-result__text">
                <span class="search-result__type">${esc(p.type || '')}</span>
                <span class="search-result__name">${esc(p.name)}</span>
              </span>
              <span class="search-result__price">${esc(priceLabel(p))}</span>
            </a>
          </li>`).join('')}
      </ul>
      <a class="search-overlay__all" href="${all}">View all ${total} ${total === 1 ? 'result' : 'results'}</a>`;
  }

  // --- Announcement bar + footer note ---------------------------------------
  async function hydrateSiteContent() {
    let content;
    try {
      const res = await fetch('/api/admin/settings/public');
      if (!res.ok) return;
      content = await res.json();
    } catch {
      return;
    }

    const header = document.querySelector('.header');
    let bar = document.querySelector('.js-announcement-bar');
    const show = content.announcement_active === 'true' && !!content.announcement_message;
    if (!bar && show && header) {
      bar = document.createElement('div');
      bar.className = 'announcement-bar announcement-bar--fixed js-announcement-bar';
      header.parentNode.insertBefore(bar, header);
    }
    if (bar) {
      if (show) {
        const href = (content.announcement_href || '').trim();
        const safeHref = /^(https?:\/\/|\/|[a-z0-9-]+\.html|#)/i.test(href) ? href : '';
        bar.innerHTML = safeHref
          ? `<a href="${esc(safeHref)}">${esc(content.announcement_message)}</a>`
          : esc(content.announcement_message);
      }
      bar.hidden = !show;
      if (header) header.classList.toggle('has-announcement', show);
    }

    if (content.footer_note) {
      document.querySelectorAll('[data-content="footer_note"]').forEach((el) => { el.textContent = content.footer_note; });
    }
  }

  function updateAccountPrompts() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('toca_user') || 'null'); } catch { user = null; }
    if (!user) return;
    const who = user.name || user.email || 'your account';
    document.querySelectorAll('[data-account-prompt]').forEach((el) => {
      el.innerHTML = `Signed in as ${esc(who)}. <a href="account.html">View your account</a>`;
    });
  }

  function init() {
    injectHeaderIcons();
    updateAccountPrompts();
    hydrateSiteContent();
    document.addEventListener('click', (e) => {
      if (e.target.closest('.js-open-search')) { e.preventDefault(); openSearch(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
