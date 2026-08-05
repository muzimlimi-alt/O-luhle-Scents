import React, { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { PieChart, TrendingUp, Scale, Waves } from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TABS = [
  { id: 'income', label: 'Income Statement', icon: <TrendingUp size={16} /> },
  { id: 'balance', label: 'Balance Sheet', icon: <Scale size={16} /> },
  { id: 'cashflow', label: 'Cash Flow', icon: <Waves size={16} /> },
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
      `}} />
    </div>
  );
}

export default FinancialStatements;
