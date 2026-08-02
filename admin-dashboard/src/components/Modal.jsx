import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

// Every open Modal instance registers itself here so ESC/Tab only ever
// act on the top-most one, and scroll-lock/inert only lift when the
// last one closes (two modals can be mounted briefly during a swap).
let modalStack = [];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shared accessible dialog. Two modes:
 *  - default (pass `title`): standard title/body chrome.
 *  - raw (pass `raw`): renders `children` as-is inside the a11y wrapper,
 *    for consumers with their own internal layout (e.g. ProductModal's
 *    tabbed editor) that shouldn't be forced into the generic chrome.
 */
export function Modal({ isOpen, onClose, title, children, raw = false, maxWidth = 600 }) {
  const id = useId();
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    modalStack.push(id);
    if (modalStack.length === 1) {
      document.body.style.overflow = 'hidden';
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('inert', '');
        root.setAttribute('aria-hidden', 'true');
      }
    }

    triggerRef.current = document.activeElement;
    const raf = requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (el || panelRef.current)?.focus();
    });

    const handleKeyDown = (e) => {
      if (modalStack[modalStack.length - 1] !== id) return; // not the top-most modal

      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
        if (!focusable || focusable.length === 0) return;
        const list = Array.from(focusable);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      modalStack = modalStack.filter((x) => x !== id);

      if (modalStack.length === 0) {
        document.body.style.overflow = 'auto';
        const root = document.getElementById('root');
        if (root) {
          root.removeAttribute('inert');
          root.removeAttribute('aria-hidden');
        }
      }
      triggerRef.current?.focus?.();
    };
  }, [isOpen, id, onClose]);

  if (!isOpen) return null;

  const reduceMotion = prefersReducedMotion();
  const panelMotionProps = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } }
    : {
        initial: { opacity: 0, scale: 0.95, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: 20 },
        transition: { duration: 0.25 },
      };

  const labelledBy = title ? `${id}-title` : undefined;

  let panel;
  if (raw) {
    const child = React.Children.only(children);
    panel = React.cloneElement(child, {
      ref: panelRef,
      role: 'dialog',
      'aria-modal': 'true',
      tabIndex: -1,
      onClick: (e) => {
        e.stopPropagation();
        child.props.onClick?.(e);
      },
    });
  } else {
    panel = (
      <Motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        {...panelMotionProps}
        className="modal-content"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={labelledBy} className="modal-title font-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </Motion.div>
    );
  }

  const content = (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        {panel}
        <style dangerouslySetInnerHTML={{ __html: `
          .modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);
            z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;
          }
          .modal-content {
            background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg);
            width: 100%; box-shadow: var(--shadow-md); max-height: 90vh; overflow-y: auto;
          }
          .modal-header {
            padding: 24px; border-bottom: 1px solid var(--color-border);
            display: flex; justify-content: space-between; align-items: center;
          }
          .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--color-primary); }
          .modal-close {
            background: none; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s;
          }
          .modal-close:hover { color: var(--color-error-text); }
          .modal-body { padding: 24px; }
          [inert] { pointer-events: none; }
        `}} />
      </div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
