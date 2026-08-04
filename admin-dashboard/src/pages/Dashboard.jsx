import React, { useEffect, useState } from 'react';
import { metricsApi, ordersApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useMessaging } from '../context/MessagingContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users,
  ShoppingCart,
  Wallet,
  AlertTriangle,
  LayoutDashboard,
  Zap,
  Mail,
  Package,
  Ban,
  TrendingUp,
  TrendingDown,
  ListOrdered,
  PieChart,
  DollarSign
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

export function Dashboard() {
  const { showMessage } = useMessaging();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
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
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAllMetrics() {
      try {
        const [metrics, predictions, abandoned, analyticsData, orders] = await Promise.all([
          metricsApi.dashboard(),
          metricsApi.predictions(),
          metricsApi.abandoned(),
          metricsApi.analytics(30).catch(() => null),
          ordersApi.list().catch(() => [])
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
          setAnalytics(analyticsData);
        }
      } catch (err) {
        console.warn('Dashboard metrics failed:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAllMetrics();
    return () => { isMounted = false; };
  }, []);

  const handleRecovery = async (orderId) => {
    try {
      await metricsApi.sendRecovery(orderId);
      showMessage('success', 'Recovery Email Sent', 'The customer has been notified about their abandoned cart.');
      window.location.reload(); // Simple refresh for state
    } catch (err) {
      showMessage('error', 'Send Failed', err.message);
    }
  };

  const revenueGrowth = analytics?.revenue?.growth ?? null;
  const funnel = analytics?.funnel || [];

  const revenueChartData = {
    labels: analytics?.daily.map(d => d.date) || [],
    datasets: [{
      label: 'Daily Revenue (R)',
      data: analytics?.daily.map(d => d.revenue) || [],
      borderColor: '#d4af37',
      backgroundColor: 'rgba(212, 175, 55, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
    }]
  };

  if (loading) return <LoadingState label="Loading dashboard..." />;

  return (
    <div className="dashboard-page">
      <PageHeader icon={<LayoutDashboard size={22} />} title="Overview" subtitle="Store performance and business analytics at a glance." />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Total Revenue</span>
            <div className="kpi-icon-wrap icon--revenue">
              <Wallet size={20} />
            </div>
          </div>
          <h3 className="kpi-value">R{data.revenue.toLocaleString()}</h3>
          {revenueGrowth === null ? (
            <p className="kpi-subtext">Last 30 days</p>
          ) : (
            <p className="kpi-subtext kpi-trend">
              <span className={`kpi-trend-value ${revenueGrowth >= 0 ? 'kpi-trend-value--up' : 'kpi-trend-value--down'}`}>
                {revenueGrowth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(revenueGrowth)}%
              </span>
              vs last month
            </p>
          )}
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Average Order Value</span>
            <div className="kpi-icon-wrap icon--revenue">
              <DollarSign size={20} />
            </div>
          </div>
          <h3 className="kpi-value">R{Number(analytics?.revenue?.average || 0).toLocaleString()}</h3>
          <p className="kpi-subtext">Across paid orders</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Total Orders</span>
            <div className="kpi-icon-wrap icon--orders">
              <ShoppingCart size={20} />
            </div>
          </div>
          <h3 className="kpi-value">{data.orders.toLocaleString()}</h3>
          <p className="kpi-subtext">Lifetime total</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Total Customers</span>
            <div className="kpi-icon-wrap icon--customers">
              <Users size={20} />
            </div>
          </div>
          <h3 className="kpi-value">{data.customers.toLocaleString()}</h3>
          <p className="kpi-subtext">Registered accounts</p>
        </div>

        <div className="kpi-card" style={{ borderColor: data.lowStock > 0 ? 'rgba(192, 57, 43, 0.4)' : '' }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Low Stock Items</span>
            <div className="kpi-icon-wrap icon--stock">
              <AlertTriangle size={20} />
            </div>
          </div>
          <h3 className="kpi-value" style={{ color: data.lowStock > 0 ? 'var(--color-error-text)' : '' }}>{data.lowStock}</h3>
          <p className="kpi-subtext">{data.lowStock > 0 ? 'At or below reorder level' : 'Inventory healthy'}</p>
        </div>

        <div className="kpi-card" style={{ borderColor: data.outOfStock > 0 ? 'rgba(192, 57, 43, 0.4)' : '' }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Out of Stock</span>
            <div className="kpi-icon-wrap icon--stock">
              <Ban size={20} />
            </div>
          </div>
          <h3 className="kpi-value" style={{ color: data.outOfStock > 0 ? 'var(--color-error-text)' : '' }}>{data.outOfStock}</h3>
          <p className="kpi-subtext">Available stock at zero</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Stock Value</span>
            <div className="kpi-icon-wrap icon--revenue">
              <Package size={20} />
            </div>
          </div>
          <h3 className="kpi-value">R{data.stockValue.toLocaleString()}</h3>
          <p className="kpi-subtext">On-hand units at cost price</p>
        </div>
      </div>

      <div className="dashboard-charts-grid">
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Revenue Growth (Last 30 Days)</h3>
          <div style={{ height: '300px' }}>
            <Line
              data={revenueChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(184, 155, 106, 0.15)' },
                    ticks: { color: theme === 'dark' ? 'rgba(232, 226, 216, 0.55)' : '#4a4640' }
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: theme === 'dark' ? 'rgba(232, 226, 216, 0.55)' : '#4a4640' }
                  }
                },
                plugins: {
                  legend: {
                    labels: { color: theme === 'dark' ? '#f5f0e8' : '#1a1611' }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Zap size={20} color="var(--color-primary)" />
            <h3 style={{ margin: 0 }}>Predictive Replenishment</h3>
          </div>
          <div className="notif-list">
             {data.predictions.map((p, idx) => (
               <div key={idx} className="notif-item" style={{ borderLeft: p.daysRemaining < 10 ? '3px solid var(--color-error)' : '3px solid var(--color-primary)' }}>
                  <p style={{ fontWeight: 600 }}>{p.productName} ({p.size})</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Out of stock in approx. <strong>{p.daysRemaining} days</strong> ({new Date(p.predictionDate).toLocaleDateString()})
                  </p>
               </div>
             ))}
             {data.predictions.length === 0 && <EmptyState title="Not enough data yet" description="Predictions appear once there's enough sales history to model." />}
          </div>
        </div>
      </div>

      <div className="dashboard-charts-grid">
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Top Performing Products</h3>
          <DataTable
            columns={[
              { key: 'name', label: 'Product', render: (val) => <span style={{ fontWeight: 600 }}>{val}</span> },
              { key: 'totalUnits', label: 'Units Sold' },
              { key: 'totalRevenue', label: 'Revenue Generated', render: (val) => <span style={{ color: 'var(--color-primary-text)' }}>R{Number(val).toLocaleString()}</span> },
            ]}
            data={analytics?.topProducts || []}
            emptyState={<EmptyState title="Not enough sales yet" description="Top products appear once orders start coming in." />}
          />
        </div>

        <div className="card">
           <h3 style={{ marginBottom: '20px' }}>Customer Retention</h3>
           {analytics?.retention?.rate === null || analytics?.retention == null ? (
             <EmptyState title="Not enough data yet" description="Retention appears once repeat customers start ordering." />
           ) : (
             <div style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: '8px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem', fontWeight: 700 }}>
                   {analytics.retention.rate}%
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  {analytics.retention.rate}% of customers in the last 30 days are returning purchasers ({analytics.retention.returning} of {analytics.retention.activeCustomers}).
                </p>
             </div>
           )}
        </div>
      </div>

      <div className="dashboard-charts-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <ListOrdered size={20} color="var(--color-primary)" />
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

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <PieChart size={20} color="var(--color-primary)" />
            <h3 style={{ margin: 0 }}>Order Status Breakdown</h3>
          </div>
          <div className="funnel-list">
            {funnel.map(f => {
              const pct = data.orders > 0 ? Math.round((f.count / data.orders) * 100) : 0;
              const tone = STATUS_TONE[f.status] || 'neutral';
              return (
                <div key={f.status} className="funnel-row">
                  <div className="funnel-row-label">
                    <StatusBadge tone={tone} label={f.status?.toUpperCase()} />
                    <span className="funnel-count">{f.count}</span>
                  </div>
                  <div className="funnel-bar-track">
                    <div className={`funnel-bar-fill funnel-bar-fill--${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {funnel.length === 0 && <EmptyState title="No orders yet" description="Order status breakdown will appear here once orders start coming in." />}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
           <Mail size={20} color="var(--color-primary)" />
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
        .dashboard-charts-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-bottom: 24px; }
        .dashboard-charts-grid > .card { min-width: 0; }
        @media (max-width: 900px) {
          .dashboard-charts-grid { grid-template-columns: 1fr; }
        }

        .kpi-trend { display: flex; align-items: center; gap: 6px; }
        .kpi-trend-value { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; }
        .kpi-trend-value--up { color: var(--color-success-text); }
        .kpi-trend-value--down { color: var(--color-error-text); }

        .funnel-list { display: flex; flex-direction: column; gap: 16px; }
        .funnel-row { display: flex; flex-direction: column; gap: 6px; }
        .funnel-row-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .funnel-count { font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
        .funnel-bar-track { height: 6px; border-radius: 3px; background: var(--color-border-light); overflow: hidden; }
        .funnel-bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        .funnel-bar-fill--success { background: var(--color-success-text); }
        .funnel-bar-fill--warning { background: var(--color-warning-text); }
        .funnel-bar-fill--error { background: var(--color-error-text); }
        .funnel-bar-fill--info { background: var(--color-info-text); }
        .funnel-bar-fill--neutral { background: var(--color-text-muted); }
      `}} />
    </div>
  );
}
