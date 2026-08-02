import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DataTable({ columns, data, actions, loading }) {
  if (loading) {
    return (
      <div className="table-skeleton">
        <div className="skeleton-row header"></div>
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-row"></div>)}
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="modern-table">
          <thead>
            <tr>
              {columns.map(col => <th key={col.key}>{col.label}</th>)}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
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
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <div className="pagination">
          <button className="page-btn"><ChevronLeft size={16} /></button>
          <span className="page-info">Page 1 of 1</span>
          <button className="page-btn"><ChevronRight size={16} /></button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .table-wrapper { position: relative; }
        .table-scroll { overflow-x: auto; }
        .modern-table { width: 100%; border-collapse: collapse; }
        .empty-cell { padding: 48px; text-align: center; color: var(--color-text-muted); font-style: italic; }
        .table-footer { padding: 16px; display: flex; justify-content: flex-end; border-top: 1px solid var(--color-border); }
        .pagination { display: flex; align-items: center; gap: 12px; }
        .page-btn { background: none; border: 1px solid var(--color-border); color: var(--color-text); padding: 4px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
        .page-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .page-info { font-size: 0.8rem; color: var(--color-text-muted); }
        
        .skeleton-row { height: 48px; background: linear-gradient(90deg, var(--color-bg-dark) 25%, var(--color-bg-card) 50%, var(--color-bg-dark) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; margin-bottom: 8px; border-radius: 4px; }
        .skeleton-row.header { height: 32px; opacity: 0.5; margin-bottom: 16px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}} />
    </div>
  );
}
