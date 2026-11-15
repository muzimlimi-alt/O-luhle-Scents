/**
 * TOCA — Site Content Hydration
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

  // Collection card photos (collection_1_image_url, etc.) — each card has a
  // real <img class="category-card__photo"> sitting above its gradient
  // .category-card__bg (same layering idea as the hero's img/video over its
  // gradient). Unset/empty => the <img> never gets a src, stays at
  // opacity: 0 (its default CSS state), gradient shows through untouched.
  // A bad/broken URL fails the same way via the 'error' listener, so a
  // mistyped or deleted upload never leaves a blank hole or a broken-image
  // icon on the storefront — it just quietly falls back to the gradient.
  function hydrateCollectionImages(c) {
    for (let i = 1; i <= 3; i++) {
      const url = c['collection_' + i + '_image_url'];
      if (!url) continue;
      const img = document.querySelector('[data-collection-photo="' + i + '"]');
      if (!img) continue;
      img.addEventListener('load', function () { img.classList.add('is-loaded'); });
      img.addEventListener('error', function () { img.removeAttribute('src'); });
      img.src = url;
    }
  }

  // Campaign hero override — when an active campaign (or an admin preview)
  // exists, replace the hero copy, CTA and background image. The hero's
  // default content stays in the HTML so a missing campaign degrades cleanly.
  async function loadCampaign() {
    try {
      // Admin preview: ?campaignPreview=<id> with a valid admin token
      var previewId = new URLSearchParams(window.location.search).get('campaignPreview');
      var url, headers = {};
      if (previewId) {
        var token;
        try { token = localStorage.getItem('toca_admin_token'); } catch (e) { /* private mode */ }
        if (!token) return null; // can't preview without auth
        url = '/api/campaigns/preview/' + encodeURIComponent(previewId);
        headers['Authorization'] = 'Bearer ' + token;
      } else {
        url = '/api/campaigns/active';
      }
      var res = await fetch(url, { headers: headers });
      if (!res.ok) return null;
      var campaign = await res.json();
      if (!campaign) return null;

      // Apply campaign to hero
      var tagline = document.querySelector('.hero__tagline');
      var title = document.querySelector('.hero__title');
      var subtitle = document.querySelector('.hero__subtitle');
      var primaryCta = document.querySelector('.hero__cta .btn--primary');
      var secondaryCta = document.querySelector('.hero__cta .btn--outline');

      if (campaign.eyebrow && tagline) tagline.textContent = campaign.eyebrow;
      if (campaign.heading && title) {
        title.textContent = campaign.heading;
        title.innerHTML = title.textContent; // strip the <em> structure
      }
      if (campaign.subheading && subtitle) subtitle.textContent = campaign.subheading;
      if (campaign.ctaLabel && primaryCta) {
        primaryCta.textContent = campaign.ctaLabel;
        if (campaign.ctaHref) primaryCta.setAttribute('href', campaign.ctaHref);
      }
      // Hide the secondary CTA during a campaign
      if (secondaryCta) secondaryCta.style.display = 'none';

      // Campaign hero image — pick mobile or desktop based on viewport
      var isMobile = window.matchMedia('(max-width: 768px)').matches;
      var imageUrl = (isMobile && campaign.mobileImage) || campaign.desktopImage;
      if (imageUrl) {
        hydrateHeroMedia(imageUrl);
      }

      return campaign;
    } catch (err) {
      console.warn('[content] campaign load failed', err);
      return null;
    }
  }

  async function loadContent() {
    try {
      // Load campaign and settings in parallel
      var campaignPromise = loadCampaign();

      var res = await fetch('/api/admin/settings/public');
      if (!res.ok) return;
      var c = await res.json();

      document.querySelectorAll('[data-content]').forEach(function (el) {
        var v = c[el.dataset.content];
        if (v == null || v === '') return;
        el.textContent = v;
      });

      document.querySelectorAll('[data-content-html]').forEach(function (el) {
        var v = c[el.dataset.contentHtml];
        if (v) el.innerHTML = v; // server-sanitised fields only
      });

      document.querySelectorAll('[data-content-href]').forEach(function (el) {
        var v = c[el.dataset.contentHref];
        if (v) el.setAttribute('href', v);
      });

      // Campaign overrides the hero if one is active — await it after
      // settings so campaign copy wins over data-content defaults.
      var campaign = await campaignPromise;

      // Only apply default hero media if no campaign provided its own
      if (!campaign || (!campaign.desktopImage && !campaign.mobileImage)) {
        hydrateHeroMedia(c.hero_media_url);
      }

      hydrateCollectionImages(c);
      // The announcement bar is handled by js/header.js on every page.
    } catch (err) {
      console.warn('[content] using static copy', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadContent);
}());
