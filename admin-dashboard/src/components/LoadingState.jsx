import React from 'react';

/**
 * Standard loading treatment: one spinner + label, announced to screen
 * readers via role="status". Replaces the 3+ competing loading idioms
 * (.loader-gold duplicated per-page, plain "Loading..." text, ad hoc
 * Loader2 boilerplate). DataTable keeps its own skeleton-row shimmer for
 * table bodies specifically — a better fit there than a centered spinner —
 * this component is for whole-page/section loading.
 */
export function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="loading-state-ds" role="status" aria-live="polite">
      <div className="loading-state-ds__spinner" aria-hidden="true" />
      <p className="loading-state-ds__label">{label}</p>
      <style dangerouslySetInnerHTML={{ __html: `
        .loading-state-ds {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; padding: 64px 24px; color: var(--color-text-muted);
        }
        .loading-state-ds__spinner {
          width: 36px; height: 36px; border-radius: 50%;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary);
          animation: loading-state-ds-spin 0.8s linear infinite;
        }
        .loading-state-ds__label { font-size: 0.85rem; }
        @keyframes loading-state-ds-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .loading-state-ds__spinner { animation-duration: 2.4s; }
        }
      `}} />
    </div>
  );
}

export default LoadingState;
