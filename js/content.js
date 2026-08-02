/**
 * O'luhle Scents — Site Content Hydration
 * Pulls editable marketing copy from GET /api/admin/settings/public and
 * overlays it onto the hardcoded markup via data-content attributes.
 * Fails soft: if the request fails or a key is missing, the hardcoded
 * copy already in the HTML stays exactly as-is.
 */

(function () {
  'use strict';

  async function loadContent() {
    try {
      const res = await fetch('/api/admin/settings/public');
      if (!res.ok) return;
      const c = await res.json();

      document.querySelectorAll('[data-content]').forEach(function (el) {
        const v = c[el.dataset.content];
        if (v == null || v === '') return;
        el.textContent = v;
      });

      document.querySelectorAll('[data-content-html]').forEach(function (el) {
        const v = c[el.dataset.contentHtml];
        if (v) el.innerHTML = v; // server-sanitised fields only
      });

      document.querySelectorAll('[data-content-href]').forEach(function (el) {
        const v = c[el.dataset.contentHref];
        if (v) el.setAttribute('href', v);
      });

      const bar = document.querySelector('.js-announcement-bar');
      if (bar) {
        const active = c.announcement_active === 'true';
        const hasMessage = !!c.announcement_message;
        bar.hidden = !(active && hasMessage);
      }
    } catch (err) {
      console.warn('[content] using static copy', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadContent);
}());
