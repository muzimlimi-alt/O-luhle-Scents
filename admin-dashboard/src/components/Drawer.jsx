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
 *  - default (pass `title`): standard title/body/foot chrome.
 *  - raw (pass `raw`): renders `children` as-is inside the a11y wrapper,
 *    for consumers with their own internal layout (tabbed editors, rich
 *    text, etc). The consumer owns its own width/height/slide animation —
 *    Drawer only supplies the overlay, right-anchored flex slot, and a11y.
 *
 * `footer` is optional — pass it to get a sticky action bar (matching the
 * reference's .drawer-foot) that stays visible while `children` scrolls.
 * Older callers that put their own action row inside `children` keep
 * working unchanged; migrate them to `footer` as they're touched.
 */
export function Drawer({ isOpen, onClose, title, eyebrow, children, footer, raw = false, width = 480, narrow = false }) {
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

  const reduceMotion = prefersReducedMotion() || document.documentElement.classList.contains('reduce-motion');
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
        className={`drawer-panel ${narrow ? 'drawer-panel--narrow' : ''}`}
        style={{ '--drawer-w': `${width}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="drawer-head__text">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={labelledBy} className="drawer-title">{title}</h2>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </Motion.div>
    );
  }

  const content = (
    <AnimatePresence>
      <div className="drawer-overlay" onClick={onClose}>
        {panel}
        <style dangerouslySetInnerHTML={{ __html: `
          .drawer-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,.68); backdrop-filter: blur(3px);
            z-index: 1000; display: flex; align-items: stretch; justify-content: flex-end;
          }
          .drawer-panel {
            height: 100%; width: min(var(--drawer-w, 480px), 100vw); max-width: 100vw;
            background: var(--bg-section); border-left: 1px solid var(--border-default);
            box-shadow: var(--sh-xl, -8px 0 30px rgba(0,0,0,.3));
            display: flex; flex-direction: column;
          }
          .drawer-panel--narrow { width: min(420px, 100vw); }
          .drawer-head {
            flex: none; display: flex; align-items: flex-start; gap: var(--sp-4);
            padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low);
          }
          .drawer-head__text { min-width: 0; flex: 1; }
          .drawer-title { font-family: var(--f-display); font-weight: 400; font-size: 1.4rem; color: var(--text-primary); word-break: break-word; margin: 0; }
          .drawer-close {
            margin-left: auto; flex: none; width: var(--tap, 44px); height: var(--tap, 44px);
            display: grid; place-items: center;
            background: none; border: 1px solid var(--border-default); border-radius: var(--r);
            color: var(--text-secondary); cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease);
          }
          .drawer-close:hover { border-color: var(--y-base); color: var(--y-base); }
          .drawer-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }
          .drawer-body { flex: 1; overflow-y: auto; padding: var(--sp-5); -webkit-overflow-scrolling: touch; }
          .drawer-foot {
            flex: none; display: flex; gap: var(--sp-3); flex-wrap: wrap;
            padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--border-low); background: var(--bg-page);
          }

          @media (prefers-reduced-motion: reduce) {
            .drawer-panel { transition-duration: .01s !important; }
          }
          @media (max-width: 480px) {
            .drawer-head, .drawer-body, .drawer-foot { padding-left: var(--sp-4); padding-right: var(--sp-4); }
            .drawer-title { font-size: 1.2rem; }
            .drawer-foot { flex-direction: column; }
            .drawer-foot > * { width: 100%; }
          }
          [inert] { pointer-events: none; }
        `}} />
      </div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
