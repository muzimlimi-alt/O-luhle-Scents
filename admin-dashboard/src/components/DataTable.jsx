import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';

/**
 * Standard data table with optional mobile card transformation.
 *
 * Pass `mobileCardRenderer` to render each row as a card below 768px.
 * The renderer receives (row, columns, actions) and should return JSX.
 * Without it, the table falls back to horizontal scrolling on mobile.
 *
 * Pass `caption` for screen-reader accessibility.
 */
export function DataTable({
  columns, data, actions, loading, page, totalPages, onPageChange,
  emptyState, mobileCardRenderer, caption,
}) {
  if (loading) {
    return (
      <div className="table-wrapper table-skeleton">
        <div className="skeleton-row header"></div>
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row"></div>)}
      </div>
    );
  }

  const hasPagination = typeof page === 'number' && typeof totalPages === 'number' && typeof onPageChange === 'function';
  const hasMobileCards = typeof mobileCardRenderer === 'function';
  const isEmpty = !data || data.length === 0;

  const paginationBlock = hasPagination && (
    <div className="table-footer">
      <div className="pagination">
        <button
          type="button"
          className="page-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="page-info">Page {page} of {totalPages || 1}</span>
        <button
          type="button"
          className="page-btn"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className={`table-wrapper ${hasMobileCards ? 'has-mobile-cards' : ''}`}>
      <div className="table-scroll">
        <table className="modern-table">
          {caption && <caption className="visually-hidden">{caption}</caption>}
          <thead>
            <tr>
              {columns.map(col => <th key={col.key}>{col.label}</th>)}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {!isEmpty ? (
              data.map((row, idx) => (
                <tr key={row.id || idx}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td>
                      <div className="action-cell">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="empty-cell">
                  {emptyState || <EmptyState title="No records found" />}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMobileCards && !isEmpty && (
        <div className="mobile-card-list" role="list">
          {data.map((row, idx) => (
            <div key={row.id || idx} className="mobile-card" role="listitem">
              {mobileCardRenderer(row, columns, actions)}
            </div>
          ))}
        </div>
      )}

      {paginationBlock}

      <style dangerouslySetInnerHTML={{ __html: `
        .table-wrapper { position: relative; }
        .table-scroll { overflow-x: auto; }
        .empty-cell { padding: 0; }
        .table-footer { padding: var(--sp-4); display: flex; justify-content: flex-end; border-top: 1px solid var(--border-low); }
        .pagination { display: flex; align-items: center; gap: var(--sp-3); }
        .page-btn {
          background: none; border: 1px solid var(--border-default); color: var(--text-secondary);
          width: var(--tap); height: var(--tap); display: grid; place-items: center;
          border-radius: var(--r); cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease);
        }
        .page-btn:hover:not(:disabled) { border-color: var(--y-base); color: var(--y-base); }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }
        .page-info { font-size: .78rem; color: var(--text-muted); font-family: var(--f-mono); }

        .mobile-card-list { display: none; }
        .mobile-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-low);
          border-radius: var(--r);
          padding: var(--sp-4);
          transition: border-color var(--t-fast) var(--ease);
        }
        .mobile-card:hover { border-color: var(--border-default); }

        @media (max-width: 768px) {
          .has-mobile-cards .table-scroll { display: none; }
          .has-mobile-cards .mobile-card-list {
            display: flex;
            flex-direction: column;
            gap: var(--sp-3);
            padding: var(--sp-3);
          }
        }

        .skeleton-row { height: 48px; background: linear-gradient(90deg, var(--bg-section) 25%, var(--bg-elevated) 50%, var(--bg-section) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; margin-bottom: var(--sp-2); border-radius: var(--r); }
        .skeleton-row.header { height: 32px; opacity: 0.5; margin-bottom: var(--sp-4); }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (prefers-reduced-motion: reduce) {
          .skeleton-row { animation: none; opacity: 0.6; }
        }
        @media (max-width: 480px) {
          .table-footer { padding: var(--sp-3); }
        }

        .visually-hidden {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }
      `}} />
    </div>
  );
}

export default DataTable;
