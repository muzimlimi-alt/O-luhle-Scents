/**
 * TOCA — Testimonials Spotlight & Submission Form
 * Loads approved testimonials from GET /api/testimonials and powers the
 * "Share Your Experience" form (POST /api/testimonials).
 */
import { apiFetch } from './api.js';

const ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
};

const state = { items: [], activeIndex: 0, timer: null };
const AUTOPLAY_MS = 5000;
const TRANSITION_MS = 320;
const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function monogram(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

function renderActive() {
  const item = state.items[state.activeIndex];
  if (!item) return;
  document.getElementById('testimonialsQuote').textContent = item.quote;
  document.getElementById('testimonialsName').textContent = item.name;
  document.getElementById('testimonialsRole').textContent = item.designation || '';
  const imageEl = document.getElementById('testimonialsImage');
  imageEl.innerHTML = item.imagePath
    ? `<img src="${item.imagePath}" alt="${item.name}">`
    : `<div class="testimonials-spotlight__monogram">${monogram(item.name)}</div>`;

  document.querySelectorAll('.testimonials-spotlight__dot').forEach((dot, i) => {
    const active = i === state.activeIndex;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-selected', String(active));
  });
}

function goTo(index, animate = true) {
  const n = state.items.length;
  if (!n) return;
  state.activeIndex = ((index % n) + n) % n;

  const frame = document.getElementById('testimonialsFrame');
  if (!animate || !frame || prefersReducedMotion) { renderActive(); return; }

  frame.classList.add('testimonials-spotlight__frame--hidden');
  setTimeout(() => {
    renderActive();
    frame.classList.remove('testimonials-spotlight__frame--hidden');
  }, TRANSITION_MS);
}

function renderDots() {
  const dotsWrap = document.getElementById('testimonialsDots');
  if (!dotsWrap) return;
  dotsWrap.innerHTML = state.items.map((_, i) =>
    `<button type="button" class="testimonials-spotlight__dot" role="tab" aria-label="Go to testimonial ${i + 1}" data-index="${i}"></button>`
  ).join('');
  dotsWrap.querySelectorAll('.testimonials-spotlight__dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      goTo(Number(dot.dataset.index));
      resetAutoplay();
    });
  });
}

function resetAutoplay() {
  clearInterval(state.timer);
  if (state.items.length > 1) {
    state.timer = setInterval(() => goTo(state.activeIndex + 1), AUTOPLAY_MS);
  }
}

async function loadTestimonials() {
  const wrap = document.getElementById('testimonialsSpotlight');
  if (!wrap) return; // guard — not on this page

  try {
    state.items = await apiFetch('/api/testimonials');
  } catch (err) {
    console.error('Failed to load testimonials:', err);
    state.items = [];
  }

  if (!state.items.length) { wrap.style.display = 'none'; return; }

  wrap.style.display = '';
  const prevBtn = document.getElementById('testimonialsPrev');
  const nextBtn = document.getElementById('testimonialsNext');
  const dotsWrap = document.getElementById('testimonialsDots');
  const hasMultiple = state.items.length > 1;
  prevBtn.style.display = hasMultiple ? '' : 'none';
  nextBtn.style.display = hasMultiple ? '' : 'none';
  dotsWrap.style.display = hasMultiple ? '' : 'none';
  renderDots();
  goTo(0, false);
  resetAutoplay();
}

document.getElementById('testimonialsPrev')?.addEventListener('click', () => { goTo(state.activeIndex - 1); resetAutoplay(); });
document.getElementById('testimonialsNext')?.addEventListener('click', () => { goTo(state.activeIndex + 1); resetAutoplay(); });

// Pause the auto-slide while a visitor is reading/interacting with it
const spotlightEl = document.getElementById('testimonialsSpotlight');
spotlightEl?.addEventListener('mouseenter', () => clearInterval(state.timer));
spotlightEl?.addEventListener('mouseleave', () => resetAutoplay());

// ── Submission modal ─────────────────────────────────────────────────────
const testimonialOverlay = document.querySelector('.js-testimonial-overlay');
let closeTestimonialModal = () => {};

if (testimonialOverlay) {
  const closeBtn = testimonialOverlay.querySelector('.js-testimonial-close');
  const openBtn = document.getElementById('testimonialsToggleForm');

  const openTestimonialModal = () => {
    testimonialOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    // Clear any leftover feedback/errors from a previous visit
    document.querySelectorAll('#testimonialForm .testimonial-form__error').forEach(el => el.textContent = '');
    const feedback = document.getElementById('testimonialFeedback');
    feedback.hidden = true;
    feedback.className = 'newsletter__feedback';
    document.getElementById('testimonialName')?.focus();
  };

  closeTestimonialModal = () => {
    testimonialOverlay.hidden = true;
    document.body.style.overflow = '';
    openBtn?.focus();
  };

  openBtn?.addEventListener('click', openTestimonialModal);
  closeBtn?.addEventListener('click', closeTestimonialModal);

  // Close via overlay backdrop click
  testimonialOverlay.addEventListener('click', (e) => {
    if (e.target === testimonialOverlay) closeTestimonialModal();
  });

  // Close via Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !testimonialOverlay.hidden) closeTestimonialModal();
  });
}

document.getElementById('testimonialForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  document.querySelectorAll('#testimonialForm .testimonial-form__error').forEach(el => el.textContent = '');

  const name = document.getElementById('testimonialName').value.trim();
  const quote = document.getElementById('testimonialQuote').value.trim();
  const consent = document.getElementById('testimonialConsent').checked;
  const feedback = document.getElementById('testimonialFeedback');

  let firstInvalid = null;
  const invalid = (id, errId, message) => {
    document.getElementById(errId).textContent = message;
    if (!firstInvalid) firstInvalid = document.getElementById(id);
  };
  if (!name) invalid('testimonialName', 'errTestimonialName', 'Please enter your name.');
  if (!quote || quote.length < 10) invalid('testimonialQuote', 'errTestimonialQuote', 'Please share at least a few words about your experience.');
  if (!consent) invalid('testimonialConsent', 'errTestimonialConsent', "Please confirm you're okay with this being shown publicly.");
  if (firstInvalid) { firstInvalid.focus(); return; }

  const btn = document.getElementById('testimonialSubmitBtn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Submitting…';
  feedback.hidden = true;

  try {
    const body = new FormData();
    body.append('name', name);
    body.append('designation', document.getElementById('testimonialDesignation').value.trim());
    body.append('quote', quote);
    const photo = document.getElementById('testimonialPhoto').files[0];
    if (photo) body.append('photo', photo);

    const result = await apiFetch('/api/testimonials', { method: 'POST', body });
    e.target.reset();
    feedback.className = 'newsletter__feedback newsletter__feedback--success';
    feedback.innerHTML = ICONS.success + `<span>${result.message || 'Thank you! Your testimonial has been submitted for review.'}</span>`;
    feedback.hidden = false;
    setTimeout(closeTestimonialModal, 2200);
  } catch (err) {
    feedback.className = 'newsletter__feedback newsletter__feedback--error';
    feedback.innerHTML = ICONS.error + `<span>${err.message || 'Could not submit your testimonial. Please try again later.'}</span>`;
    feedback.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

loadTestimonials();
