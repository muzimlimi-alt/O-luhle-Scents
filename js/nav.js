/* ============================================================
   TOCA — Shared Navigation (every storefront page)
   Generates the header navbar and mobile menu from one source
   of truth. Replaces the per-page hardcoded nav HTML.

   Pages opt in via <header class="header" data-nav="standard">
   (or just <header class="header"> which defaults to standard).
   Checkout/success pages use data-nav="checkout" or "minimal"
   to keep their focused layouts untouched.

   Runs before header.js (which adds search/account icons into
   the .nav-icons container this script creates) and before
   app.js (which wires the hamburger click handler).
   ============================================================ */
(function () {
  'use strict';

  var CART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';

  var NAV_LINKS = [
    { href: 'index.html', label: 'Home', match: ['index.html', '/'] },
    {
      href: 'shop.html', label: 'Shop', match: ['shop.html'],
      dropdown: [
        { href: 'shop.html', label: 'All Products' },
        { href: 'shop.html?cat=perfume', label: 'Perfumes' },
        { href: 'shop.html?cat=candles', label: 'Scented Candles' },
        { href: 'shop.html?cat=bath-salts', label: 'Bath Salts' },
        { divider: true },
        { href: 'shop.html?sort=favourites', label: 'Favourites' },
        { href: 'shop.html?sort=newest', label: 'New Arrivals' },
      ]
    },
    { href: 'discover.html', label: 'Discover', match: ['discover.html'] },
    { href: 'journal.html', label: 'Journal', match: ['journal.html', 'guide.html'] },
    { href: 'quotes.html', label: 'Professional', match: ['quotes.html'] },
    { href: 'track.html', label: 'Track Order', match: ['track.html'] },
  ];

  var MOBILE_LINKS = [
    { href: 'index.html', label: 'Home' },
    { href: 'shop.html', label: 'Shop All' },
    { href: 'shop.html?cat=perfume', label: 'Perfumes' },
    { href: 'shop.html?cat=candles', label: 'Scented Candles' },
    { href: 'shop.html?cat=bath-salts', label: 'Bath Salts' },
    { href: 'discover.html', label: 'Discover Your Scent' },
    { href: 'journal.html', label: 'Scent Journal' },
    { href: 'guide.html', label: 'Fragrance Guide' },
    { href: 'quotes.html', label: 'Professional' },
    { href: 'track.html', label: 'Track Order' },
    { href: 'cart.html', label: 'Cart' },
  ];

  function currentPage() {
    var p = window.location.pathname;
    var base = p.substring(p.lastIndexOf('/') + 1) || 'index.html';
    return base;
  }

  function isActive(link) {
    var page = currentPage();
    if (link.match) return link.match.some(function (m) { return m === page; });
    return link.href === page;
  }

  function buildDesktopLinks() {
    var page = currentPage();
    return NAV_LINKS.map(function (link) {
      var active = isActive(link) ? ' class="active"' : '';
      if (link.dropdown) {
        var items = link.dropdown.map(function (item) {
          if (item.divider) return '<li class="nav-dropdown__divider"></li>';
          return '<li><a href="' + item.href + '">' + item.label + '</a></li>';
        }).join('');
        return '<div class="nav-dropdown-wrap">' +
          '<a href="' + link.href + '"' + active + '>' + link.label + ' <svg class="nav-dropdown__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M6 9l6 6 6-6"/></svg></a>' +
          '<ul class="nav-dropdown">' + items + '</ul>' +
          '</div>';
      }
      return '<a href="' + link.href + '"' + active + '>' + link.label + '</a>';
    }).join('');
  }

  function buildMobileMenu() {
    var page = currentPage();
    var links = MOBILE_LINKS.map(function (link) {
      var active = link.href === page ? ' class="active"' : '';
      return '<a href="' + link.href + '"' + active + '>' + link.label + '</a>';
    }).join('');

    return '<div class="mobile-menu">' +
      links +
      '<div class="mobile-menu__footer">' +
        '<p style="margin-bottom:8px;">Contact: 076 111 2096</p>' +
        '<p>info@toca.co.za</p>' +
      '</div>' +
    '</div>';
  }

  function buildCurrencySelector() {
    return '<div class="currency-selector" style="margin-right:15px; position:relative;">' +
      '<select id="js-currency-select" class="currency-select" style="background:transparent; color:inherit; border:none; border-bottom:1px solid rgba(184,155,106,0.2); font-family:inherit; font-size:0.85rem; cursor:pointer; padding:2px 5px; outline:none;">' +
        '<option value="ZAR">ZAR (R)</option>' +
        '<option value="USD">USD ($)</option>' +
        '<option value="EUR">EUR (&euro;)</option>' +
        '<option value="GBP">GBP (&pound;)</option>' +
        '<option value="AUD">AUD (A$)</option>' +
      '</select>' +
    '</div>';
  }

  function buildNavbar() {
    return '<nav class="navbar">' +
      '<div class="navbar__left">' +
        '<div class="hamburger" aria-label="Menu"><span></span><span></span><span></span></div>' +
        '<div class="nav-links">' + buildDesktopLinks() + '</div>' +
      '</div>' +
      '<a href="index.html" class="navbar__logo">TOCA</a>' +
      '<div class="navbar__right">' +
        '<div class="nav-icons">' +
          buildCurrencySelector() +
          '<a href="#" class="nav-icon js-open-cart" aria-label="Cart">' +
            CART_SVG +
            '<span class="nav-icon__badge cart-count" style="display:none">0</span>' +
          '</a>' +
        '</div>' +
      '</div>' +
    '</nav>';
  }

  function init() {
    var header = document.querySelector('header.header');
    if (!header) return;

    var navType = (header.getAttribute('data-nav') || 'standard').toLowerCase();
    if (navType === 'checkout' || navType === 'minimal') return;

    // Preserve special attributes
    var isHeroNav = header.hasAttribute('data-hero-nav');

    // Replace header content
    header.innerHTML = buildNavbar();

    // Restore hero-nav attribute (used by index.html for transparent-over-hero behaviour)
    if (isHeroNav) header.setAttribute('data-hero-nav', '');

    // Insert mobile menu after header
    var existing = document.querySelector('.mobile-menu');
    if (existing) existing.remove();
    header.insertAdjacentHTML('afterend', buildMobileMenu());

    // Set saved currency
    try {
      var saved = localStorage.getItem('toca_currency');
      if (saved) {
        var sel = document.getElementById('js-currency-select');
        if (sel) sel.value = saved;
      }
    } catch (e) { /* private browsing */ }
  }

  // Run synchronously if DOM is ready, otherwise on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
