import React from 'react';

/**
 * Standard "nothing here yet" treatment: icon + title + description +
 * optional action. Replaces the previously copy-pasted `.elite-empty-state`
 * (duplicated verbatim in multiple pages), DataTable's plain empty row, and
 * assorted bare <p> "No X found" text.
 */
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state-ds">
      {icon && <div className="empty-state-ds__icon">{icon}</div>}
      {title && <h3 className="empty-state-ds__title">{title}</h3>}
      {description && <p className="empty-state-ds__description">{description}</p>}
      {action && <div className="empty-state-ds__action">{action}</div>}
      <style dangerouslySetInnerHTML={{ __html: `
        .empty-state-ds {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 64px 24px; gap: 6px; color: var(--color-text-muted);
        }
        .empty-state-ds__icon { color: var(--color-text-muted); opacity: 0.5; margin-bottom: 8px; }
        .empty-state-ds__title { font-family: var(--font-display); font-size: 1.1rem; color: var(--color-text-header); font-weight: 600; margin: 0; }
        .empty-state-ds__description { font-size: 0.85rem; max-width: 40ch; margin: 0; }
        .empty-state-ds__action { margin-top: 14px; }
      `}} />
    </div>
  );
}

export default EmptyState;
