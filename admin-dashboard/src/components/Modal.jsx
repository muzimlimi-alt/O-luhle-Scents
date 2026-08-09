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
export function Modal({ isOpen, onClose, title, children, raw = false, maxWidth = 480 }) {
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
        style={{ '--modal-w': `${maxWidth}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id={labelledBy} className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
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
            position: fixed; inset: 0; background: rgba(0,0,0,.68); backdrop-filter: blur(4px);
            z-index: 1000; display: flex; align-items: center; justify-content: center; padding: var(--sp-4);
          }
          .modal-content {
            background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
            width: 100%; max-width: min(var(--modal-w, 480px), 100%);
            box-shadow: var(--sh-xl, 0 24px 70px rgba(0,0,0,.65));
            max-height: 90vh; overflow-y: auto;
          }
          .modal-header {
            padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low);
            display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-4);
          }
          .modal-title { font-family: var(--f-display); font-weight: 400; font-size: 1.4rem; color: var(--text-primary); word-break: break-word; margin: 0; }
          .modal-close {
            margin-left: auto; flex: none; width: var(--tap, 44px); height: var(--tap, 44px);
            display: grid; place-items: center;
            background: none; border: 1px solid var(--border-default); border-radius: var(--r);
            color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease);
          }
          .modal-close:hover { border-color: var(--y-base); color: var(--y-base); }
          .modal-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }
          .modal-body { padding: var(--sp-5); -webkit-overflow-scrolling: touch; }
          [inert] { pointer-events: none; }
          @media (max-width: 480px) {
            .modal-overlay { padding: var(--sp-3); align-items: flex-end; }
            .modal-content { max-height: 85vh; }
            .modal-header, .modal-body { padding: var(--sp-4); }
            .modal-title { font-size: 1.2rem; }
          }
        `}} />
      </div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
