import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { ExportButtons } from '../components/ExportButtons';
import { History, Users, Truck } from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BUCKET_TONE = {
  'Current (0-30)': 'success',
  '31-60 days': 'warning',
  '61-90 days': 'warning',
  '90+ days': 'error',
};

const TABS = [
  { id: 'receivables', label: 'Aged Receivables', icon: <Users size={16} /> },
  { id: 'payables', label: 'Aged Payables', icon: <Truck size={16} /> },
];

function AgingTab({ fetcher, path, partyLabel, totalLabel, idKey, partyKey, totalKey }) {
  const [asOf, setAsOf] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetcher(asOf || undefined));
    } catch (err) {
      console.error('Aging report fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOf, fetcher]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: idKey, label: 'Reference', render: (v) => v.split('-')[0].toUpperCase() },
    { key: partyKey, label: partyLabel },
    { key: totalKey, label: 'Total', render: fmt },
    { key: 'amountPaid', label: 'Paid', render: fmt },
    { key: 'amountOutstanding', label: 'Outstanding', render: (v) => <strong>{fmt(v)}</strong> },
    { key: 'daysOutstanding', label: 'Days' },
    { key: 'bucket', label: 'Age', render: (v) => <StatusBadge tone={BUCKET_TONE[v] || 'neutral'} label={v} /> },
  ];

  return (
    <div>
      <div className="aging-filters">
        <label>As of</label>
        <input type="date" className="admin-input" value={asOf} onChange={e => setAsOf(e.target.value)} />
        <ExportButtons path={path} params={asOf ? { asOf } : {}} filename={path.split('/').pop()} />
      </div>

      {loading ? (
        <LoadingState label="Calculating aging..." />
      ) : !data ? (
        <EmptyState title="Could not load aging report" description="Check the server connection and try again." />
      ) : (
        <>
          <div className="inv-stat-grid aging-stat-grid">
            {Object.entries(data.bucketTotals).map(([bucket, total]) => (
              <div className="inv-stat" key={bucket}>
                <span className="inv-stat-label">{bucket}</span>
                <span className="inv-stat-value">{fmt(total)}</span>
              </div>
            ))}
            <div className="inv-stat">
              <span className="inv-stat-label">Total Outstanding</span>
              <span className="inv-stat-value">{fmt(data.totalOutstanding)}</span>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={data.rows}
            emptyState={<EmptyState title="Nothing outstanding" description={`No unpaid ${totalLabel.toLowerCase()} as of this date.`} />}
          />
        </>
      )}
    </div>
  );
}

export function AgedReports() {
  const [activeTab, setActiveTab] = useState('receivables');

  return (
    <div className="aged-reports-page">
      <PageHeader
        icon={<History size={22} />}
        title="Aged Reports"
        subtitle="Outstanding customer and supplier balances, bucketed by how long they've been owing."
      />

      <div className="stmt-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`stmt-tab ${activeTab === t.id ? 'stmt-tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'receivables' && (
          <AgingTab fetcher={financeApi.agedReceivables} path="/admin/finance/aged-receivables" partyLabel="Customer" totalLabel="Receivables" idKey="orderId" partyKey="customerName" totalKey="totalAmount" />
        )}
        {activeTab === 'payables' && (
          <AgingTab fetcher={financeApi.agedPayables} path="/admin/finance/aged-payables" partyLabel="Supplier" totalLabel="Payables" idKey="purchaseId" partyKey="supplierName" totalKey="totalCost" />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .stmt-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-5); flex-wrap: wrap; }
        .stmt-tab {
          display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4);
          background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-muted); font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease);
        }
        .stmt-tab:hover { color: var(--y-base); border-color: var(--y-base); }
        .stmt-tab--active { color: var(--y-base); border-color: var(--y-base); background: rgba(var(--y-rgb), 0.08); }

        .aging-filters { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-5); font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap; }
        .aging-filters .admin-input { width: auto; }
        .aging-stat-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: var(--sp-5); }
        .inv-stat-grid { display: grid; gap: var(--sp-4); }
        .inv-stat { padding: var(--sp-4); background: var(--bg-surface); border: 1px solid var(--border-low); border-radius: var(--r); display: flex; flex-direction: column; gap: var(--sp-2); }
        .inv-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .inv-stat-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }

        @media (max-width: 480px) {
          .stmt-tab { flex: 1 1 auto; justify-content: center; }
          .aging-filters { flex-direction: column; align-items: flex-start; }
          .aging-filters .admin-input { width: 100%; }
        }
      `}} />
    </div>
  );
}

export default AgedReports;
