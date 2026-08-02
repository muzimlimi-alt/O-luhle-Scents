/**
 * O'luhle Scents — Site Content Hydration
 * Pulls editable marketing copy from GET /api/admin/settings/public and
 * overlays it onto the hardcoded markup via data-content attributes.
 * Fails soft: if the request fails or a key is missing, the hardcoded
 * copy already in the HTML stays exactly as-is.
 */

(function () {
  'use strict';

  // Hero background media (hero_media_url) can be a photo or a short video —
  // only one of the two hidden elements ever gets revealed, based on file
  // extension. Never configured => both stay hidden and the CSS gradient
  // fallback on .hero shows through untouched.
  function hydrateHeroMedia(url) {
    if (!url) return;

    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
    const img = document.querySelector('.hero__media-img');
    const video = document.querySelector('.hero__media-video');

    if (isVideo && video) {
      video.src = url;
      video.preload = 'auto';
      video.removeAttribute('hidden');

      // Respect reduced motion: leave the video paused on its first frame
      // (a static "poster") instead of autoplaying the loop.
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        video.play().catch(function () {
          // Autoplay can be blocked despite muted+playsinline in rare cases —
          // the paused first frame is still a perfectly fine static hero.
        });
      }
    } else if (img) {
      img.src = url;
      img.removeAttribute('hidden');
    }
  }

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

      hydrateHeroMedia(c.hero_media_url);

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
