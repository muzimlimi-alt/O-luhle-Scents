import { useState, useEffect, useCallback } from 'react';
import { sarsApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { ExportButtons } from '../components/ExportButtons';
import { Receipt, ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString();

const TABS = [
  { id: 'summary', label: 'VAT Summary', icon: <Scale size={16} /> },
  { id: 'output', label: 'Output VAT Register', icon: <ArrowUpCircle size={16} /> },
  { id: 'input', label: 'Input VAT Register', icon: <ArrowDownCircle size={16} /> },
];

// Shared by all three tabs — a date-range filter is more useful here than
// AgedReports' single "as of" date, since a VAT register is inherently a
// period report (everything posted between two dates), not a point-in-time
// balance. Leaving both blank returns everything ever posted.
function useVatRange() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  return { startDate, setStartDate, endDate, setEndDate, params: { startDate: startDate || undefined, endDate: endDate || undefined } };
}

function DateRangeFilter({ range }) {
  return (
    <div className="aging-filters">
      <label>From</label>
      <input type="date" className="admin-input" value={range.startDate} onChange={e => range.setStartDate(e.target.value)} />
      <label>To</label>
      <input type="date" className="admin-input" value={range.endDate} onChange={e => range.setEndDate(e.target.value)} />
    </div>
  );
}

function VatSummaryTab() {
  const range = useVatRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await sarsApi.vatSummary(range.params));
    } catch (err) {
      console.error('VAT summary fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <DateRangeFilter range={range} />
      {loading ? (
        <LoadingState label="Calculating VAT summary..." />
      ) : !data ? (
        <EmptyState title="Could not load VAT summary" description="Check the server connection and try again." />
      ) : (
        <>
          <div className="inv-stat-grid vat-stat-grid">
            <div className="inv-stat">
              <span className="inv-stat-label">Output VAT ({data.salesTransactionCount} sales, {data.refundTransactionCount} refunds)</span>
              <span className="inv-stat-value">{fmt(data.totalOutputVat)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">Input VAT ({data.purchaseTransactionCount} purchases)</span>
              <span className="inv-stat-value">{fmt(data.totalInputVat)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">{data.netVatPosition >= 0 ? 'Net VAT Payable to SARS' : 'Net VAT Refund Position'}</span>
              <span className="inv-stat-value">{fmt(Math.abs(data.netVatPosition))}</span>
            </div>
          </div>
          <div className="settings-info-box">
            <span>
              This reflects only journal entries actually posted to the ledger — it is not itself a VAT201 submission, and doesn't replace your accountant's or tax practitioner's review before filing.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function VatRegisterTab({ fetcher, path, kind }) {
  const range = useVatRange();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetcher(range.params));
    } catch (err) {
      console.error('VAT register fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate, fetcher]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const outputColumns = [
    { key: 'date', label: 'Date', render: fmtDate },
    { key: 'journalNumber', label: 'Journal' },
    { key: 'type', label: 'Type', render: (v) => <StatusBadge tone={v === 'refund' ? 'warning' : 'success'} label={v === 'refund' ? 'Refund' : 'Sale'} /> },
    { key: 'orderNumber', label: 'Order' },
    { key: 'customerName', label: 'Customer', render: (v, row) => v ? <div><p style={{ fontWeight: 600 }}>{v}</p><p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{row.customerEmail}</p></div> : '—' },
    { key: 'vatAmount', label: 'VAT Amount', render: (v) => <strong>{fmt(v)}</strong> },
  ];

  const inputColumns = [
    { key: 'date', label: 'Date', render: fmtDate },
    { key: 'journalNumber', label: 'Journal' },
    { key: 'purchaseRef', label: 'Purchase Ref' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'totalCost', label: 'Purchase Total', render: fmt },
    { key: 'vatAmount', label: 'VAT Amount', render: (v) => <strong>{fmt(v)}</strong> },
  ];

  const total = kind === 'output' ? data?.totalOutputVat : data?.totalInputVat;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <DateRangeFilter range={range} />
        <ExportButtons path={path} params={range.params} filename={kind === 'output' ? 'output-vat-register' : 'input-vat-register'} />
      </div>
      {loading ? (
        <LoadingState label="Loading VAT register..." />
      ) : !data ? (
        <EmptyState title="Could not load VAT register" description="Check the server connection and try again." />
      ) : (
        <>
          <div className="inv-stat-grid vat-stat-grid" style={{ marginBottom: '20px' }}>
            <div className="inv-stat">
              <span className="inv-stat-label">{kind === 'output' ? 'Total Output VAT' : 'Total Input VAT'}</span>
              <span className="inv-stat-value">{fmt(total)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">Transactions</span>
              <span className="inv-stat-value">{data.rows.length}</span>
            </div>
          </div>
          <DataTable
            columns={kind === 'output' ? outputColumns : inputColumns}
            data={data.rows}
            emptyState={<EmptyState title="No transactions" description="Nothing posted to this VAT account in the selected range." />}
          />
        </>
      )}
    </div>
  );
}

export function VatReports() {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="vat-reports-page">
      <PageHeader
        icon={<Receipt size={22} />}
        title="VAT Reports"
        subtitle="Output and input VAT, read directly from the General Ledger — ready to hand to a bookkeeper or tax practitioner for a VAT201 submission."
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
        {activeTab === 'summary' && <VatSummaryTab />}
        {activeTab === 'output' && <VatRegisterTab fetcher={sarsApi.vatOutputRegister} path="/admin/sars/vat/output-register" kind="output" />}
        {activeTab === 'input' && <VatRegisterTab fetcher={sarsApi.vatInputRegister} path="/admin/sars/vat/input-register" kind="input" />}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
<<<<<<< HEAD
        .stmt-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-5); flex-wrap: wrap; }
        .stmt-tab {
          display: flex; align-items: center; gap: var(--sp-2); padding: 10px var(--sp-4);
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-muted); font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease);
        }
        .stmt-tab:hover { color: var(--y-base); border-color: var(--y-base); }
        .stmt-tab--active { color: var(--y-base); border-color: var(--y-base); background: rgba(var(--y-rgb), 0.08); }

        .aging-filters { display: flex; align-items: center; gap: 10px; margin-bottom: var(--sp-5); font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap; }
        .aging-filters .admin-input { width: auto; }
        .vat-stat-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: var(--sp-5); }
        .inv-stat-grid { display: grid; gap: var(--sp-4); }
        .inv-stat { padding: 14px; background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); display: flex; flex-direction: column; gap: 6px; }
        .inv-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .inv-stat-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
        .settings-info-box {
          display: flex; align-items: center; gap: var(--sp-2);
          background: rgba(var(--y-rgb),0.08); border: 1px solid rgba(var(--y-rgb),0.2);
          padding: var(--sp-3); border-radius: var(--r); font-size: 0.8rem; color: var(--text-muted);
        }

        @media (max-width: 480px) {
          .stmt-tab { flex: 1 1 calc(50% - var(--sp-2)); justify-content: center; }
          .aging-filters { gap: var(--sp-2); }
=======
        .stmt-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .stmt-tab {
          display: flex; align-items: center; gap: 8px; padding: 10px 16px;
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          color: var(--color-text-muted); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: var(--transition);
        }
        .stmt-tab:hover { color: var(--color-primary); border-color: var(--color-primary); }
        .stmt-tab--active { color: var(--color-primary); border-color: var(--color-primary); background: rgba(184, 155, 106, 0.08); }

        .aging-filters { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; font-size: 0.8rem; color: var(--color-text-muted); flex-wrap: wrap; }
        .aging-filters .admin-input { width: auto; }
        .vat-stat-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px; }
        .inv-stat-grid { display: grid; gap: 16px; }
        .inv-stat { padding: 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; }
        .inv-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
        .inv-stat-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
        .settings-info-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(184,155,106,0.08); border: 1px solid rgba(184,155,106,0.2);
          padding: 12px; border-radius: 4px; font-size: 0.8rem; color: var(--color-text-muted);
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
        }
      `}} />
    </div>
  );
}

export default VatReports;
