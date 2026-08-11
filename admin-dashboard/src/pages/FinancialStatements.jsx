<<<<<<< HEAD
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { financeApi, approvalsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { useAppearance } from '../context/AppearanceContext';
import { getChartColors } from '../utils/chartTheme';
import { TrendingUp, Scale, Waves, Lock, Unlock, Wallet, Percent, RotateCcw, FileSearch, Download } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
=======
import { useState, useEffect, useCallback } from 'react';
import { financeApi, approvalsApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { PieChart, TrendingUp, Scale, Waves, Lock, Unlock } from 'lucide-react';
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COGS_ACCOUNT_CODE = '5000'; // "Cost of Goods Sold" — server/src/scripts/seed_chart_of_accounts.js
const BUCKET_TONE = { 'Current (0-30)': 'success', '31-60 days': 'warning', '61-90 days': 'warning', '90+ days': 'error' };

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
              <span className="inv-stat-value" style={{ color: data.netProfit >= 0 ? '#2ecc71' : 'var(--error-text)' }}>{fmt(data.netProfit)}</span>
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

<<<<<<< HEAD
const PERIOD_OPTIONS = [
  { months: 3, label: 'Last 3 months' },
  { months: 6, label: 'Last 6 months' },
  { months: 12, label: 'Last 12 months' },
];

function FinanceOverview() {
  const { appearance } = useAppearance();
  const [chartColors, setChartColors] = useState(getChartColors);
  useEffect(() => { setChartColors(getChartColors()); }, [appearance]);

  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState(null); // income statement over the whole window
  const [monthly, setMonthly] = useState([]); // [{ label, revenue, cogs }]
  const [receivables, setReceivables] = useState(null);

  const periodStart = useMemo(() => DateTime.now().minus({ months }).startOf('month'), [months]);
  const periodEnd = useMemo(() => DateTime.now().endOf('day'), []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const fromIso = periodStart.toISODate();
      const toIso = periodEnd.toISODate();

      const monthRanges = Array.from({ length: months }, (_, i) => {
        const m = DateTime.now().minus({ months: months - 1 - i });
        return { label: m.toFormat('LLL'), from: m.startOf('month').toISODate(), to: m.endOf('month').toISODate() };
      });

      const [totalsRes, cashFlowRes, receivablesRes, ...monthlyRes] = await Promise.all([
        financeApi.incomeStatement({ from: fromIso, to: toIso }),
        financeApi.cashFlow({ from: fromIso, to: toIso }).catch(() => null),
        financeApi.agedReceivables().catch(() => null),
        ...monthRanges.map((r) => financeApi.incomeStatement({ from: r.from, to: r.to }).catch(() => null)),
      ]);

      const refundsLine = (cashFlowRes?.operating || []).find((r) => /refund/i.test(r.label || r.sourceType || ''));

      setTotals({
        revenue: totalsRes.totalRevenue,
        totalExpenses: totalsRes.totalExpenses,
        cogs: (totalsRes.expenses || []).find((e) => e.code === COGS_ACCOUNT_CODE)?.amount || 0,
        refunds: refundsLine ? Math.abs(refundsLine.amount) : null,
      });
      setReceivables(receivablesRes);
      setMonthly(monthRanges.map((r, i) => ({
        label: r.label,
        revenue: monthlyRes[i]?.totalRevenue || 0,
        cogs: (monthlyRes[i]?.expenses || []).find((e) => e.code === COGS_ACCOUNT_CODE)?.amount || 0,
      })));
    } catch (err) {
      console.error('Finance overview fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [periodStart, periodEnd, months]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const grossMargin = totals && totals.revenue > 0 ? ((totals.revenue - totals.cogs) / totals.revenue) * 100 : null;
  const netProfit = totals ? totals.revenue - totals.totalExpenses : null;

  const handleExportStatement = () => {
    const rows = [['Month', 'Revenue', 'COGS'], ...monthly.map((m) => [m.label, m.revenue.toFixed(2), m.cogs.toFixed(2)])];
    rows.push([]);
    rows.push(['Gross revenue', totals?.revenue.toFixed(2) || '0']);
    rows.push(['Gross margin %', grossMargin != null ? grossMargin.toFixed(1) : '—']);
    rows.push(['Refunds', totals?.refunds != null ? totals.refunds.toFixed(2) : '—']);
    rows.push(['Net profit', netProfit != null ? netProfit.toFixed(2) : '—']);
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `toca-finance-statement-${periodStart.toISODate()}-to-${periodEnd.toISODate()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: monthly.map((m) => m.label),
    datasets: [
      { label: 'Revenue', data: monthly.map((m) => m.revenue), backgroundColor: chartColors.accent },
      { label: 'COGS', data: monthly.map((m) => m.cogs), backgroundColor: chartColors.textMuted },
    ],
  };

  if (loading) return <LoadingState label="Loading finance overview..." />;

  return (
    <div className="finance-overview">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Revenue</li><li aria-current="page">Finance</li></ol>
          <h1>Finance</h1>
          <p className="sub">{periodStart.toFormat('LLL yyyy')} – {periodEnd.toFormat('LLL yyyy')}</p>
        </div>
        <div className="head-actions">
          <label className="vh" htmlFor="fRange">Period</label>
          <select className="select" id="fRange" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {PERIOD_OPTIONS.map((opt) => <option key={opt.months} value={opt.months}>{opt.label}</option>)}
          </select>
          <button type="button" className="btn-outline btn-sm" onClick={handleExportStatement}>
            <Download size={14} /> Statement
          </button>
        </div>
      </div>

      <div className="grid kpi-row mb-6">
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Gross revenue</h2><span className="ic" aria-hidden="true"><Wallet size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{fmt(totals?.revenue)}</p>
          <p className="kpi-foot">Over the selected period</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Gross margin</h2><span className="ic" aria-hidden="true"><Percent size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{grossMargin != null ? `${grossMargin.toFixed(1)}%` : '—'}</p>
          <p className="kpi-foot">Revenue less cost of goods sold</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Refunds</h2><span className="ic" aria-hidden="true"><RotateCcw size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{totals?.refunds != null ? fmt(totals.refunds) : '—'}</p>
          <p className="kpi-foot">{totals?.refunds != null && totals.revenue > 0 ? `${((totals.refunds / totals.revenue) * 100).toFixed(1)}% of gross` : 'No refund activity posted'}</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Net profit</h2><span className="ic" aria-hidden="true"><TrendingUp size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{netProfit != null ? fmt(netProfit) : '—'}</p>
          <p className="kpi-foot">Revenue less all expenses</p>
        </article>
      </div>

      <div className="grid g-83 mb-6">
        <section className="card">
          <div className="card-head">
            <div><h3>Revenue against <em>cost of goods</em></h3><p className="hint">{PERIOD_OPTIONS.find((o) => o.months === months)?.label} · ZAR</p></div>
          </div>
          <div className="card-body">
            <div style={{ height: '260px' }}>
              <Bar
                key={`${appearance.finish}-${appearance.accent}-${months}`}
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { grid: { color: chartColors.grid }, ticks: { color: chartColors.textMuted } },
                    x: { grid: { display: false }, ticks: { color: chartColors.textMuted } },
                  },
                  plugins: { legend: { labels: { color: chartColors.heading } } },
                }}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div><h3>Tax &amp; <em>compliance</em></h3><p className="hint">One home for VAT, not three</p></div></div>
          <div className="card-body">
            <p className="tax-link-note">
              Output/input VAT, net position, transaction registers and reporting deadlines live on the SARS Compliance
              pages — not duplicated here, so there's one number to trust instead of three that can drift apart.
            </p>
            <div className="tax-link-list">
              <Link to="/sars/vat" className="btn-outline btn-sm tax-link">
                <FileSearch size={14} /> VAT Reports &amp; registers
              </Link>
              <Link to="/sars" className="btn-outline btn-sm tax-link">
                <Scale size={14} /> SARS Compliance dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="card mb-6">
        <div className="card-head">
          <div><h3>Outstanding <em>receivables</em></h3><p className="hint">Unpaid and partially-paid orders, by age</p></div>
          {receivables?.rows?.length > 0 && <span className="pill warn">{receivables.rows.length} open</span>}
        </div>
        <div className="card-body flush">
          <div className="t-scroll">
            <table className="tbl">
              <caption className="vh">Outstanding customer balances by age</caption>
              <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col" className="num">Outstanding</th><th scope="col" className="num">Days</th><th scope="col">Age</th></tr></thead>
              <tbody>
                {(receivables?.rows || []).map((r) => (
                  <tr key={r.orderId}>
                    <th scope="row" className="tbl-rowhead mono strong">#{r.orderNumber}</th>
                    <td>{r.customerName}</td>
                    <td className="num strong">{fmt(r.amountOutstanding)}</td>
                    <td className="num">{r.daysOutstanding}</td>
                    <td><span className={`pill ${BUCKET_TONE[r.bucket] === 'error' ? 'bad' : BUCKET_TONE[r.bucket] === 'warning' ? 'warn' : 'ok'}`}>{r.bucket}</span></td>
                  </tr>
                ))}
                {(!receivables?.rows || receivables.rows.length === 0) && (
                  <tr><td colSpan={5} style={{ padding: 0 }}><EmptyState title="No outstanding balances" description="All orders are fully paid." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

=======
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
export function FinancialStatements() {
  const [activeTab, setActiveTab] = useState('income');

  return (
    <div className="statements-page">
      <FinanceOverview />

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
        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .finance-overview { margin-bottom: var(--sp-7); padding-bottom: var(--sp-6); border-bottom: 1px solid var(--border-low); }
        .finance-overview .card { border-color: var(--border-low); }
        .mb-6 { margin-bottom: var(--sp-6); }

        .page-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--sp-5); flex-wrap: wrap;
          padding-bottom: var(--sp-5); margin-bottom: var(--sp-6);
          border-bottom: 1px solid var(--border-low);
        }
        .page-head h1 { font-size: 2rem; }
        .page-head .sub { color: var(--text-muted); font-size: .9rem; margin-top: var(--sp-2); }
        .crumbs { display: flex; align-items: center; gap: var(--sp-2); font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 var(--sp-3); padding: 0; }
        .crumbs li { list-style: none; display: flex; align-items: center; gap: var(--sp-2); }
        .crumbs li + li::before { content: "/"; color: var(--border-strong); }
        .crumbs [aria-current] { color: var(--y-base); }
        .head-actions { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }

        .select {
          height: var(--tap); padding: 0 36px 0 var(--sp-4);
          background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-primary); font-family: var(--f-body); font-weight: 300; font-size: .86rem;
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
          background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%;
          background-size: 5px 5px; background-repeat: no-repeat;
        }
        .select:hover { border-color: var(--border-strong); }
        .select:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

        .btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
          min-height: var(--tap); padding: 0 var(--sp-5);
          border-radius: var(--r); font-size: .86rem; font-weight: 400;
          letter-spacing: .06em; text-transform: uppercase;
          border: 1px solid var(--border-strong); color: var(--text-primary); background: none; cursor: pointer;
          transition: all var(--t-fast) var(--ease); white-space: nowrap;
        }
        .btn-outline:hover { border-color: var(--y-base); background: var(--y-base); color: var(--text-inverse); }
        .btn-sm { min-height: 36px; padding: 0 var(--sp-4); font-size: .74rem; }
        .btn-outline:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

        .tax-link-note { color: var(--text-muted); font-size: .82rem; line-height: 1.6; margin: 0 0 var(--sp-5); }
        .tax-link-list { display: flex; flex-direction: column; gap: var(--sp-3); }
        .tax-link { justify-content: flex-start; text-decoration: none; width: 100%; }
        .tax-link:hover { text-decoration: none; }

        .grid { display: grid; gap: var(--sp-5); }
        .kpi-row { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .g-83 { grid-template-columns: 2.1fr 1fr; }
        @media (max-width: 1180px) { .g-83 { grid-template-columns: 1fr; } }

        .kpi {
          position: relative; padding: var(--sp-5);
          background: var(--bg-surface); border: 1px solid var(--border-low); border-radius: var(--r);
          overflow: hidden; transition: border-color var(--t-fast) var(--ease), transform var(--t) var(--ease-out);
        }
        .kpi:hover { border-color: var(--y-dark); transform: translateY(-2px); }
        .kpi-top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
        .kpi-label { font-size: .68rem; letter-spacing: .2em; text-transform: uppercase; color: var(--text-muted); font-weight: 400; margin: 0; }
        .kpi-top .ic { color: var(--y-base); opacity: .8; display: inline-flex; }
        .kpi-val { font-family: var(--f-display); line-height: 1.05; margin: var(--sp-4) 0 var(--sp-2); letter-spacing: -.01em; color: var(--text-primary); }
        .kpi-foot { font-size: .78rem; color: var(--text-muted); margin: 0; }

        .card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low); flex-wrap: wrap; }
        .card-head h3 { font-size: 1.15rem; }
        .card-head .hint { font-size: .76rem; color: var(--text-muted); margin-top: 2px; }
        .card-body { padding: var(--sp-5); }
        .card-body.flush { padding: 0; }

        .stat-list { list-style: none; margin: 0; padding: 0; }
        .stat-list li { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-low); font-size: .86rem; color: var(--text-secondary); }
        .stat-list li:last-child { border-bottom: 0; }
        .stat-list .v { font-family: var(--f-mono); color: var(--text-primary); font-size: .88rem; }

        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th { text-align: left; font-weight: 400; font-size: .66rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-default); white-space: nowrap; background: var(--bg-section); }
        .tbl th.num, .tbl td.num { text-align: right; }
        .tbl td, .tbl th.tbl-rowhead { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-low); color: var(--text-secondary); vertical-align: middle; font-weight: 400; text-align: left; }
        .tbl tbody tr:hover { background: rgba(255, 255, 255, .028); }
        .tbl tbody tr:last-child td, .tbl tbody tr:last-child th { border-bottom: 0; }
        .tbl .strong { color: var(--text-primary); }
        .tbl .num, .tbl .mono { font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-size: .83rem; }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.ok { color: var(--success); border-color: rgba(var(--ok-rgb), .4); background: rgba(var(--ok-rgb), .09); }
        .pill.warn { color: var(--warning); border-color: rgba(var(--warn-rgb), .4); background: rgba(var(--warn-rgb), .09); }
        .pill.bad { color: var(--error); border-color: rgba(var(--bad-rgb), .4); background: rgba(var(--bad-rgb), .09); }

        .stmt-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .stmt-tab {
          display: flex; align-items: center; gap: 8px; padding: 10px 16px;
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-muted); font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: var(--transition);
        }
        .stmt-tab:hover { color: var(--y-base); border-color: var(--y-base); }
        .stmt-tab--active { color: var(--y-base); border-color: var(--y-base); background: rgba(var(--y-rgb), 0.08); }
        .stmt-filters { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted); }
        .stmt-filters .admin-input { width: auto; }
        .stmt-total { font-size: 0.85rem; color: var(--y-base); margin-left: 8px; }
        .stmt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        .stmt-grid--three { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .stmt-grid h3 { margin: 0 0 12px; font-size: 1rem; }

        .finance-stat-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 20px; }
        .inv-stat-grid { display: grid; gap: 16px; }
        .inv-stat { padding: 14px; background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); display: flex; flex-direction: column; gap: 6px; }
        .inv-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .inv-stat-value { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }

        .cashflow-section { margin-bottom: 16px; }
        .cashflow-section__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .cashflow-section__header h3 { margin: 0; font-size: 1rem; }
        .cashflow-empty { color: var(--text-muted); font-size: 0.8rem; margin: 0; }
        .report-list { display: flex; flex-direction: column; gap: 8px; }
        .report-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); }
        .report-row-title { font-size: 0.85rem; }
        .report-row-value { font-size: 0.85rem; font-weight: 700; }

<<<<<<< HEAD
        .periods-intro { font-size: 0.85rem; color: var(--text-muted); margin: 0 0 20px; max-width: 70ch; }
        .periods-approvals { background: rgba(var(--y-rgb),0.08); border: 1px solid rgba(var(--y-rgb),0.2); border-radius: var(--r); padding: 14px 16px; margin-bottom: 20px; }
        .periods-approvals h3 { margin: 0 0 10px; font-size: 0.85rem; }
        .periods-approval-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; font-size: 0.82rem; flex-wrap: wrap; }
        .periods-approval-actions { display: flex; gap: 8px; }
        .periods-approval-hint { color: var(--text-muted); font-size: 0.78rem; font-style: italic; }
=======
        .periods-intro { font-size: 0.85rem; color: var(--color-text-muted); margin: 0 0 20px; max-width: 70ch; }
        .periods-approvals { background: rgba(184,155,106,0.08); border: 1px solid rgba(184,155,106,0.2); border-radius: 4px; padding: 14px 16px; margin-bottom: 20px; }
        .periods-approvals h3 { margin: 0 0 10px; font-size: 0.85rem; }
        .periods-approval-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; font-size: 0.82rem; flex-wrap: wrap; }
        .periods-approval-actions { display: flex; gap: 8px; }
        .periods-approval-hint { color: var(--color-text-muted); font-size: 0.78rem; font-style: italic; }
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
      `}} />
    </div>
  );
}

export default FinancialStatements;
