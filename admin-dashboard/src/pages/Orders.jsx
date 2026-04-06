import React, { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../services/api';
import { ShoppingBag, Eye, User, Search, Truck, X, Filter, ChevronRight, Hash, Clock, Landmark } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="elite-orders-container animate-fade-in">
      <div className="atelier-header">
        <div className="header-titles">
          <h1 className="couture-text">Order Portfolio</h1>
          <p className="couture-subtext">Precision tracking for global fragrance acquisitions</p>
        </div>
      </div>

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input" 
            placeholder="Discovery via customer, ID or tracking..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-glass-matrix">
           <div className="select-glass-wrapper">
              <Filter size={14} className="glass-icon" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Status: All Acquisitions</option>
                <option value="pending">Pending Review</option>
                <option value="paid">Authorized Payment</option>
                <option value="SHIPPED">In Transit</option>
                <option value="DELIVERED">Clinical Delivery</option>
                <option value="CANCELLED">Voided</option>
              </select>
           </div>

           <div className="select-glass-wrapper">
              <Landmark size={14} className="glass-icon" />
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="">Treasury: All Status</option>
                <option value="unpaid">Awaiting Funds</option>
                <option value="paid">Verified Funds</option>
              </select>
           </div>
        </div>
      </div>

      <div className="atelier-grid">
        {filteredOrders.map(o => (
          <div key={o.id} className="elite-glass order-card fade-in-blur">
            <div className="order-card-header">
              <div className="order-id-tag">
                <Hash size={14} />
                <span>{o.id.substring(0, 8).toUpperCase()}</span>
              </div>
              <span className={`status-indicator ${o.status.toLowerCase()}`}>
                {o.status.toUpperCase()}
              </span>
            </div>

            <div className="order-patron">
              <div className="patron-avatar">
                <User size={18} />
              </div>
              <div className="patron-details">
                <span className="patron-name">{o.customer?.name || 'Private Client'}</span>
                <span className="patron-email">{o.customer?.email || 'Guest Acquisition'}</span>
              </div>
            </div>

            <div className="order-metrics">
              <div className="metric-item">
                <span className="metric-label">Valuation</span>
                <span className="metric-value">R{Number(o.totalAmount).toLocaleString()}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Timestamp</span>
                <span className="metric-value">{new Date(o.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="order-tracking">
              <span className="tracking-label">Logistics Tracking</span>
              <span className="tracking-value">
                {o.trackingNumber || 'Awaiting Fulfillment'}
              </span>
            </div>

            <div className="order-actions">
              <button className="btn-mini-action" title="View Dossier">
                <Eye size={16} /> Inspect
              </button>
              {o.status === 'PAID' && !o.trackingNumber && (
                <button 
                  className="elite-btn-ship" 
                  onClick={() => handleOpenFulfill(o)}
                >
                  <Truck size={14} /> Dispatch
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <div className="elite-empty-state">
            <ShoppingBag size={48} />
            <p>The Order Portfolio remains untarnished.</p>
          </div>
        )}
      </div>

      {showFulfillModal && (
        <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && setShowFulfillModal(false)}>
          <div className="elite-modal glass-panel">
            <div className="modal-top">
              <h2 className="couture-text">Logistics Dispatch</h2>
              <button className="close-btn" onClick={() => setShowFulfillModal(false)}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleFulfill} className="elite-form">
               <div className="elite-input-group">
                 <label className="elite-input-label">Select Logistics Courier</label>
                 <select 
                    className="elite-glass-input"
                    value={fulfillData.courierKey} 
                    onChange={e => setFulfillData({...fulfillData, courierKey: e.target.value})}
                    required
                 >
                   {COURIERS.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                 </select>
               </div>

               <div className="elite-input-group">
                 <label className="elite-input-label">Consignment Tracking Number</label>
                 <input 
                   type="text" 
                   className="elite-glass-input"
                   value={fulfillData.trackingNumber} 
                   onChange={e => setFulfillData({...fulfillData, trackingNumber: e.target.value})}
                   required 
                   placeholder="e.g. TCG-OLUHLE-8849"
                 />
               </div>

               <div className="modal-actions-elite">
                 <button type="submit" className="elite-btn" disabled={submitting}>
                   {submitting ? 'Dispatching...' : 'Confirm Shipment'}
                 </button>
                 <button type="button" className="elite-btn-outline" onClick={() => setShowFulfillModal(false)}>Cancel</button>
               </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-orders-container { 
          padding: 40px; 
          max-width: 1400px; 
          margin: 0 auto; 
          min-height: 100vh;
        }

        .atelier-header { margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }
        
        .atelier-discovery {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          gap: 24px;
        }

        .search-glass-wrapper {
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          flex: 1;
        }
        .search-glass-input {
          background: none; border: none; color: white; width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem;
        }

        .filter-glass-matrix { display: flex; gap: 16px; }
        .select-glass-wrapper {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .select-glass-wrapper select {
          background: none; border: none; color: white; outline: none; cursor: pointer; font-size: 0.85rem;
        }

        .atelier-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 32px;
        }

        .order-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .order-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .order-id-tag { display: flex; align-items: center; gap: 6px; color: var(--color-primary); font-weight: 700; font-family: var(--font-display); }
        
        .status-indicator {
          font-size: 0.65rem; padding: 4px 10px; border-radius: 2px; font-weight: 600; letter-spacing: 1px;
        }
        .status-indicator.pending { background: rgba(184, 155, 106, 0.2); color: var(--color-primary); }
        .status-indicator.paid { background: rgba(39, 174, 96, 0.2); color: #2ecc71; }
        .status-indicator.shipped { background: rgba(41, 128, 185, 0.2); color: #3498db; }

        .order-patron { display: flex; align-items: center; gap: 16px; }
        .patron-avatar { width: 44px; height: 44px; background: rgba(184,155,106,0.1); border: 1px solid var(--color-border-alt); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-primary); }
        .patron-name { display: block; font-weight: 600; font-size: 0.95rem; }
        .patron-email { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        .order-metrics { 
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border);
        }
        .metric-label { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); margin-bottom: 4px; }
        .metric-value { font-weight: 700; color: white; }

        .order-tracking { font-size: 0.8rem; }
        .tracking-label { display: block; font-size: 0.65rem; color: var(--color-text-muted); margin-bottom: 2px; }
        .tracking-value { color: var(--color-primary); font-family: monospace; }

        .order-actions { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
        .btn-mini-action { background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--color-primary); }

        .elite-btn-ship { background: var(--color-primary); color: #000; padding: 8px 16px; border-radius: 4px; border: none; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: var(--transition); }
        .elite-btn-ship:hover { filter: brightness(1.2); transform: translateY(-2px); }

        .elite-overlay { position: fixed; inset: 0; background: rgba(8,7,6,0.92); backdrop-filter: blur(24px); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 24px; animation: eliteFadeIn 0.4s ease-out; }
        .elite-modal { width: 100%; max-width: 440px; padding: 40px; position: relative; }
        .modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        
        .elite-glass-input { width: 100%; background: rgba(255,255,255,0.03); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 12px 16px; color: white; outline: none; transition: var(--transition); font-size: 0.9rem; }
        .elite-glass-input:focus { border-color: var(--color-primary); background: rgba(184,155,106,0.05); }

        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
        .elite-btn { background: var(--color-primary); color: #000; padding: 14px; border: none; border-radius: 4px; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; transition: var(--transition); }
        .elite-btn:hover { filter: brightness(1.2); }
        .elite-btn-outline { background: none; border: 1px solid var(--color-border); color: white; padding: 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; transition: var(--transition); }
        .elite-btn-outline:hover { background: rgba(255,255,255,0.05); }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}

export default Orders;
