/**
 * O'luhle Scents — Cookie Consent Manager
 *
 * Architecture
 * ────────────
 * • Compact banner  — fixed full-width at viewport bottom; stays visible on scroll;
 *                     only disappears when the user explicitly accepts or declines.
 * • Preferences modal — centred overlay opened by "Customise" or "Manage preferences";
 *                       individual iOS-style toggles per category.
 *
 * Consent is stored in localStorage and respected by analytics.js.
 * window.OluhleConsent exposes .allows(category) for other modules.
 */

(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────────

  const STORAGE_KEY     = 'oluhle_cookie_consent';
  const CONSENT_VERSION = 1;       // bump to re-prompt all users after a policy change
  const SHOW_DELAY_MS   = 1000;    // brief pause before the banner slides up

  const CATEGORIES = [
    {
      id:          'essential',
      label:       'Essential Cookies',
      description: 'Required for core site functions — your shopping cart, secure session, and checkout. Cannot be disabled.',
      locked:      true,
      default:     true,
    },
    {
      id:          'analytics',
      label:       'Analytics Cookies',
      description: 'Help us understand how visitors interact with our site (Google Analytics 4). No personal data is sold.',
      locked:      false,
      default:     true,
    },
    {
      id:          'marketing',
      label:       'Marketing Cookies',
      description: 'Personalise ads and measure campaign effectiveness via Meta Pixel and similar tools.',
      locked:      false,
      default:     true,
    },
    {
      id:          'preferences',
      label:       'Preference Cookies',
      description: 'Remember your size selections and other preferences for a personalised return visit.',
      locked:      false,
      default:     true,
    },
  ];

  // ─── Storage ─────────────────────────────────────────────────────────────────

  function readConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data.v === CONSENT_VERSION ? data : null;
    } catch (_) { return null; }
  }

  function writeConsent(prefs) {
    const record = {
      v:           CONSENT_VERSION,
      essential:   true,
      analytics:   Boolean(prefs.analytics),
      marketing:   Boolean(prefs.marketing),
      preferences: Boolean(prefs.preferences),
      timestamp:   Date.now(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('oluhle:consent', { detail: record }));
    return record;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  window.OluhleConsent = {
    get:          readConsent,
    hasConsented: function ()         { return readConsent() !== null; },
    allows:       function (category) {
      if (category === 'essential') return true;
      const c = readConsent();
      return c ? Boolean(c[category]) : false;
    },
    openManager:  function () { openPrefsModal(); },
  };

  // Wire "Cookie Settings" buttons anywhere on the page
  document.addEventListener('click', function (e) {
    if (e.target.closest('.js-open-cookies')) openPrefsModal();
  });

  // ─── Banner HTML (compact strip only) ────────────────────────────────────────

  const BANNER_HTML = `
<div class="cc-banner" id="cc-banner" role="region" aria-label="Cookie consent" hidden>
  <div class="cc-compact">
    <div class="cc-compact__message">
      <span class="cc-icon" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="30" height="30">
          <circle cx="18" cy="18" r="17" fill="#b89b6a" fill-opacity="0.12" stroke="#b89b6a" stroke-width="1.2"/>
          <circle cx="11" cy="14" r="2.2" fill="#b89b6a"/>
          <circle cx="22" cy="11" r="1.6" fill="#b89b6a" fill-opacity="0.7"/>
          <circle cx="24" cy="22" r="2.4" fill="#b89b6a"/>
          <circle cx="14" cy="23" r="1.4" fill="#b89b6a" fill-opacity="0.6"/>
          <circle cx="19" cy="17" r="1.8" fill="#b89b6a" fill-opacity="0.5"/>
          <path d="M10 10 Q18 6 26 10 Q30 18 26 26 Q18 30 10 26 Q6 18 10 10Z" stroke="#b89b6a" stroke-width="1" stroke-dasharray="3 2" fill="none" opacity="0.35"/>
        </svg>
      </span>
      <div class="cc-compact__text">
        <strong>We use cookies</strong>
        <span>We use cookies to enhance browsing, analyse traffic, and personalise content.
          <button class="cc-text-btn" id="cc-manage-link">Manage preferences</button>
        </span>
      </div>
    </div>
    <div class="cc-compact__actions">
      <button class="cc-btn cc-btn--ghost"   id="cc-decline-all">Decline All</button>
      <button class="cc-btn cc-btn--outline"  id="cc-customise">Customise</button>
      <button class="cc-btn cc-btn--primary"  id="cc-accept-all">Accept All</button>
    </div>
  </div>
</div>`;

  // ─── Preferences modal HTML ───────────────────────────────────────────────────

  function buildToggle(cat) {
    if (cat.locked) {
      return `<span class="cc-toggle cc-toggle--locked" aria-label="Always enabled">
        <span class="cc-toggle__track cc-toggle__track--on">
          <span class="cc-toggle__thumb"></span>
        </span>
        <span class="cc-toggle__always">Always on</span>
      </span>`;
    }
    return `<label class="cc-toggle" for="cc-${cat.id}" aria-label="Toggle ${cat.label}">
      <input class="cc-toggle__input" type="checkbox" id="cc-${cat.id}" ${cat.default ? 'checked' : ''}>
      <span class="cc-toggle__track"><span class="cc-toggle__thumb"></span></span>
    </label>`;
  }

  function buildCategoryRows() {
    return CATEGORIES.map(cat => `
      <div class="cc-category">
        <div class="cc-category__info">
          <strong>${cat.label}</strong>
          <p>${cat.description}</p>
        </div>
        ${buildToggle(cat)}
      </div>`).join('');
  }

  const PREFS_MODAL_HTML = `
<div class="cc-prefs-overlay" id="cc-prefs-overlay" role="dialog" aria-modal="true" aria-labelledby="cc-prefs-title" hidden>
  <div class="cc-prefs-modal">

    <div class="cc-prefs-modal__header">
      <div>
        <span class="cc-prefs-modal__title" id="cc-prefs-title">Cookie Preferences</span>
        <p class="cc-prefs-modal__sub">Choose which cookies you allow. Your choice is saved for 12 months and can be changed at any time via "Cookie Settings" in the footer.</p>
      </div>
      <button class="cc-prefs-modal__close" id="cc-prefs-close" aria-label="Close cookie preferences">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="cc-prefs-modal__body">
      <div class="cc-categories">${buildCategoryRows()}</div>
    </div>

    <div class="cc-prefs-modal__footer">
      <button class="cc-btn cc-btn--ghost"   id="cc-prefs-decline">Decline All</button>
      <button class="cc-btn cc-btn--outline"  id="cc-prefs-save">Save my choices</button>
      <button class="cc-btn cc-btn--primary"  id="cc-prefs-accept">Accept All</button>
    </div>

  </div>
</div>`;

  // ─── Toggle helpers ───────────────────────────────────────────────────────────

  function readToggles() {
    const prefs = { essential: true };
    CATEGORIES.filter(c => !c.locked).forEach(cat => {
      const el = document.getElementById('cc-' + cat.id);
      prefs[cat.id] = el ? el.checked : cat.default;
    });
    return prefs;
  }

  function setAllToggles(value) {
    CATEGORIES.filter(c => !c.locked).forEach(cat => {
      const el = document.getElementById('cc-' + cat.id);
      if (el) el.checked = value;
    });
  }

  function syncTogglesToStored() {
    const stored = readConsent();
    if (!stored) { setAllToggles(true); return; }
    CATEGORIES.filter(c => !c.locked).forEach(cat => {
      const el = document.getElementById('cc-' + cat.id);
      if (el) el.checked = Boolean(stored[cat.id]);
    });
  }

  // ─── Banner show/hide ─────────────────────────────────────────────────────────

  function showBanner() {
    const banner = document.getElementById('cc-banner');
    if (!banner) return;
    banner.hidden = false;
    document.body.classList.add('has-cookie-banner');
  }

  function hideBanner() {
    const banner = document.getElementById('cc-banner');
    if (!banner) return;
    banner.classList.add('cc-banner--hiding');
    setTimeout(function () {
      banner.hidden = true;
      banner.classList.remove('cc-banner--hiding');
      document.body.classList.remove('has-cookie-banner');
    }, 380);
  }

  // ─── Preferences modal show/hide ──────────────────────────────────────────────

  function openPrefsModal() {
    // Inject modal on first use
    if (!document.getElementById('cc-prefs-overlay')) {
      const frag = document.createRange().createContextualFragment(PREFS_MODAL_HTML);
      document.body.appendChild(frag);
      wireModalEvents();
    }
    syncTogglesToStored();
    document.getElementById('cc-prefs-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePrefsModal() {
    const overlay = document.getElementById('cc-prefs-overlay');
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  function wireModalEvents() {
    const overlay = document.getElementById('cc-prefs-overlay');

    // Close button
    document.getElementById('cc-prefs-close').addEventListener('click', closePrefsModal);

    // Backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePrefsModal();
    });

    // Decline All
    document.getElementById('cc-prefs-decline').addEventListener('click', function () {
      setAllToggles(false);
      writeConsent({ analytics: false, marketing: false, preferences: false });
      closePrefsModal();
      hideBanner();
    });

    // Save choices
    document.getElementById('cc-prefs-save').addEventListener('click', function () {
      writeConsent(readToggles());
      closePrefsModal();
      hideBanner();
    });

    // Accept All
    document.getElementById('cc-prefs-accept').addEventListener('click', function () {
      setAllToggles(true);
      writeConsent({ analytics: true, marketing: true, preferences: true });
      closePrefsModal();
      hideBanner();
    });
  }

  // ─── Banner events ────────────────────────────────────────────────────────────

  function wireBannerEvents() {
    // Accept All
    document.getElementById('cc-accept-all').addEventListener('click', function () {
      writeConsent({ analytics: true, marketing: true, preferences: true });
      hideBanner();
    });

    // Decline All
    document.getElementById('cc-decline-all').addEventListener('click', function () {
      writeConsent({ analytics: false, marketing: false, preferences: false });
      hideBanner();
    });

    // Open prefs modal via Customise button or inline text link
    function openFromBanner() { openPrefsModal(); }
    document.getElementById('cc-customise').addEventListener('click', openFromBanner);
    document.getElementById('cc-manage-link').addEventListener('click', openFromBanner);

    // Escape closes prefs modal (but NOT the banner — it must stay until decided)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const prefsOpen = document.getElementById('cc-prefs-overlay') &&
                          !document.getElementById('cc-prefs-overlay').hidden;
        if (prefsOpen) closePrefsModal();
      }
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    if (/admin\.html/.test(window.location.pathname)) return;
    if (readConsent()) return; // already decided — no banner needed

    // Inject compact banner
    const frag = document.createRange().createContextualFragment(BANNER_HTML);
    document.body.appendChild(frag);
    wireBannerEvents();

    // Show after a short delay so the page renders first
    setTimeout(showBanner, SHOW_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
