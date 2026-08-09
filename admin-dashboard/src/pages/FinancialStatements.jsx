import { useState, useEffect, useCallback } from 'react';
import { financeApi, approvalsApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { PieChart, TrendingUp, Scale, Waves, Lock, Unlock } from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TABS = [
  { id: 'income', label: 'Income Statement', icon: <TrendingUp size={16} /> },
  { id: 'balance', label: 'Balance Sheet', icon: <Scale size={16} /> },
  { id: 'cashflow', label: 'Cash Flow', icon: <Waves size={16} /> },
  { id: 'periods', label: 'Fiscal Periods', icon: <Lock size={16} /> },
];

function IncomeStatementTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      setData(await financeApi.incomeStatement(params));
    } catch (err) {
      console.error('Income statement fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <div className="stmt-filters">
        <input type="date" className="admin-input" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <span>to</span>
        <input type="date" className="admin-input" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
      </div>

      {loading ? <LoadingState label="Calculating income statement..." /> : !data ? null : (
        <>
          <div className="inv-stat-grid finance-stat-grid">
            <div className="inv-stat">
              <span className="inv-stat-label">Total Revenue</span>
              <span className="inv-stat-value">{fmt(data.totalRevenue)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">Total Expenses</span>
              <span className="inv-stat-value">{fmt(data.totalExpenses)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">Net Profit</span>
              <span className="inv-stat-value" style={{ color: data.netProfit >= 0 ? '#2ecc71' : 'var(--color-error-text)' }}>{fmt(data.netProfit)}</span>
            </div>
          </div>

          <div className="stmt-grid">
            <div>
              <h3>Revenue</h3>
              <DataTable columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', render: fmt }]} data={data.revenue} />
            </div>
            <div>
              <h3>Expenses</h3>
              <DataTable columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Account' }, { key: 'amount', label: 'Amount', render: fmt }]} data={data.expenses} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BalanceSheetTab() {
  const [asOf, setAsOf] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await financeApi.balanceSheet(asOf || undefined));
    } catch (err) {
      console.error('Balance sheet fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sectionCols = [
    { key: 'code', label: 'Code', render: (v) => v || '—' },
    { key: 'name', label: 'Account' },
    { key: 'balance', label: 'Balance', render: fmt },
  ];

  return (
    <div>
      <div className="stmt-filters">
        <label>As of</label>
        <input type="date" className="admin-input" value={asOf} onChange={e => setAsOf(e.target.value)} />
        {data && <StatusBadge tone={data.balanced ? 'success' : 'error'} label={data.balanced ? 'Balanced' : 'Out of balance'} />}
      </div>

      {loading ? <LoadingState label="Calculating balance sheet..." /> : !data ? null : (
        <div className="stmt-grid stmt-grid--three">
          <div>
            <h3>Assets <span className="stmt-total">{fmt(data.totalAssets)}</span></h3>
            <DataTable columns={sectionCols} data={data.assets} />
          </div>
          <div>
            <h3>Liabilities <span className="stmt-total">{fmt(data.totalLiabilities)}</span></h3>
            <DataTable columns={sectionCols} data={data.liabilities} />
          </div>
          <div>
            <h3>Equity <span className="stmt-total">{fmt(data.totalEquity)}</span></h3>
            <DataTable columns={sectionCols} data={data.equity} />
          </div>
        </div>
      )}
    </div>
  );
}

function CashFlowTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      setData(await financeApi.cashFlow(params));
    } catch (err) {
      console.error('Cash flow fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const renderSection = (title, rows, net) => (
    <div className="card cashflow-section">
      <div className="cashflow-section__header">
        <h3>{title}</h3>
        <strong>{fmt(net)}</strong>
      </div>
      {rows.length > 0 ? (
        <div className="report-list">
          {rows.map((r, i) => (
            <div key={i} className="report-row">
              <span className="report-row-title">{r.label || r.sourceType}</span>
              <span className="report-row-value">{fmt(r.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="cashflow-empty">None yet.</p>
      )}
    </div>
  );

  return (
    <div>
      <div className="stmt-filters">
        <input type="date" className="admin-input" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <span>to</span>
        <input type="date" className="admin-input" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
        {data && <StatusBadge tone={data.reconciles ? 'success' : 'error'} label={data.reconciles ? 'Reconciles' : 'Does not reconcile'} />}
      </div>

      {loading ? <LoadingState label="Calculating cash flow..." /> : !data ? null : (
        <>
          <div className="inv-stat-grid finance-stat-grid">
            <div className="inv-stat">
              <span className="inv-stat-label">Opening Cash</span>
              <span className="inv-stat-value">{fmt(data.openingCash)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">Net Change</span>
              <span className="inv-stat-value">{fmt(data.netChangeInCash)}</span>
            </div>
            <div className="inv-stat">
              <span className="inv-stat-label">Closing Cash</span>
              <span className="inv-stat-value">{fmt(data.closingCash)}</span>
            </div>
          </div>

          {renderSection('Operating Activities', data.operating, data.netOperating)}
          {renderSection('Investing Activities', data.investing, data.netInvesting)}
          {renderSection('Financing Activities', data.financing, data.netFinancing)}
          {data.other?.length > 0 && renderSection('Unclassified', data.other, data.netOther)}
        </>
      )}
    </div>
  );
}

function FiscalPeriodsTab() {
  const { showMessage } = useMessaging();
  const { user } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [reopenRequests, setReopenRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [periodsData, approvals] = await Promise.all([
        financeApi.fiscalPeriods(),
        approvalsApi.list().catch(() => []), // don't let a stale/legacy refund approval break this tab
      ]);
      setPeriods(periodsData);
      setReopenRequests(approvals.filter(a => a.entityType === 'REOPEN_PERIOD'));
    } catch (err) {
      console.error('Fiscal periods fetch failed:', err.message);
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pendingReopenFor = (periodId) => reopenRequests.find(r => r.payload?.periodId === periodId);

  const handleClose = async (period) => {
    if (!window.confirm(`Close ${period.label}? This sweeps its net ${period.previewNetProfit >= 0 ? 'income' : 'loss'} of ${fmt(Math.abs(period.previewNetProfit))} into Retained Earnings and blocks any further postings dated inside it. Reopening afterward requires a second admin's approval.`)) return;
    setBusyId(period.id);
    try {
      await financeApi.closePeriod(period.id);
      showMessage('success', 'Period Closed', `${period.label} is now closed.`);
      fetchAll();
    } catch (err) {
      showMessage('error', 'Close Failed', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestReopen = async (period) => {
    setBusyId(period.id);
    try {
      await financeApi.requestPeriodReopen(period.id);
      showMessage('success', 'Reopen Requested', `Waiting on a different administrator to approve reopening ${period.label}.`);
      fetchAll();
    } catch (err) {
      showMessage('error', 'Request Failed', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDecide = async (requestId, approve) => {
    setBusyId(requestId);
    try {
      if (approve) await approvalsApi.approve(requestId);
      else await approvalsApi.reject(requestId, 'Declined from Fiscal Periods');
      showMessage('success', approve ? 'Reopen Approved' : 'Reopen Rejected', '');
      fetchAll();
    } catch (err) {
      showMessage('error', 'Action Failed', err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading fiscal periods..." />;

  return (
    <div>
      <p className="periods-intro">
        A period auto-opens the first time something posts into it, and blocks new postings once closed. Close oldest-to-newest — closing sweeps that period's net income into Retained Earnings, which is also what turns the Balance Sheet's "Net Income (undistributed)" line into a real, permanent figure.
      </p>

      {reopenRequests.length > 0 && (
        <div className="periods-approvals">
          <h3>Pending Reopen Requests</h3>
          {reopenRequests.map(r => (
            <div key={r.id} className="periods-approval-row">
              <span>{r.payload?.periodLabel} — requested by {r.requestedBy?.name || 'an administrator'}</span>
              {r.requestedById === user?.id ? (
                <span className="periods-approval-hint">Waiting on a different administrator</span>
              ) : (
                <div className="periods-approval-actions">
                  <button className="btn-sm" disabled={busyId === r.id} onClick={() => handleDecide(r.id, true)}>Approve</button>
                  <button className="btn-sm" disabled={busyId === r.id} onClick={() => handleDecide(r.id, false)}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr><th>Period</th><th>Date Range</th><th>Status</th><th>Net Income (if closed now)</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {periods.map(p => {
              const pending = pendingReopenFor(p.id);
              return (
                <tr key={p.id}>
                  <td><strong>{p.label}</strong></td>
                  <td>{new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}</td>
                  <td><StatusBadge tone={p.status === 'OPEN' ? 'success' : 'neutral'} icon={p.status === 'OPEN' ? <Unlock size={12} /> : <Lock size={12} />} label={p.status} /></td>
                  <td>{p.status === 'OPEN' ? fmt(p.previewNetProfit) : '—'}</td>
                  <td>
                    {p.status === 'OPEN' ? (
                      <button className="btn-sm" disabled={busyId === p.id} onClick={() => handleClose(p)}>Close Period</button>
                    ) : pending ? (
                      <span className="periods-approval-hint">Reopen requested</span>
                    ) : (
                      <button className="btn-sm" disabled={busyId === p.id} onClick={() => handleRequestReopen(p)}>Request Reopen</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FinancialStatements() {
  const [activeTab, setActiveTab] = useState('income');

  return (
    <div className="statements-page">
      <PageHeader
        icon={<PieChart size={22} />}
        title="Financial Statements"
        subtitle="Income Statement, Balance Sheet, and Cash Flow — computed live from the General Ledger."
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
        {activeTab === 'income' && <IncomeStatementTab />}
        {activeTab === 'balance' && <BalanceSheetTab />}
        {activeTab === 'cashflow' && <CashFlowTab />}
        {activeTab === 'periods' && <FiscalPeriodsTab />}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .stmt-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .stmt-tab {
          display: flex; align-items: center; gap: 8px; padding: 10px 16px;
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          color: var(--color-text-muted); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: var(--transition);
        }
        .stmt-tab:hover { color: var(--color-primary); border-color: var(--color-primary); }
        .stmt-tab--active { color: var(--color-primary); border-color: var(--color-primary); background: rgba(184, 155, 106, 0.08); }
        .stmt-filters { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; font-size: 0.8rem; color: var(--color-text-muted); }
        .stmt-filters .admin-input { width: auto; }
        .stmt-total { font-size: 0.85rem; color: var(--color-primary); margin-left: 8px; }
        .stmt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        .stmt-grid--three { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .stmt-grid h3 { margin: 0 0 12px; font-size: 1rem; }

        .finance-stat-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 20px; }
        .inv-stat-grid { display: grid; gap: 16px; }
        .inv-stat { padding: 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; display: flex; flex-direction: column; gap: 6px; }
        .inv-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
        .inv-stat-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }

        .cashflow-section { margin-bottom: 16px; }
        .cashflow-section__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .cashflow-section__header h3 { margin: 0; font-size: 1rem; }
        .cashflow-empty { color: var(--color-text-muted); font-size: 0.8rem; margin: 0; }
        .report-list { display: flex; flex-direction: column; gap: 8px; }
        .report-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; }
        .report-row-title { font-size: 0.85rem; }
        .report-row-value { font-size: 0.85rem; font-weight: 700; }

        .periods-intro { font-size: 0.85rem; color: var(--color-text-muted); margin: 0 0 20px; max-width: 70ch; }
        .periods-approvals { background: rgba(184,155,106,0.08); border: 1px solid rgba(184,155,106,0.2); border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; }
        .periods-approvals h3 { margin: 0 0 10px; font-size: 0.85rem; }
        .periods-approval-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; font-size: 0.82rem; flex-wrap: wrap; }
        .periods-approval-actions { display: flex; gap: 8px; }
        .periods-approval-hint { color: var(--color-text-muted); font-size: 0.78rem; font-style: italic; }
      `}} />
    </div>
  );
}

export default FinancialStatements;
