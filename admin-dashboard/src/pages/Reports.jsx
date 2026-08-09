import { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import { FileBarChart, Download, Calendar, Loader2, Boxes, AlertTriangle, Ban, TrendingDown, Wallet, PiggyBank } from 'lucide-react';

const FINANCE_PERIODS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '365d', label: 'Last 12 Months' },
  { value: 'all', label: 'All Time' },
];

export function Reports() {
  const { showMessage } = useMessaging();
  const [loading, setLoading] = useState(false);
  const [monthOffset, setMonthOffset] = useState(1);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [financePeriod, setFinancePeriod] = useState('30d');
  const [finance, setFinance] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(true);

  useEffect(() => {
    adminOpsApi.reports.inventorySummary()
      .then(setSummary)
      .catch(err => console.warn('Inventory summary failed:', err.message))
      .finally(() => setSummaryLoading(false));
  }, []);

  useEffect(() => {
    setFinanceLoading(true);
    adminOpsApi.reports.financeSummary(financePeriod)
      .then(setFinance)
      .catch(err => console.warn('Finance summary failed:', err.message))
      .finally(() => setFinanceLoading(false));
  }, [financePeriod]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await adminOpsApi.reports.generate(monthOffset);
      const url = window.URL.createObjectURL(new Blob([response]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `TOCA_Executive_Report_Month_${monthOffset}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMessage('error', 'Report Generation Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reports-page">
      <PageHeader icon={<FileBarChart size={22} />} title="Reports" subtitle="Financial and inventory intelligence for the business." />

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet size={22} color="var(--color-primary)" />
            <h3 style={{ margin: 0 }}>Finance &amp; Margin</h3>
          </div>
          <select
            value={financePeriod}
            onChange={(e) => setFinancePeriod(e.target.value)}
            className="admin-input"
            style={{ width: 'auto' }}
          >
            {FINANCE_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {financeLoading ? (
          <LoadingState label="Calculating margin..." />
        ) : finance ? (
          <>
            <div className="inv-stat-grid finance-stat-grid">
              <div className="inv-stat">
                <span className="inv-stat-label">Revenue</span>
                <span className="inv-stat-value">R{finance.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label">Cost of Goods Sold</span>
                <span className="inv-stat-value">R{finance.cogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label"><PiggyBank size={12} /> Gross Profit</span>
                <span className="inv-stat-value" style={{ color: finance.grossProfit >= 0 ? '#2ecc71' : 'var(--color-error-text)' }}>
                  R{finance.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label">Margin</span>
                <span className="inv-stat-value">{finance.marginPercent.toFixed(1)}%</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label">Allocated Overhead / Unit</span>
                <span className="inv-stat-value">R{(finance.allocatedOverheadPerUnit || 0).toFixed(2)}</span>
              </div>
            </div>

            {finance.costCoveragePercent < 100 && (
              <p className="finance-coverage-note">
                Cost data covers {finance.costCoveragePercent.toFixed(0)}% of line items in this period ({finance.itemsWithCostData} of {finance.itemsTotal}).
                Orders placed before cost snapshotting was introduced don't carry a cost record, so margin above is calculated only from items that have one — it understates true profit if coverage is well below 100%.
              </p>
            )}

            <p className="finance-coverage-note finance-coverage-note--info">
              "True Cost" adds packaging + labelling to purchase cost (COGS); it does not include Allocated Overhead / Unit above (courier + marketing spend), which is a period-wide estimate, not attributed to a specific product.
            </p>

            {finance.topProducts?.length > 0 && (
              <DataTable
                columns={[
                  { key: 'productName', label: 'Product' },
                  { key: 'unitsSold', label: 'Units' },
                  { key: 'revenue', label: 'Revenue', render: (val) => `R${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                  { key: 'cogs', label: 'COGS', render: (val) => val != null ? `R${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—' },
                  { key: 'grossProfit', label: 'Gross Profit', render: (val) => val != null ? `R${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—' },
                  { key: 'marginPercent', label: 'Margin', render: (val) => val != null ? `${val.toFixed(1)}%` : '—' },
                  { key: 'trueCost', label: 'True Cost', render: (val) => val != null ? `R${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—' },
                  { key: 'trueCostMarginPercent', label: 'True Margin', render: (val) => val != null ? `${val.toFixed(1)}%` : '—' },
                ]}
                data={finance.topProducts}
              />
            )}
          </>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Finance summary unavailable.</p>
        )}
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
             <FileBarChart size={24} color="var(--color-primary)" />
             <h3 style={{ margin: 0 }}>Monthly Performance Report</h3>
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Generate a high-fidelity executive report containing revenue analytics, best-selling fragrance variants, and customer acquisition metrics for any previous month.
          </p>

          <div className="form-group" style={{ marginBottom: '20px' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} /> Select Previous Month
             </label>
             <select
               value={monthOffset}
               onChange={(e) => setMonthOffset(parseInt(e.target.value))}
               className="admin-input"
               style={{ marginTop: '8px' }}
             >
                <option value={1}>Last Month</option>
                <option value={2}>2 Months Ago</option>
                <option value={3}>3 Months Ago</option>
             </select>
          </div>

          <button
            className="btn btn--primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            disabled={loading}
            onClick={handleGenerate}
          >
             {loading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
             {loading ? 'Generating Report...' : 'Download PDF Report'}
          </button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Boxes size={22} color="var(--color-primary)" />
            <h3 style={{ margin: 0 }}>Inventory Health</h3>
          </div>
          {summaryLoading ? (
            <LoadingState label="Loading inventory snapshot..." />
          ) : summary ? (
            <div className="inv-stat-grid">
              <div className="inv-stat">
                <span className="inv-stat-label">Stock on Hand</span>
                <span className="inv-stat-value">{summary.stockOnHand.toLocaleString()} units</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label">Stock Value</span>
                <span className="inv-stat-value">R{summary.stockValue.toLocaleString()}</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label">Incoming</span>
                <span className="inv-stat-value" style={{ color: summary.incomingStock > 0 ? '#2ecc71' : '' }}>{summary.incomingStock?.toLocaleString() || 0} units</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label"><AlertTriangle size={12} /> Low Stock</span>
                <span className="inv-stat-value" style={{ color: summary.lowStockCount > 0 ? 'var(--color-error-text)' : '' }}>{summary.lowStockCount}</span>
              </div>
              <div className="inv-stat">
                <span className="inv-stat-label"><Ban size={12} /> Out of Stock</span>
                <span className="inv-stat-value" style={{ color: summary.outOfStockCount > 0 ? 'var(--color-error-text)' : '' }}>{summary.outOfStockCount}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Inventory snapshot unavailable.</p>
          )}
        </div>
      </div>

      {summary && (summary.lowStockItems?.length > 0 || summary.slowMoving?.length > 0) && (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          {summary.lowStockItems?.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <AlertTriangle size={18} color="var(--color-error-text, #c0392b)" />
                <h3 style={{ margin: 0 }}>Low Stock Report</h3>
              </div>
              <div className="report-list">
                {summary.lowStockItems.map(item => (
                  <div key={item.variantId} className="report-row">
                    <div>
                      <span className="report-row-title">{item.productName} ({item.size})</span>
                      <span className="report-row-subtitle">{item.supplier || 'In-House'}{item.incoming > 0 ? ` · +${item.incoming} incoming` : ''}</span>
                    </div>
                    <span className="report-row-value">{item.available} / {item.lowStockThreshold}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.slowMoving?.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <TrendingDown size={18} color="var(--color-text-muted)" />
                <h3 style={{ margin: 0 }}>Slow Moving Products</h3>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                In-stock variants with zero sales in the last 60 days.
              </p>
              <div className="report-list">
                {summary.slowMoving.map(item => (
                  <div key={item.variantId} className="report-row">
                    <span className="report-row-title">{item.productName} ({item.size})</span>
                    <span className="report-row-value">{item.quantity} on hand</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .inv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
        .finance-stat-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: var(--sp-4); }
        .inv-stat { padding: 14px; background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); display: flex; flex-direction: column; gap: 6px; }
        .inv-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
        .inv-stat-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }

        .finance-coverage-note {
          font-size: 0.78rem; color: var(--warning); background: rgba(var(--warn-rgb), 0.1);
          border: 1px solid rgba(var(--warn-rgb), 0.3); border-radius: var(--r); padding: 10px 14px; margin-bottom: var(--sp-4);
        }
        .finance-coverage-note--info {
          color: var(--text-muted); background: var(--bg-section); border-color: var(--border-default);
        }

        .report-list { display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto; }
        .report-row { display: flex; justify-content: space-between; align-items: center; padding: 10px var(--sp-3); background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); }
        .report-row-title { display: block; font-size: 0.85rem; font-weight: 400; }
        .report-row-subtitle { display: block; font-size: 0.7rem; color: var(--text-muted); }
        .report-row-value { font-size: 0.8rem; font-weight: 700; color: var(--y-base); white-space: nowrap; margin-left: var(--sp-3); }

        @media (max-width: 480px) {
          .inv-stat-grid { grid-template-columns: 1fr; }
          .finance-stat-grid { grid-template-columns: 1fr; }
          .report-row { flex-wrap: wrap; gap: var(--sp-1); }
        }
      `}} />
    </div>
  );
}
