import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateTime } from 'luxon';
import { metricsApi, ordersApi, testimonialsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { useAppearance } from '../context/AppearanceContext';
import { getChartColors } from '../utils/chartTheme';
import {
  Wallet,
  ShoppingCart,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Zap,
  Mail,
  ListOrdered,
  PieChart,
  Users,
  Plus,
  Download,
  ShoppingBag,
  Star,
  AlertTriangle,
  Ban
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const STATUS_TONE = {
  pending: 'neutral',
  paid: 'success',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
};

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
];

function daysForPeriod(period) {
  if (period === 'ytd') {
    const start = new Date(new Date().getFullYear(), 0, 1);
    return Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000));
  }
  return Number(period);
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Normalizes a series of numbers into an SVG polyline points string for the
// KPI sparklines — real per-day values from the analytics endpoint, not
// decorative/fabricated curves.
function sparkPoints(values) {
  if (!values || values.length < 2) return '';
  const w = 120, h = 38, pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  return values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function Sparkline({ values, tone = 'accent', label }) {
  const points = sparkPoints(values);
  if (!points) return <div className="spark spark--empty" aria-hidden="true" />;
  return (
    <svg className="spark" viewBox="0 0 120 38" role="img" aria-label={label}>
      <polyline points={points} fill="none" className={tone === 'accent' ? 's-accent' : 's-mute'} strokeWidth="1.6" />
    </svg>
  );
}

export function Dashboard() {
  const { showMessage } = useMessaging();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { appearance } = useAppearance();
  // AppearanceProvider applies its <html> classes in a useLayoutEffect, which
  // React guarantees flushes before this component's (passive) useEffect —
  // so by the time this reads getComputedStyle, the tokens are already the
  // ones for the new finish/accent, never a stale prior frame.
  const [chartColors, setChartColors] = useState(getChartColors);
  useEffect(() => {
    setChartColors(getChartColors());
  }, [appearance]);

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [data, setData] = useState({
    revenue: 0,
    orders: 0,
    customers: 0,
    lowStock: 0,
    outOfStock: 0,
    stockValue: 0,
    predictions: [],
    abandoned: []
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Everything except the period-driven analytics call — fetched once.
  useEffect(() => {
    let isMounted = true;

    async function loadCore() {
      try {
        const [metrics, predictions, abandoned, orders, testimonials, analyticsData] = await Promise.all([
          metricsApi.dashboard(),
          metricsApi.predictions(),
          metricsApi.abandoned(),
          ordersApi.list().catch(() => []),
          testimonialsApi.list().catch(() => []),
          metricsApi.analytics(daysForPeriod(period)).catch(() => null),
        ]);

        if (isMounted) {
          setData({
            revenue: metrics.revenue || 0,
            orders: metrics.orders || 0,
            customers: metrics.customers || 0,
            lowStock: metrics.lowStock || 0,
            outOfStock: metrics.outOfStock || 0,
            stockValue: metrics.stockValue || 0,
            predictions: predictions || [],
            abandoned: abandoned || []
          });
          setRecentOrders((orders || []).slice(0, 6));
          setReviews((testimonials || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5));
          setAnalytics(analyticsData);
        }
      } catch (err) {
        console.warn('Dashboard metrics failed:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCore();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetches only the analytics slice when the reporting period changes —
  // the mount effect above already covers the initial period.
  const isFirstPeriodRun = useRef(true);
  useEffect(() => {
    if (isFirstPeriodRun.current) { isFirstPeriodRun.current = false; return undefined; }
    let isMounted = true;
    setAnalyticsLoading(true);
    metricsApi.analytics(daysForPeriod(period))
      .then((d) => { if (isMounted) setAnalytics(d); })
      .catch(() => { if (isMounted) setAnalytics(null); })
      .finally(() => { if (isMounted) setAnalyticsLoading(false); });
    return () => { isMounted = false; };
  }, [period]);

  const handleRecovery = async (orderId) => {
    try {
      await metricsApi.sendRecovery(orderId);
      showMessage('success', 'Recovery Email Sent', 'The customer has been notified about their abandoned cart.');
      window.location.reload(); // Simple refresh for state
    } catch (err) {
      showMessage('error', 'Send Failed', err.message);
    }
  };

  const handleExport = () => {
    const rows = [['Date', 'Orders', 'Revenue'], ...(analytics?.daily || []).map((d) => [d.date, d.count, d.revenue])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `toca-overview-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const funnel = analytics?.funnel || [];
  const unfulfilled = funnel.filter((f) => ['pending', 'paid'].includes(f.status)).reduce((s, f) => s + f.count, 0);
  const revenueGrowth = analytics?.revenue?.growth ?? null;
  const daily = analytics?.daily || [];
  const dailyRevenue = daily.map((d) => d.revenue);
  const dailyOrders = daily.map((d) => d.count);
  const dailyAOV = daily.map((d) => (d.count > 0 ? d.revenue / d.count : 0));

  const activity = useMemo(() => {
    const orderEvents = recentOrders.map((o) => ({
      id: `order-${o.id}`,
      icon: <ShoppingBag size={14} />,
      time: o.createdAt,
      text: <><b>Order #{o.id.slice(0, 8).toUpperCase()}</b> placed — R{Number(o.totalAmount).toLocaleString()} ({o.customer?.name || o.customer?.email || 'Guest'})</>,
    }));
    const reviewEvents = reviews.map((t) => ({
      id: `review-${t.id}`,
      icon: <Star size={14} />,
      time: t.createdAt,
      text: <><b>New testimonial</b> from {t.name}</>,
    }));
    return [...orderEvents, ...reviewEvents]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 8);
  }, [recentOrders, reviews]);

  const revenueChartData = {
    labels: daily.map((d) => d.date),
    datasets: [{
      label: 'Daily Revenue (R)',
      data: dailyRevenue,
      borderColor: chartColors.accent,
      backgroundColor: chartColors.accentMuted,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
    }]
  };

  if (loading) return <LoadingState label="Loading dashboard..." />;

  return (
    <div className="dashboard-page">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Insight</li><li aria-current="page">Analytics overview</li></ol>
          <h1>{greetingWord()}, <em>{(user?.name || 'Administrator').split(' ')[0]}</em></h1>
          <p className="sub">
            {DateTime.now().toFormat('cccc, d LLLL yyyy')} — {unfulfilled} order{unfulfilled === 1 ? '' : 's'} await fulfilment
            {data.lowStock > 0 && <> and <AlertTriangle size={13} className="sub-icon" /> {data.lowStock} item{data.lowStock === 1 ? ' is' : 's are'} below reorder point</>}.
          </p>
        </div>
        <div className="head-actions">
          <label className="vh" htmlFor="range">Reporting period</label>
          <select className="select" id="range" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button type="button" className="btn-outline btn-sm" onClick={handleExport}>
            <Download size={14} /> Export
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/products')}>
            <Plus size={14} /> New product
          </button>
        </div>
      </div>

      <div className={`grid g-4 mb-6 ${analyticsLoading ? 'is-loading' : ''}`}>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Net revenue</h2><span className="ic" aria-hidden="true"><Wallet size={16} /></span></div>
          <p className="kpi-val">R {data.revenue.toLocaleString()}</p>
          <p className="kpi-foot">
            {revenueGrowth === null ? <span className="delta flat">—</span> : (
              <span className={`delta ${revenueGrowth >= 0 ? 'up' : 'down'}`}>
                {revenueGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(revenueGrowth)}%
              </span>
            )} vs. previous month
          </p>
          <Sparkline values={dailyRevenue} label="Net revenue trend for the selected period" />
        </article>

        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Orders</h2><span className="ic" aria-hidden="true"><ShoppingCart size={16} /></span></div>
          <p className="kpi-val">{data.orders.toLocaleString()}</p>
          <p className="kpi-foot"><span className="delta flat">{unfulfilled} unfulfilled</span></p>
          <Sparkline values={dailyOrders} label="Order volume trend for the selected period" />
        </article>

        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Avg. order value</h2><span className="ic" aria-hidden="true"><DollarSign size={16} /></span></div>
          <p className="kpi-val">R {Number(analytics?.revenue?.average || 0).toLocaleString()}</p>
          <p className="kpi-foot"><span className="delta flat">Across paid orders</span></p>
          <Sparkline values={dailyAOV} tone="mute" label="Average order value trend for the selected period" />
        </article>

        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Stock value</h2><span className="ic" aria-hidden="true"><Package size={16} /></span></div>
          <p className="kpi-val">R {data.stockValue.toLocaleString()}</p>
          <p className="kpi-foot">
            <span className={`delta ${data.lowStock > 0 ? 'down' : 'flat'}`}>{data.lowStock} low · {data.outOfStock} out</span>
          </p>
        </article>

        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Total customers</h2><span className="ic" aria-hidden="true"><Users size={16} /></span></div>
          <p className="kpi-val">{data.customers.toLocaleString()}</p>
          <p className="kpi-foot"><span className="delta flat">Registered accounts</span></p>
        </article>

        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Low stock items</h2><span className="ic" aria-hidden="true"><AlertTriangle size={16} /></span></div>
          <p className="kpi-val">{data.lowStock}</p>
          <p className="kpi-foot">
            <span className={`delta ${data.lowStock > 0 ? 'down' : 'flat'}`}>{data.lowStock > 0 ? 'At or below reorder level' : 'Inventory healthy'}</span>
          </p>
        </article>

        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Out of stock</h2><span className="ic" aria-hidden="true"><Ban size={16} /></span></div>
          <p className="kpi-val">{data.outOfStock}</p>
          <p className="kpi-foot">
            <span className={`delta ${data.outOfStock > 0 ? 'down' : 'flat'}`}>Available stock at zero</span>
          </p>
        </article>
      </div>

      <div className="grid g-83 mb-6">
        <section className="card">
          <div className="card-head">
            <div><h3>Revenue <em>trajectory</em></h3><p className="hint">Net of refunds and discounts · ZAR</p></div>
          </div>
          <div className="card-body">
            <div style={{ height: '280px' }}>
              <Line
                key={`${appearance.finish}-${appearance.accent}-${period}`}
                data={revenueChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      grid: { color: chartColors.grid },
                      ticks: { color: chartColors.textMuted }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: chartColors.textMuted }
                    }
                  },
                  plugins: {
                    legend: {
                      labels: { color: chartColors.heading }
                    }
                  }
                }}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div><h3><PieChart size={16} className="card-head-ic" /> Order <em>status</em></h3><p className="hint">Share of all orders</p></div></div>
          <div className="card-body">
            <div className="bars">
              {funnel.map((f) => {
                const pct = data.orders > 0 ? Math.round((f.count / data.orders) * 100) : 0;
                return (
                  <div key={f.status} className="bar-row">
                    <span className="lbl"><StatusBadge tone={STATUS_TONE[f.status] || 'neutral'} label={f.status?.toUpperCase()} /></span>
                    <span className="bar-track"><span className="bar-fill" style={{ width: `${pct}%` }} role="img" aria-label={`${pct} percent`} /></span>
                    <span className="num">{f.count}</span>
                  </div>
                );
              })}
              {funnel.length === 0 && <EmptyState title="No orders yet" description="Order status breakdown will appear here once orders start coming in." />}
            </div>
            {analytics?.retention?.rate != null && (
              <ul className="stat-list" style={{ marginTop: 'var(--sp-6)' }}>
                <li>Repeat purchase rate <span className="v">{analytics.retention.rate}%</span></li>
                <li>Active customers ({period === 'ytd' ? 'YTD' : `${daysForPeriod(period)}d`}) <span className="v">{analytics.retention.activeCustomers}</span></li>
                <li>Total customers <span className="v">{data.customers.toLocaleString()}</span></li>
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid g-83 mb-6">
        <section className="card">
          <div className="card-head"><div><h3>Best-selling <em>fragrances</em></h3><p className="hint">All time, by units sold</p></div></div>
          <div className="card-body flush">
            <div className="t-scroll">
              <table className="tbl">
                <caption className="vh">Best-selling products by units and revenue</caption>
                <thead><tr><th scope="col">Product</th><th scope="col">SKU</th><th scope="col" className="num">Units</th><th scope="col" className="num">Revenue</th></tr></thead>
                <tbody>
                  {(analytics?.topProducts || []).map((p) => (
                    <tr key={p.variantId || p.sku || p.name}>
                      <td><span className="mono-thumb" aria-hidden="true">{p.name?.charAt(0) || '?'}</span> {p.name}</td>
                      <td className="mono">{p.sku}</td>
                      <td className="num">{p.totalUnits}</td>
                      <td className="num strong">R {Number(p.totalRevenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!analytics?.topProducts || analytics.topProducts.length === 0) && (
                <EmptyState title="Not enough sales yet" description="Top products appear once orders start coming in." />
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div><h3>Live <em>activity</em></h3></div><span className="pill ok">Live</span></div>
          <div className="card-body flush">
            <ul className="feed">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className="fi" aria-hidden="true">{item.icon}</span>
                  <span className="ft">{item.text}</span>
                  <time dateTime={item.time}>{DateTime.fromISO(item.time).toRelative()}</time>
                </li>
              ))}
              {activity.length === 0 && <EmptyState title="No recent activity" description="Orders and testimonials will appear here as they come in." />}
            </ul>
          </div>
        </section>
      </div>

      <div className="dashboard-charts-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Zap size={20} color="var(--y-base)" />
            <h3 style={{ margin: 0 }}>Predictive Replenishment</h3>
          </div>
          <div className="notif-list">
             {data.predictions.map((p, idx) => (
               <div key={idx} className="notif-item" style={{ borderLeft: p.daysRemaining < 10 ? '3px solid var(--error)' : '3px solid var(--y-base)' }}>
                  <p style={{ fontWeight: 400 }}>{p.productName} ({p.size})</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Out of stock in approx. <strong>{p.daysRemaining} days</strong> ({new Date(p.predictionDate).toLocaleDateString()})
                  </p>
               </div>
             ))}
             {data.predictions.length === 0 && <EmptyState title="Not enough data yet" description="Predictions appear once there's enough sales history to model." />}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Users size={20} color="var(--y-base)" />
            <h3 style={{ margin: 0 }}>Customer Retention</h3>
          </div>
           {analytics?.retention?.rate === null || analytics?.retention == null ? (
             <EmptyState title="Not enough data yet" description="Retention appears once repeat customers start ordering." />
           ) : (
             <div style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: '8px solid var(--y-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem', fontFamily: 'var(--f-display)', fontWeight: 400 }}>
                   {analytics.retention.rate}%
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {analytics.retention.rate}% of customers in the selected period are returning purchasers ({analytics.retention.returning} of {analytics.retention.activeCustomers}).
                </p>
             </div>
           )}
        </div>
      </div>

      <div className="dashboard-charts-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <ListOrdered size={20} color="var(--y-base)" />
            <h3 style={{ margin: 0 }}>Recent Orders</h3>
          </div>
          <DataTable
            columns={[
              { key: 'id', label: 'Order', render: (val) => <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>#{val.slice(0, 8).toUpperCase()}</span> },
              { key: 'customer', label: 'Customer', render: (val) => val?.name || val?.email || 'Guest' },
              { key: 'totalAmount', label: 'Total', render: (val) => `R${Number(val).toLocaleString()}` },
              { key: 'status', label: 'Status', render: (val) => <StatusBadge tone={STATUS_TONE[val] || 'neutral'} label={val?.toUpperCase()} /> },
              { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
            ]}
            data={recentOrders}
            emptyState={<EmptyState title="No orders yet" description="New orders will appear here as they come in." />}
          />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
           <Mail size={20} color="var(--y-base)" />
           <h3 style={{ margin: 0 }}>Abandoned Cart Recovery Opportunities</h3>
        </div>
        <DataTable
          columns={[
            { key: 'customer', label: 'Customer', render: (val) => val?.name || val?.email || 'Guest' },
            { key: 'createdAt', label: 'Abandoned Since', render: (val) => new Date(val).toLocaleString() },
            { key: 'totalAmount', label: 'Potential Value', render: (val) => `R${Number(val).toLocaleString()}` },
            { key: 'items', label: 'Items', render: (val) => `${val.length} items` },
          ]}
          data={data.abandoned}
          emptyState={<EmptyState title="No abandoned carts" description="Recoverable checkouts will appear here." />}
          actions={(order) => (
            <button className="btn btn--primary btn--sm" onClick={() => handleRecovery(order.id)}>
              Send Recovery Email
            </button>
          )}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .dashboard-page .card { border-color: var(--border-low); }

        .page-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--sp-5); flex-wrap: wrap;
          padding-bottom: var(--sp-5); margin-bottom: var(--sp-6);
          border-bottom: 1px solid var(--border-low);
        }
        .page-head h1 { font-size: 2rem; }
        .page-head .sub { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: var(--text-muted); font-size: .9rem; margin-top: var(--sp-2); }
        .sub-icon { color: var(--warning); vertical-align: -2px; margin: 0 2px; }
        .crumbs { display: flex; align-items: center; gap: var(--sp-2); font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 var(--sp-3); padding: 0; }
        .crumbs li { list-style: none; display: flex; align-items: center; gap: var(--sp-2); }
        .crumbs li + li::before { content: "/"; color: var(--border-strong); }
        .crumbs [aria-current] { color: var(--y-base); }
        .head-actions { display: flex; align-items: center; gap: var(--sp-3); }

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
        .select:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }

        .btn-primary, .btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
          min-height: var(--tap); padding: 0 var(--sp-5);
          border-radius: var(--r); font-size: .86rem; font-weight: 400;
          letter-spacing: .06em; text-transform: uppercase;
          border: 1px solid transparent; cursor: pointer;
          transition: all var(--t-fast) var(--ease); white-space: nowrap;
        }
        .btn-primary { background: var(--y-base); color: var(--text-inverse); font-weight: 500; }
        .btn-primary:hover { background: var(--y-hover); box-shadow: 0 6px 22px rgba(var(--y-rgb), .3); }
        .btn-outline { border-color: var(--border-strong); color: var(--text-primary); background: none; }
        .btn-outline:hover { border-color: var(--y-base); background: var(--y-base); color: var(--text-inverse); }
        .btn-sm { min-height: 36px; padding: 0 var(--sp-4); font-size: .74rem; }
        .btn-primary:focus-visible, .btn-outline:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }

        .grid { display: grid; gap: var(--sp-5); }
        .g-4 { grid-template-columns: repeat(4, 1fr); }
        .g-83 { grid-template-columns: 2.1fr 1fr; }
        .mb-6 { margin-bottom: var(--sp-6); }
        @media (max-width: 1360px) { .g-4 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 1180px) { .g-83 { grid-template-columns: 1fr; } }

        .kpi {
          position: relative; padding: var(--sp-5);
          background: var(--bg-surface); border: 1px solid var(--border-low); border-radius: var(--r-md, 10px);
          overflow: hidden; transition: border-color .2s ease, box-shadow .25s ease;
        }
        .kpi::after {
          content: ""; position: absolute; inset: 0;
          background: radial-gradient(120% 90% at 100% 0%, rgba(var(--y-rgb), .07), transparent 60%);
          pointer-events: none; opacity: 0; transition: opacity .25s ease;
        }
        .kpi:hover { border-color: var(--y-dark); box-shadow: var(--sh-sm); }
        .kpi:hover::after { opacity: 1; }
        .kpi-top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
        .kpi-label { font-size: .68rem; letter-spacing: .2em; text-transform: uppercase; color: var(--text-muted); font-weight: 400; margin: 0; }
        .kpi-top .ic { color: var(--y-base); opacity: .8; display: inline-flex; }
        .kpi-val { font-family: var(--f-display); font-size: 2.2rem; line-height: 1.05; margin: var(--sp-4) 0 var(--sp-2); letter-spacing: -.01em; color: var(--text-primary); }
        .kpi-foot { display: flex; align-items: center; gap: var(--sp-2); font-size: .78rem; color: var(--text-muted); flex-wrap: wrap; margin: 0; }
        .delta { display: inline-flex; align-items: center; gap: 5px; font-family: var(--f-mono); font-size: .74rem; font-weight: 500; }
        .delta.up { color: var(--success); }
        .delta.down { color: var(--error); }
        .delta.flat { color: var(--text-muted); }
        .spark { display: block; width: 100%; height: 38px; margin-top: var(--sp-4); }
        .spark--empty { height: 38px; margin-top: var(--sp-4); }
        .s-accent { stroke: var(--y-base); }
        .s-mute { stroke: var(--text-muted); }
        .is-loading { opacity: .55; pointer-events: none; transition: opacity var(--t-fast) var(--ease); }

        .card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low); flex-wrap: wrap; }
        .card-head h3 { font-size: 1.15rem; display: flex; align-items: center; gap: 8px; }
        .card-head-ic { color: var(--y-base); }
        .card-head .hint { font-size: .76rem; color: var(--text-muted); margin-top: 2px; }
        .card-body { padding: var(--sp-5); }
        .card-body.flush { padding: 0; }

        .bars { display: flex; flex-direction: column; gap: var(--sp-4); }
        .bar-row { display: grid; grid-template-columns: 130px 1fr 50px; align-items: center; gap: var(--sp-4); font-size: .84rem; }
        .bar-track { height: 8px; background: var(--bg-elevated); border-radius: var(--r-pill); overflow: hidden; }
        .bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--y-dark), var(--y-base)); border-radius: var(--r-pill); }
        .bar-row .num { text-align: right; font-family: var(--f-mono); font-size: .8rem; color: var(--text-muted); }
        .bar-row .lbl { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .stat-list { list-style: none; margin: 0; padding: 0; }
        .stat-list li { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-low); font-size: .86rem; color: var(--text-secondary); }
        .stat-list li:last-child { border-bottom: 0; }
        .stat-list .v { font-family: var(--f-mono); color: var(--text-primary); font-size: .88rem; }

        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th { text-align: left; font-weight: 400; font-size: .66rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-default); white-space: nowrap; background: var(--bg-section); }
        .tbl th.num, .tbl td.num { text-align: right; }
        .tbl td { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-low); color: var(--text-secondary); vertical-align: middle; }
        .tbl tbody tr:hover { background: rgba(var(--y-rgb), .03); }
        .tbl tbody tr:last-child td { border-bottom: 0; }
        .tbl .strong { color: var(--text-primary); }
        .tbl .num, .tbl .mono { font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-size: .83rem; }
        .mono-thumb {
          display: inline-grid; place-items: center; width: 28px; height: 28px;
          border-radius: 50%;
          background: linear-gradient(160deg, rgba(var(--y-rgb), .18), rgba(var(--y-rgb), .04));
          font-family: var(--f-display); font-size: .85rem; color: var(--y-light);
          margin-right: 8px; vertical-align: middle;
        }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.ok { color: var(--success); border-color: rgba(var(--ok-rgb), .4); background: rgba(var(--ok-rgb), .09); }

        .feed { list-style: none; margin: 0; padding: 0; }
        .feed li { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-low); }
        .feed li:last-child { border-bottom: 0; }
        .feed .fi { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 50%; background: rgba(var(--y-rgb), .08); color: var(--y-base); }
        .feed .ft { flex: 1; min-width: 0; font-size: .86rem; color: var(--text-secondary); line-height: 1.45; }
        .feed .ft b { color: var(--text-primary); font-weight: 400; }
        .feed time { font-family: var(--f-mono); font-size: .7rem; color: var(--text-muted); white-space: nowrap; }

        .dashboard-charts-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-bottom: 24px; }
        .dashboard-charts-grid > .card { min-width: 0; }
        @media (max-width: 900px) {
          .dashboard-charts-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
