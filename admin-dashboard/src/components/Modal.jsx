import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { FOCUSABLE_SELECTOR, pushOverlay, popOverlay, isTopOverlay, prefersReducedMotion } from './overlayStack';

/**
 * Centered, focus-locked dialog — reserved for destructive confirmations
 * and anything that needs to feel like a stop rather than a workspace.
 * For create/edit forms, use the Drawer component instead.
 *
 * Two modes:
 *  - default (pass `title`): standard title/body chrome.
 *  - raw (pass `raw`): renders `children` as-is inside the a11y wrapper,
 *    for consumers with their own internal layout.
 */
export function Modal({ isOpen, onClose, title, children, raw = false, maxWidth = 600 }) {
  const id = useId();
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    pushOverlay(id);
    triggerRef.current = document.activeElement;
    const raf = requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (el || panelRef.current)?.focus();
    });

    const handleKeyDown = (e) => {
      if (!isTopOverlay(id)) return;

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
      popOverlay(id);
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
            padding: 20px 24px; border-bottom: 1px solid var(--color-border);
            display: flex; justify-content: space-between; align-items: center; gap: 16px;
          }
          .modal-title { font-size: 1.25rem; font-weight: 700; color: var(--color-primary); word-break: break-word; }
          .modal-close {
            background: none; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s;
            width: 44px; height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; margin: -10px;
          }
          .modal-close:hover { color: var(--color-error-text); }
          .modal-body { padding: 24px; -webkit-overflow-scrolling: touch; }
          [inert] { pointer-events: none; }
          @media (max-width: 480px) {
            .modal-overlay { padding: 12px; }
            .modal-header { padding: 16px; }
            .modal-body { padding: 16px; }
            .modal-title { font-size: 1.1rem; }
          }
        `}} />
      </div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
