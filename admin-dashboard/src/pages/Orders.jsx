import React, { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../services/api';
import { ShoppingBag, Eye, User, Search, Truck, X } from 'lucide-react';

const COURIERS = [
  { key: 'THE_COURIER_GUY', name: 'The Courier Guy' },
  { key: 'ARAMEX', name: 'Aramex' },
  { key: 'FEDEX', name: 'FedEx' },
  { key: 'POST_OFFICE', name: 'SAPO' }
];

export function Orders() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillData, setFulfillData] = useState({ trackingNumber: '', courierKey: 'THE_COURIER_GUY', estimatedDelivery: '' });
  const [submitting, setSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const items = await ordersApi.list({ 
        status: statusFilter || undefined, 
        paymentStatus: paymentFilter || undefined 
      });
      setOrders(items);
    } catch (err) {
      console.warn('Orders API failed:', err.message);
    }
  }, [statusFilter, paymentFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenFulfill = (order) => {
    setSelectedOrder(order);
    setShowFulfillModal(true);
  };

  const handleFulfill = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ordersApi.fulfill(selectedOrder.id, fulfillData);
      setShowFulfillModal(false);
      fetchOrders();
    } catch (err) {
      alert('Fulfillment failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="orders-page">
      <div className="content-header">
        <h2 className="page-title">Orders</h2>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px', gap: '16px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
               <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--color-text-muted)' }} />
               <input type="text" className="search-input-classic" placeholder="Filter by customer, ID or tracking..." />
            </div>
            
            <select 
              className="search-input-classic" 
              style={{ paddingLeft: '12px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select 
              className="search-input-classic" 
              style={{ paddingLeft: '12px' }}
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="">All Payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
         </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Tracking</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShoppingBag size={14} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600 }}>#{o.id.substring(0, 8)}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar-classic">
                         <User size={12} color="var(--color-primary)" />
                      </div>
                      {o.customer?.name || 'Guest'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>R{Number(o.totalAmount).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${o.status.toLowerCase()}`}>{o.status}</span>
                  </td>
                  <td>
                    {o.trackingNumber ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                        {o.trackingNumber}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Unfulfilled</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="classic-action-btn" title="View Detail"><Eye size={16} /></button>
                      {o.status === 'PAID' && !o.trackingNumber && (
                        <button 
                          className="btn btn--primary btn--xs" 
                          onClick={() => handleOpenFulfill(o)}
                        >
                          <Truck size={12} style={{ marginRight: '6px' }} /> Ship
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan="6" className="empty-state" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>No orders in queue.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showFulfillModal && (
        <div className="modal-overlay" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>Fulfill Order</h3>
              <button onClick={() => setShowFulfillModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleFulfill}>
               <div style={{ marginBottom: '16px' }}>
                 <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', color: 'var(--color-primary)' }}>Courier</label>
                 <select 
                    style={{ width: '100%', padding: '10px', background: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white' }}
                    value={fulfillData.courierKey} 
                    onChange={e => setFulfillData({...fulfillData, courierKey: e.target.value})}
                    required
                 >
                   {COURIERS.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                 </select>
               </div>
               <div style={{ marginBottom: '16px' }}>
                 <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', color: 'var(--color-primary)' }}>Tracking Number</label>
                 <input 
                   type="text" 
                   style={{ width: '100%', padding: '10px', background: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white' }}
                   value={fulfillData.trackingNumber} 
                   onChange={e => setFulfillData({...fulfillData, trackingNumber: e.target.value})}
                   required 
                   placeholder="e.g. TCG12345678"
                 />
               </div>
               <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                 <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => setShowFulfillModal(false)}>Cancel</button>
                 <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={submitting}>
                   {submitting ? 'Shiping...' : 'Confirm'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .orders-page { animation: fadeIn 0.4s ease-out; }

        .search-input-classic { width: 100%; padding: 10px 12px 10px 40px; background: var(--color-bg-dark); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: white; outline: none; transition: 0.2s; }
        .search-input-classic:focus { border-color: var(--color-primary); background: rgba(184,155,106,0.05); }

        .avatar-classic { width: 24px; height: 24px; border-radius: 50%; background: rgba(184,155,106,0.15); display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); }
      `}} />
    </div>
  );
}

export default Orders;
