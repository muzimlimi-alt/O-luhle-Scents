import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { FOCUSABLE_SELECTOR, pushOverlay, popOverlay, isTopOverlay, prefersReducedMotion } from './overlayStack';

/**
 * Slide-out panel, anchored to the right edge, full viewport height.
 * Used for every create/edit form in the admin — the "here's a record to
 * work on" case. Destructive confirmations stay on the centered Modal.
 *
 * Two modes:
 *  - default (pass `title`): standard title/body chrome.
 *  - raw (pass `raw`): renders `children` as-is inside the a11y wrapper,
 *    for consumers with their own internal layout (tabbed editors, rich
 *    text, etc). The consumer owns its own width/height/slide animation —
 *    Drawer only supplies the overlay, right-anchored flex slot, and a11y.
 */
export function Drawer({ isOpen, onClose, title, children, raw = false, width = 480 }) {
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
    ? { initial: false, animate: { x: 0 }, exit: { x: 0 }, transition: { duration: 0.01 } }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
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
        className="drawer-panel"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <h3 id={labelledBy} className="drawer-title font-title">{title}</h3>
          <button className="drawer-close" onClick={onClose} aria-label="Close panel">
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </Motion.div>
    );
  }

  const content = (
    <AnimatePresence>
      <div className="drawer-overlay" onClick={onClose}>
        {panel}
        <style dangerouslySetInnerHTML={{ __html: `
          .drawer-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
            z-index: 1000; display: flex; align-items: stretch; justify-content: flex-end;
          }
          .drawer-panel {
            height: 100%; max-width: 100vw; background: var(--color-bg-card);
            border-left: 1px solid var(--color-border); box-shadow: var(--shadow-lg, -8px 0 30px rgba(0,0,0,0.3));
            display: flex; flex-direction: column;
          }
          .drawer-header {
            padding: 20px 24px; border-bottom: 1px solid var(--color-border);
            display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; gap: 16px;
          }
          .drawer-title { font-size: 1.25rem; font-weight: 700; color: var(--color-primary); word-break: break-word; }
          .drawer-close {
            background: none; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s;
            width: 44px; height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; margin: -10px;
          }
          .drawer-close:hover { color: var(--color-error-text); }
          .drawer-body { flex: 1; overflow-y: auto; padding: 24px; -webkit-overflow-scrolling: touch; }

          @media (prefers-reduced-motion: reduce) {
            .drawer-panel { transition-duration: 0.01s !important; }
          }
          @media (max-width: 640px) {
            .drawer-panel { width: 100% !important; }
            .drawer-header { padding: 16px; }
            .drawer-body { padding: 16px; }
            .drawer-title { font-size: 1.1rem; }
          }
          [inert] { pointer-events: none; }
        `}} />
      </div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
