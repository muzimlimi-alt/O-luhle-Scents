/**
 * TOCA — Global Footer Modal
 * Injects the legal/info modal and wires up all interactions.
 * This file is included on every page except admin.html.
 */

(function () {
  'use strict';

  // ── Modal HTML ─────────────────────────────────────────────────────────────
  const MODAL_HTML = `
<div class="legal-overlay js-legal-overlay" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" hidden>
  <div class="legal-modal">
    <button class="legal-modal__close js-legal-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <nav class="legal-modal__nav" role="tablist" aria-label="Information sections">
      <button class="legal-tab active" role="tab" aria-selected="true"  data-tab="social"  id="tab-social">Connect</button>
      <button class="legal-tab"        role="tab" aria-selected="false" data-tab="refund"  id="tab-refund">Refund Policy</button>
      <button class="legal-tab"        role="tab" aria-selected="false" data-tab="privacy" id="tab-privacy">Privacy Policy</button>
      <button class="legal-tab"        role="tab" aria-selected="false" data-tab="terms"   id="tab-terms">Terms of Service</button>
      <button class="legal-tab"        role="tab" aria-selected="false" data-tab="contact" id="tab-contact">Contact</button>
    </nav>

    <div class="legal-modal__body">

      <!-- ── CONNECT ─────────────────────────────────────────────────── -->
      <section class="legal-panel active" id="panel-social" role="tabpanel" aria-labelledby="tab-social">
        <h2 class="legal-panel__title" id="legal-modal-title">Follow Us</h2>
        <p class="legal-panel__lead">Stay in the world of TOCA — new arrivals, stories, and exclusive offers.</p>
        <div class="legal-social">
          <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" class="legal-social__item" aria-label="Instagram">
            <span class="legal-social__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
            </span>
            <span class="legal-social__label">
              <strong>Instagram</strong>
              <small>@toca</small>
            </span>
          </a>
          <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" class="legal-social__item" aria-label="Facebook">
            <span class="legal-social__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
            </span>
            <span class="legal-social__label">
              <strong>Facebook</strong>
              <small>TOCA</small>
            </span>
          </a>
          <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer" class="legal-social__item" aria-label="TikTok">
            <span class="legal-social__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><path d="M9 12a4 4 0 104 4V4a5 5 0 005 5"/></svg>
            </span>
            <span class="legal-social__label">
              <strong>TikTok</strong>
              <small>@toca</small>
            </span>
          </a>
        </div>
      </section>

      <!-- ── REFUND POLICY ────────────────────────────────────────────── -->
      <section class="legal-panel" id="panel-refund" role="tabpanel" aria-labelledby="tab-refund" hidden>
        <h2 class="legal-panel__title">Refund Policy</h2>

        <p>We want you to love your fragrance. If something isn't right, here's how we handle returns.</p>

        <h3>Returns</h3>
        <p>We accept returns within <strong>14 days</strong> of delivery, provided the product is <strong>unopened and in its original, sealed packaging</strong>. Due to the nature of fragrance products, we cannot accept returns on opened or used bottles for hygiene reasons.</p>

        <h3>Exchanges</h3>
        <p>If you received a damaged or incorrect item, we will exchange it at no additional cost. Please contact us within <strong>7 days</strong> of receiving your order with photographic evidence of the issue.</p>

        <h3>How to Return</h3>
        <ol>
          <li>Email us at <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> with your order number and reason for return.</li>
          <li>We will issue a return authorisation and shipping instructions.</li>
          <li>Pack the item securely in its original packaging.</li>
          <li>Return shipping costs are the customer's responsibility, except in cases of our error.</li>
        </ol>

        <h3>Refunds</h3>
        <p>Once your return is received and inspected, we will notify you by email. Approved refunds are processed within <strong>5–10 business days</strong> to your original payment method.</p>

        <p class="legal-note">Gift cards and sale items are final sale and cannot be returned.</p>
      </section>

      <!-- ── PRIVACY POLICY ───────────────────────────────────────────── -->
      <section class="legal-panel" id="panel-privacy" role="tabpanel" aria-labelledby="tab-privacy" hidden>
        <h2 class="legal-panel__title">Privacy Policy</h2>

        <p>TOCA ("we", "us") is committed to protecting your personal information in accordance with the <strong>Protection of Personal Information Act (POPIA)</strong> of South Africa.</p>

        <h3>What We Collect</h3>
        <p>When you place an order or browse our site, we may collect: your name, email address, phone number, delivery address, payment details (processed securely by our payment provider), and browsing behaviour on our site.</p>

        <h3>How We Use Your Information</h3>
        <ul>
          <li>To process and fulfil your orders</li>
          <li>To communicate with you about your order status</li>
          <li>To send you fragrance guides, new arrivals, and exclusive offers (with your consent)</li>
          <li>To improve our website and customer experience</li>
        </ul>

        <h3>Sharing Your Information</h3>
        <p>We do not sell your personal data. We share information only with service providers necessary to operate our business (e.g. payment gateways, courier services), under strict confidentiality agreements.</p>

        <h3>Your Rights</h3>
        <p>You have the right to access, correct, or request deletion of your personal information at any time. Contact us at <a href="mailto:privacy@toca.co.za">privacy@toca.co.za</a>.</p>

        <h3>Cookies</h3>
        <p>We use essential cookies to maintain your shopping cart and session. No third-party tracking cookies are set without your consent.</p>
      </section>

      <!-- ── TERMS OF SERVICE ─────────────────────────────────────────── -->
      <section class="legal-panel" id="panel-terms" role="tabpanel" aria-labelledby="tab-terms" hidden>
        <h2 class="legal-panel__title">Terms of Service</h2>

        <h3>Introduction</h3>
        <p>By using this website and placing orders, you agree to these Terms of Service. TOCA is a South African retailer of premium fragrances ("the Site").</p>

        <h3>Who May Order</h3>
        <p>Orders may be placed by individuals of legal age in their country of residence. By placing an order you confirm that you are authorised to use the payment method provided.</p>

        <h3>Pricing</h3>
        <p>All prices are displayed in South African Rand (ZAR) and include VAT. We reserve the right to correct pricing errors and will notify you before processing your order if a discrepancy is found.</p>

        <h3>Order Confirmation</h3>
        <p>An order is confirmed once payment is successfully processed and you receive a confirmation email. This email constitutes your receipt of purchase.</p>

        <h3>Shipping</h3>
        <p>We ship nationwide across South Africa. Estimated delivery times and shipping fees are shown at checkout. Delivery timelines are estimates and may vary due to courier delays.</p>

        <h3>Payment</h3>
        <p>We accept major credit and debit cards, EFT, and other methods displayed at checkout, processed securely via PayFast.</p>

        <h3>Limitation of Liability</h3>
        <p>To the extent permitted by law, TOCA is not liable for indirect or consequential damages arising from the use of our products or website.</p>

        <h3>Governing Law</h3>
        <p>These terms are governed by the laws of the Republic of South Africa.</p>
      </section>

      <!-- ── CONTACT ──────────────────────────────────────────────────── -->
      <section class="legal-panel" id="panel-contact" role="tabpanel" aria-labelledby="tab-contact" hidden>
        <h2 class="legal-panel__title">Contact Us</h2>
        <p class="legal-panel__lead">We're here to help. Reach us through any of the channels below.</p>

        <div class="legal-contact-grid">
          <div class="legal-contact-item">
            <span class="legal-contact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.89 9.1a19.79 19.79 0 01-3.07-8.67A2 2 0 012.81 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7 7.91a16 16 0 006.06 6.06l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/></svg>
            </span>
            <div>
              <strong>Phone</strong>
              <a href="tel:0761112096">076 111 2096</a>
            </div>
          </div>
          <div class="legal-contact-item">
            <span class="legal-contact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <div>
              <strong>Email</strong>
              <a href="mailto:info@toca.co.za">info@toca.co.za</a>
            </div>
          </div>
          <div class="legal-contact-item">
            <span class="legal-contact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <strong>Location</strong>
              <span>South Africa — Nationwide Shipping</span>
            </div>
          </div>
          <div class="legal-contact-item">
            <span class="legal-contact-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <div>
              <strong>Response Time</strong>
              <span>Within 24 hours on business days</span>
            </div>
          </div>
        </div>

        <p style="margin-top:28px;font-size:0.82rem;color:var(--color-text-light);">For returns and refund queries, please email <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> with your order number.</p>
      </section>

    </div><!-- /.legal-modal__body -->
  </div><!-- /.legal-modal -->
</div><!-- /.legal-overlay -->
`;

  // ── Inject modal into DOM ──────────────────────────────────────────────────
  function init() {
    const frag = document.createRange().createContextualFragment(MODAL_HTML);
    document.body.appendChild(frag);

    const overlay  = document.querySelector('.js-legal-overlay');
    const closeBtn = document.querySelector('.js-legal-close');
    const tabs     = document.querySelectorAll('.legal-tab');
    const panels   = document.querySelectorAll('.legal-panel');

    // Open — any element with js-open-legal triggers the modal. An optional
    // data-legal-tab="privacy" (etc.) opens straight to that panel instead of
    // the default Social tab — used by privacy-notice links on forms that
    // collect personal information (checkout, registration).
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('.js-open-legal');
      if (trigger) {
        e.preventDefault();
        openModal(trigger.dataset.legalTab);
      }
    });

    // Close via button
    closeBtn.addEventListener('click', closeModal);

    // Close via overlay backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Close via Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    // Tab switching
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const target = this.dataset.tab;

        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach(function (p) {
          p.classList.remove('active');
          p.hidden = true;
        });

        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        const panel = document.getElementById('panel-' + target);
        if (panel) { panel.classList.add('active'); panel.hidden = false; }
      });
    });

    function openModal(startTab) {
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';

      const requestedTab = startTab && document.querySelector('.legal-tab[data-tab="' + startTab + '"]');
      if (requestedTab) {
        requestedTab.click();
        requestedTab.focus();
      } else if (tabs.length) {
        // Focus first tab for accessibility
        tabs[0].focus();
      }
    }

    function closeModal() {
      overlay.hidden = true;
      document.body.style.overflow = '';
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
