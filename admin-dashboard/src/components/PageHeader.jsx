
/**
 * Standard page header: icon + title + optional subtitle, with actions
 * right-aligned. Every admin page should render exactly one of these at
 * the top of its content, replacing the ~4 different header treatments
 * (page-title/content-header, couture-text/atelier-header, atelier-title
 * with eyebrow badge, ad hoc flex divs) that previously coexisted.
 */
export function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header__heading">
        <h2 className="page-header__title">
          {icon && <span className="page-header__icon">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
      <style dangerouslySetInnerHTML={{ __html: `
        .page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 16px; flex-wrap: wrap; margin-bottom: 28px;
        }
        .page-header__heading { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .page-header__title {
          display: flex; align-items: center; gap: 10px;
          font-size: 1.4rem; font-weight: 600; color: var(--color-text-header);
          font-family: var(--font-display); margin: 0;
        }
        .page-header__icon { display: inline-flex; color: var(--color-primary); flex-shrink: 0; }
        .page-header__subtitle { font-size: 0.85rem; color: var(--color-text-muted); margin: 0; max-width: 60ch; }
        .page-header__actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
        @media (max-width: 640px) {
          .page-header { flex-direction: column; align-items: stretch; }
          .page-header__title { font-size: 1.2rem; }
          .page-header__actions { width: 100%; }
          .page-header__actions > * { flex: 1; }
        }
      `}} />
    </div>
  );
}

export default PageHeader;
