import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { ExportButtons } from '../components/ExportButtons';
import { ReceiptText, Eye } from 'lucide-react';

const SOURCE_TYPES = ['ORDER_SALE', 'ORDER_PAYMENT', 'REFUND', 'PURCHASE_RECEIVE', 'SUPPLIER_PAYMENT', 'MANUAL'];
const SOURCE_TONE = {
  ORDER_SALE: 'info',
  ORDER_PAYMENT: 'success',
  REFUND: 'warning',
  PURCHASE_RECEIVE: 'info',
  SUPPLIER_PAYMENT: 'success',
  MANUAL: 'neutral',
};

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Journals() {
  const [sourceType, setSourceType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (sourceType) params.sourceType = sourceType;
      if (from) params.from = from;
      if (to) params.to = to;
      const result = await financeApi.journals(params);
      setJournals(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Journals fetch failed:', err.message);
      setJournals([]);
    } finally {
      setLoading(false);
    }
  }, [sourceType, from, to]);

  useEffect(() => { fetchJournals(); }, [fetchJournals]);

  const columns = [
    { key: 'journalNumber', label: 'Journal #' },
    { key: 'date', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'description', label: 'Description' },
    { key: 'sourceType', label: 'Source', render: (v) => <StatusBadge tone={SOURCE_TONE[v] || 'neutral'} label={v.replace(/_/g, ' ')} /> },
    { key: 'lines', label: 'Amount', render: (lines) => fmt(lines.reduce((s, l) => s + Number(l.debit), 0)) },
  ];

  return (
    <div className="journals-page">
      <PageHeader
        icon={<ReceiptText size={22} />}
        title="Journals"
        subtitle="Every posted double-entry — immutable once created; corrections are new reversing journals, never edits."
      />

      <div className="card journals-filters">
        <select className="admin-input" value={sourceType} onChange={e => setSourceType(e.target.value)}>
          <option value="">All source types</option>
          {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <input type="date" className="admin-input" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="admin-input" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
        <ExportButtons
          path="/admin/finance/journals"
          params={{ ...(sourceType ? { sourceType } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }}
          filename="journals"
        />
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={journals}
          loading={loading}
          emptyState={<EmptyState icon={<ReceiptText size={40} />} title="No journals found" description="Nothing has posted for this filter yet." />}
          actions={(row) => (
            <button className="icon-btn" title="View lines" onClick={() => setSelected(row)}>
              <Eye size={14} />
            </button>
          )}
        />
      </div>

      <Drawer isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.journalNumber} — ${selected.description}` : ''} width={520}>
        {selected && (
          <DataTable
            columns={[
              { key: 'account', label: 'Account', render: (a) => `${a.code} ${a.name}` },
              { key: 'debit', label: 'Debit', render: fmt },
              { key: 'credit', label: 'Credit', render: fmt },
              { key: 'memo', label: 'Memo', render: (v) => v || '—' },
            ]}
            data={selected.lines}
          />
        )}
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .journals-filters { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .journals-filters .admin-input { width: auto; min-width: 160px; }
      `}} />
    </div>
  );
}

export default Journals;
