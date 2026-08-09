/**
 * TOCA — Newsletter Subscription Handler
 * Connects the homepage form to POST /api/newsletter/subscribe
 */
(function () {
  'use strict';

  // ── SVG Icons ─────────────────────────────────────────────────────────────
  const ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  // ── Simple client-side email validator ────────────────────────────────────
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  // ── Detect API base (works both on localhost and via server) ──────────────
  function getApiBase() {
    // Same-origin: the server serves both the page and the API
    return '';
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  function init() {
    const emailInput = document.getElementById('newsletter-email');
    const btn        = document.getElementById('newsletter-btn');
    const btnText    = btn && btn.querySelector('.newsletter__btn-text');
    const btnSpinner = btn && btn.querySelector('.newsletter__btn-spinner');
    const feedback   = document.getElementById('newsletter-feedback');

    if (!emailInput || !btn || !feedback) return; // guard — not on this page

    // ── Show feedback helper ───────────────────────────────────────────────
    function showFeedback(type, message) {
      // Reset classes
      feedback.className = 'newsletter__feedback newsletter__feedback--' + type;
      feedback.innerHTML = ICONS[type] + '<span>' + message + '</span>';
      feedback.hidden = false;

      // Re-trigger animation by forcing a reflow
      feedback.style.animation = 'none';
      void feedback.offsetHeight; // reflow
      feedback.style.animation = '';
    }

    // ── Set loading state ──────────────────────────────────────────────────
    function setLoading(loading) {
      btn.disabled = loading;
      emailInput.disabled = loading;
      if (loading) {
        btnText.textContent = 'Subscribing…';
        btnSpinner.hidden = false;
      } else {
        btnText.textContent = 'Subscribe';
        btnSpinner.hidden = true;
      }
    }

    // ── Submit handler ─────────────────────────────────────────────────────
    async function handleSubmit(e) {
      e.preventDefault();

      const email = emailInput.value.trim();

      // ── Client-side validation first ────────────────────────────────────
      if (!email) {
        showFeedback('error', 'Please enter your email address.');
        emailInput.focus();
        return;
      }

      if (!isValidEmail(email)) {
        showFeedback('error', 'That doesn\'t look like a valid email address. Please double-check and try again.');
        emailInput.focus();
        return;
      }

      setLoading(true);
      feedback.hidden = true;

      try {
        const response = await fetch(getApiBase() + '/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();
        const type = data.type || (response.ok ? 'success' : 'error');

        showFeedback(type, data.message || 'Something went wrong. Please try again.');

        // Clear the field only on a fresh subscription
        if (response.status === 201) {
          emailInput.value = '';
        }

      } catch (err) {
        console.error('[Newsletter] Request failed:', err);
        showFeedback('error', 'Unable to connect to our server. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    // ── Wire events ────────────────────────────────────────────────────────
    btn.addEventListener('click', handleSubmit);

    // Allow pressing Enter in the input field
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSubmit(e);
    });

    // Clear feedback when user starts typing again
    emailInput.addEventListener('input', function () {
      if (!feedback.hidden) {
        feedback.hidden = true;
        feedback.className = 'newsletter__feedback';
      }
    });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
