/**
 * O'luhle Scents — Contact Form Handler
 * Connects the homepage contact form to POST /api/contact/send
 */
(function () {
  'use strict';

  const ICONS = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function init() {
    const form      = document.getElementById('contact-form');
    if (!form) return; // guard — not on this page

    const nameInput    = document.getElementById('contact-name');
    const emailInput   = document.getElementById('contact-email');
    const phoneInput   = document.getElementById('contact-phone');
    const subjectInput = document.getElementById('contact-subject');
    const messageInput = document.getElementById('contact-message');
    const consentInput = document.getElementById('contact-consent');
    const submitBtn    = document.getElementById('contact-submit');
    const submitText   = submitBtn.querySelector('.contact-form__submit-text');
    const submitSpinner= submitBtn.querySelector('.contact-form__spinner');
    const feedback     = document.getElementById('contact-feedback');

    function showFeedback(type, message) {
      feedback.className = 'newsletter__feedback newsletter__feedback--' + type;
      feedback.innerHTML = ICONS[type] + '<span>' + message + '</span>';
      feedback.hidden = false;
      feedback.style.animation = 'none';
      void feedback.offsetHeight;
      feedback.style.animation = '';
    }

    function setLoading(loading) {
      submitBtn.disabled = loading;
      submitText.textContent = loading ? 'Sending…' : 'Send Message';
      submitSpinner.hidden = !loading;
    }

    async function handleSubmit(e) {
      e.preventDefault();

      const name    = nameInput.value.trim();
      const email   = emailInput.value.trim();
      const phone   = phoneInput.value.trim();
      const subject = subjectInput.value.trim();
      const message = messageInput.value.trim();

      if (!name) {
        showFeedback('error', 'Please enter your full name.');
        nameInput.focus();
        return;
      }
      if (!email || !isValidEmail(email)) {
        showFeedback('error', "That doesn't look like a valid email address. Please double-check and try again.");
        emailInput.focus();
        return;
      }
      if (!message || message.length < 10) {
        showFeedback('error', 'Please enter a message of at least 10 characters.');
        messageInput.focus();
        return;
      }
      if (!consentInput.checked) {
        showFeedback('error', 'Please agree to the privacy policy before sending your message.');
        consentInput.focus();
        return;
      }

      setLoading(true);
      feedback.hidden = true;

      try {
        const response = await fetch('/api/contact/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, subject, message }),
        });

        const data = await response.json();
        const type = data.type || (response.ok ? 'success' : 'error');

        showFeedback(type, data.message || 'Something went wrong. Please try again.');

        if (response.ok) {
          form.reset();
        }
      } catch (err) {
        console.error('[Contact] Request failed:', err);
        showFeedback('error', 'Unable to connect to our server. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    form.addEventListener('submit', handleSubmit);

    [nameInput, emailInput, phoneInput, subjectInput, messageInput].forEach(function (field) {
      field.addEventListener('input', function () {
        if (!feedback.hidden) {
          feedback.hidden = true;
          feedback.className = 'newsletter__feedback';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
