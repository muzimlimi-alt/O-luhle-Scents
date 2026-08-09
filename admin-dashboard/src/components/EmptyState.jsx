
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
          text-align: center; padding: var(--sp-7, 48px) var(--sp-5); gap: var(--sp-2); color: var(--text-muted);
        }
        .empty-state-ds__icon { color: var(--text-muted); opacity: 0.5; margin-bottom: var(--sp-2); }
        .empty-state-ds__title { font-family: var(--f-display); font-size: 1.1rem; color: var(--text-primary); font-weight: 400; margin: 0; }
        .empty-state-ds__description { font-size: .85rem; color: var(--text-muted); max-width: 40ch; margin: 0; }
        .empty-state-ds__action { margin-top: var(--sp-3); }
      `}} />
    </div>
  );
}

export default EmptyState;
