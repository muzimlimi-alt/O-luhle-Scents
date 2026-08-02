// Shared accessibility plumbing for every overlay (centered Modal and
// slide-out Drawer alike) so ESC/focus-trap/scroll-lock/inert stay correct
// even if a confirmation dialog and a drawer are ever open at once.

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let stack = [];

export function pushOverlay(id) {
  stack.push(id);
  if (stack.length === 1) {
    document.body.style.overflow = 'hidden';
    const root = document.getElementById('root');
    if (root) {
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
    }
  }
}

export function popOverlay(id) {
  stack = stack.filter((x) => x !== id);
  if (stack.length === 0) {
    document.body.style.overflow = 'auto';
    const root = document.getElementById('root');
    if (root) {
      root.removeAttribute('inert');
      root.removeAttribute('aria-hidden');
    }
  }
}

export function isTopOverlay(id) {
  return stack[stack.length - 1] === id;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
