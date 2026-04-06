import React, { useEffect, useState } from 'react';
import { metricsApi } from '../services/api';
import { 
  Users, 
  ShoppingCart, 
  Wallet, 
  AlertTriangle,
  TrendingUp,
  Zap,
  Mail
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function Dashboard() {
  const [data, setData] = useState({
    revenue: 0,
    orders: 0,
    customers: 0,
    lowStock: 0,
    recentOrders: [],
    predictions: [],
    abandoned: []
  });

  useEffect(() => {
    let isMounted = true;

    async function loadAllMetrics() {
      try {
        const [metrics, predictions, abandoned] = await Promise.all([
          metricsApi.dashboard(),
          metricsApi.predictions(),
          metricsApi.abandoned()
        ]);
        
        if (isMounted) {
          setData({
            revenue: metrics.revenue || 0,
            orders: metrics.orders || 0,
            customers: metrics.customers || 0,
            lowStock: metrics.lowStock || 0,
            recentOrders: metrics.recentOrders || [],
            predictions: predictions || [],
            abandoned: abandoned || []
          });
        }
      } catch (err) {
        console.warn('Dashboard metrics failed:', err.message);
      }
    }

    loadAllMetrics();
    return () => { isMounted = false; };
  }, []);

  const handleRecovery = async (orderId) => {
    try {
      await metricsApi.sendRecovery(orderId);
      alert('Recovery email sent!');
      window.location.reload(); // Simple refresh for state
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Monthly Revenue (R)',
      data: [65000, 59000, 80000, 81000, 56000, 75000],
      backgroundColor: 'rgba(184, 155, 106, 0.4)',
      borderColor: '#b89b6a',
      borderWidth: 1,
      borderRadius: 2,
    }]
  };

  return (
    <div className="dashboard-page">
      <div className="content-header">
        <h2 className="page-title">Dashboard</h2>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Total Revenue</span>
            <div className="kpi-icon-wrap icon--revenue">
              <Wallet size={20} />
            </div>
          </div>
          <h3 className="kpi-value">R{data.revenue.toLocaleString()}</h3>
          <p className="kpi-subtext">Last 30 days</p>
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
          <p className="kpi-subtext">{data.lowStock > 0 ? 'Stock < 5 units' : 'Inventory healthy'}</p>
        </div>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Revenue Analytics</h3>
          <div style={{ height: '300px' }}>
            <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
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
             {data.predictions.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Not enough sales data for predictions.</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
           <Mail size={20} color="var(--color-primary)" />
           <h3 style={{ margin: 0 }}>Abandoned Cart Recovery Opportunities</h3>
        </div>
        <div className="table-responsive">
           <table className="modern-table">
              <thead>
                 <tr>
                    <th>Customer</th>
                    <th>Abandoned Since</th>
                    <th>Potential Value</th>
                    <th>Items</th>
                    <th>Action</th>
                 </tr>
              </thead>
              <tbody>
                 {data.abandoned.map(order => (
                   <tr key={order.id}>
                      <td>{order.customer?.name || order.customer?.email || 'Guest'}</td>
                      <td>{new Date(order.createdAt).toLocaleString()}</td>
                      <td>R{Number(order.totalAmount).toLocaleString()}</td>
                      <td>{order.items.length} items</td>
                      <td>
                         <button className="btn btn--primary btn--sm" onClick={() => handleRecovery(order.id)}>
                            Send Recovery Email
                         </button>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
           {data.abandoned.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>No abandoned carts found.</p>}
        </div>
      </div>
    </div>
  );
}
