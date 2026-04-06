
import os

css_block = """
.legal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 22, 18, 0.72);
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: legalFadeIn 0.22s ease;
}

.legal-overlay[hidden] { display: none; }

@keyframes legalFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.legal-modal {
  background: var(--color-bg);
  width: 100%;
  max-width: 780px;
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 80px rgba(0,0,0,0.28);
  position: relative;
  animation: legalSlideUp 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  overflow: hidden;
}

@keyframes legalSlideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Close button */
.legal-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: var(--color-text-light);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition), color var(--transition);
  z-index: 1;
}

.legal-modal__close:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
}

/* Tab nav */
.legal-modal__nav {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--color-bg-alt);
  border-bottom: 1px solid var(--color-border);
  padding: 0 24px;
  gap: 0;
}

.legal-modal__nav::-webkit-scrollbar { display: none; }

.legal-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-light);
  font-family: var(--font-body);
  font-size: 0.74rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 16px 18px;
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--transition), border-color var(--transition);
  flex-shrink: 0;
}

.legal-tab:hover { color: var(--color-text); }

.legal-tab.active {
  color: var(--color-gold-dark);
  border-bottom-color: var(--color-gold);
}

/* Content body */
.legal-modal__body {
  padding: 36px 40px 40px;
  max-height: 65vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.legal-modal__body::-webkit-scrollbar { width: 4px; }
.legal-modal__body::-webkit-scrollbar-track { background: transparent; }
.legal-modal__body::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

/* Panels */
.legal-panel { display: none; }
.legal-panel.active { display: block; }

.legal-panel__title {
  font-family: var(--font-display);
  font-size: 1.9rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 20px;
  letter-spacing: 0.02em;
}

.legal-panel__lead {
  font-size: 0.95rem;
  color: var(--color-text-light);
  margin-bottom: 28px;
  line-height: 1.65;
}

.legal-panel p,
.legal-panel li {
  font-size: 0.88rem;
  line-height: 1.75;
  color: var(--color-text-light);
  margin-bottom: 12px;
}

.legal-panel h3 {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text);
  margin: 28px 0 10px;
}

.legal-panel ol,
.legal-panel ul {
  padding-left: 20px;
  margin-bottom: 16px;
}

.legal-panel a {
  color: var(--color-gold-dark);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}

.legal-panel a:hover { border-bottom-color: var(--color-gold-dark); }

.legal-note {
  background: var(--color-bg-alt);
  border-left: 3px solid var(--color-gold);
  padding: 12px 16px;
  border-radius: 0 var(--radius) var(--radius) 0;
  font-size: 0.82rem !important;
}

/* Social grid in Connect panel */
.legal-social {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.legal-social__item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  text-decoration: none !important;
  border-bottom: 1px solid var(--color-border) !important;
  color: var(--color-text);
  transition: border-color var(--transition), background var(--transition);
}

.legal-social__item:hover {
  border-color: var(--color-gold) !important;
  background: var(--color-bg-alt);
  border-bottom-color: var(--color-gold) !important;
}

.legal-social__icon {
  width: 44px;
  height: 44px;
  background: var(--color-bg-alt);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold-dark);
  flex-shrink: 0;
  transition: background var(--transition);
}

.legal-social__item:hover .legal-social__icon {
  background: var(--color-gold);
  color: #fff;
}

.legal-social__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.legal-social__label strong {
  font-size: 0.9rem;
  color: var(--color-text);
}

.legal-social__label small {
  font-size: 0.78rem;
  color: var(--color-text-light);
}

/* Admin portal link */
.legal-admin-link {
  margin-top: 8px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border-light);
}

.legal-admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-light);
  text-decoration: none;
  border: 1px solid var(--color-border);
  padding: 8px 16px;
  border-radius: var(--radius);
  transition: color var(--transition), border-color var(--transition);
}

.legal-admin-btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-light);
}

/* Contact grid */
.legal-contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.legal-contact-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.legal-contact-icon {
  width: 40px;
  height: 40px;
  background: var(--color-bg-alt);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold-dark);
  flex-shrink: 0;
}

.legal-contact-item div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legal-contact-item strong {
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text);
}

.legal-contact-item a,
.legal-contact-item span {
  font-size: 0.85rem;
  color: var(--color-text-light);
}

.legal-contact-item a {
  color: var(--color-gold-dark);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}

.legal-contact-item a:hover { border-bottom-color: var(--color-gold-dark); }

/* Responsive */
@media (max-width: 640px) {
  .legal-overlay { padding: 0; align-items: flex-end; }
  .legal-modal {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 90vh;
    animation: legalSlideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  .legal-modal__body { padding: 24px 20px 32px; max-height: 60vh; }
  .legal-modal__nav { padding: 0 12px; }
  .legal-tab { padding: 14px 12px; font-size: 0.68rem; }
  .legal-panel__title { font-size: 1.5rem; }
  .legal-contact-grid { grid-template-columns: 1fr; }
}
"""

with open("c:/Users/muzim/OneDrive/Muzi's Office/Dev-Beast/O'luhle Scents/css/modern-extensions.css", "a") as f:
    f.write(css_block)
print("Styles successfully appended.")
