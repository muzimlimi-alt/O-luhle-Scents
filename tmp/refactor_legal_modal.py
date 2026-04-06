
import os

target_file = "c:/Users/muzim/OneDrive/Muzi's Office/Dev-Beast/O'luhle Scents/css/modern-extensions.css"

with open(target_file, "r") as f:
    content = f.read()

# Pattern identifying the start of the Legal Modal section I added
start_marker = "/* ============================================================\n   LEGAL MODAL - Extracted from Oluhle/style.css"
if start_marker in content:
    # We will replace from the marker to the end or just the whole block.
    # Since I appended it at the end, I can just truncate and re-append.
    base_content = content.split(start_marker)[0]
else:
    # If for some reason the marker isn't exactly matched, we'll just append (but it should be there)
    base_content = content

new_styles = """/* ============================================================
   LEGAL MODAL - Refactored to match Cookie Settings theme
   ============================================================ */

.legal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 18, 16, 0.78); /* Matched to .cc-prefs-overlay */
  z-index: 5000; /* Matched to Cookie overlay z-index */
  display: flex;
  align-items: center; /* Centered like Cookie modal */
  justify-content: center;
  padding: 24px 16px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: legalFadeIn 0.22s ease;
}

.legal-overlay[hidden] { display: none; }

@keyframes legalFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.legal-modal {
  background: #1c1916; /* Matched to .cc-prefs-modal */
  border: 1px solid rgba(184, 155, 106, 0.2);
  border-radius: 12px;
  width: 100%;
  max-width: 680px; /* Slimmer for premium feel */
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0,0,0,0.55);
  animation: legalModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

@keyframes legalModalIn {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Close button - Styled like cc-prefs-modal__close */
.legal-modal__close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background 0.2s;
  z-index: 10;
}

.legal-modal__close:hover {
  color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.06);
}

/* Tab nav - Dark theme refactor */
.legal-modal__nav {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: 0 24px;
  gap: 0;
  flex-shrink: 0;
}

.legal-modal__nav::-webkit-scrollbar { display: none; }

.legal-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255,255,255,0.45);
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 18px 20px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.25s, border-color 0.25s;
  flex-shrink: 0;
}

.legal-tab:hover { color: rgba(255,255,255,0.8); }

.legal-tab.active {
  color: var(--color-gold-light);
  border-bottom-color: var(--color-gold);
}

/* Content body - Dark theme scrollbars */
.legal-modal__body {
  flex: 1;
  padding: 32px 40px 40px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.legal-modal__body::-webkit-scrollbar { width: 3px; }
.legal-modal__body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* Panels */
.legal-panel { display: none; }
.legal-panel.active { display: block; }

.legal-panel__title {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 500;
  color: #fff;
  margin-bottom: 16px;
  letter-spacing: 0.01em;
}

.legal-panel__lead {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.5);
  margin-bottom: 24px;
  line-height: 1.6;
}

.legal-panel p,
.legal-panel li {
  font-size: 0.85rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.45);
  margin-bottom: 12px;
}

.legal-panel h3 {
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #fff;
  margin: 24px 0 10px;
  opacity: 0.9;
}

.legal-panel ol,
.legal-panel ul {
  padding-left: 20px;
  margin-bottom: 16px;
}

.legal-panel a {
  color: var(--color-gold-light);
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s;
}

.legal-panel a:hover { text-decoration-color: var(--color-gold-light); }

.legal-note {
  background: rgba(184, 155, 106, 0.05);
  border-left: 3px solid var(--color-gold);
  padding: 14px 18px;
  border-radius: 0 8px 8px 0;
  font-size: 0.8rem !important;
  color: rgba(255,255,255,0.5) !important;
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
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  text-decoration: none !important;
  color: #fff;
  transition: border-color 0.25s, background 0.25s;
}

.legal-social__item:hover {
  border-color: rgba(184, 155, 106, 0.4);
  background: rgba(255,255,255,0.03);
}

.legal-social__icon {
  width: 44px;
  height: 44px;
  background: rgba(255,255,255,0.04);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold-light);
  flex-shrink: 0;
  transition: background 0.25s, color 0.25s;
}

.legal-social__item:hover .legal-social__icon {
  background: var(--color-gold);
  color: #1a1009;
}

.legal-social__label strong {
  display: block;
  font-size: 0.88rem;
  color: #fff;
}

.legal-social__label small {
  font-size: 0.74rem;
  color: rgba(255,255,255,0.4);
}

/* Admin portal link */
.legal-admin-link {
  margin-top: 8px;
  padding-top: 24px;
  border-top: 1px solid rgba(255,255,255,0.07);
}

.legal-admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 10px 18px;
  border-radius: 6px;
  transition: all 0.25s;
}

.legal-admin-btn:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.04);
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
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
}

.legal-contact-icon {
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,0.04);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold-light);
  flex-shrink: 0;
}

.legal-contact-item strong {
  display: block;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin-bottom: 4px;
}

.legal-contact-item a,
.legal-contact-item span {
  font-size: 0.82rem;
  color: #fff;
}

.legal-contact-item a {
  color: var(--color-gold-light);
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s;
}

.legal-contact-item a:hover { text-decoration-color: var(--color-gold-light); }

/* Responsive adjustments */
@media (max-width: 640px) {
  .legal-overlay { padding: 0; align-items: flex-end; }
  .legal-modal {
    border-radius: 16px 16px 0 0;
    max-height: 85vh;
  }
  .legal-modal__body { padding: 24px 20px 32px; }
  .legal-modal__nav { padding: 0 12px; }
  .legal-tab { padding: 14px 12px; font-size: 0.68rem; }
  .legal-panel__title { font-size: 1.5rem; }
  .legal-contact-grid { grid-template-columns: 1fr; }
}
"""

with open(target_file, "w") as f:
    f.write(base_content + new_styles)

print("Legal Modal refactored to match Cookie Settings dark theme.")
