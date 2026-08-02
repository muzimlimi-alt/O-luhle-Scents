import React, { useState, useEffect, useCallback } from 'react';
import { ordersApi, adminOpsApi } from '../services/api';
import { Modal } from '../components/Modal';
import { ShoppingBag, Eye, User, Search, Truck, Filter, ChevronRight, Hash, Clock, Landmark, RotateCcw } from 'lucide-react';

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
  const [returnOrder, setReturnOrder] = useState(null); // full order detail with items+returnItems
  const [returnLines, setReturnLines] = useState({}); // { [orderItemId]: { quantity, condition, note } }
  const [returnSubmitting, setReturnSubmitting] = useState(false);

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

  const remainingReturnable = (item) => {
    const alreadyReturned = (item.returnItems || []).reduce((sum, r) => sum + r.quantity, 0);
    return item.quantity - alreadyReturned;
  };

  const handleOpenReturn = async (order) => {
    try {
      const detail = await ordersApi.getDetail(order.id);
      setReturnOrder(detail);
      const initialLines = {};
      (detail.items || []).forEach(item => {
        initialLines[item.id] = { quantity: 0, condition: 'GOOD', note: '' };
      });
      setReturnLines(initialLines);
    } catch (err) {
      alert('Failed to load order detail: ' + err.message);
    }
  };

  const updateReturnLine = (itemId, field, value) => {
    setReturnLines(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleSubmitReturns = async (e) => {
    e.preventDefault();
    const toProcess = Object.entries(returnLines).filter(([, line]) => parseInt(line.quantity) > 0);
    if (!toProcess.length) return alert('Enter a quantity for at least one item to return.');

    setReturnSubmitting(true);
    try {
      for (const [orderItemId, line] of toProcess) {
        await adminOpsApi.returns.create({
          orderItemId,
          quantity: parseInt(line.quantity),
          condition: line.condition,
          note: line.note || undefined
        });
      }
      setReturnOrder(null);
      fetchOrders();
    } catch (err) {
      alert('Return processing failed: ' + err.message);
    } finally {
      setReturnSubmitting(false);
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
              {o.status === 'paid' && !o.trackingNumber && (
                <button
                  className="elite-btn-ship"
                  onClick={() => handleOpenFulfill(o)}
                >
                  <Truck size={14} /> Dispatch
                </button>
              )}
              {['paid', 'SHIPPED', 'DELIVERED'].includes(o.status) && (
                <button className="btn-mini-action" onClick={() => handleOpenReturn(o)}>
                  <RotateCcw size={14} /> Return
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

      <Modal isOpen={showFulfillModal} onClose={() => setShowFulfillModal(false)} title="Logistics Dispatch" maxWidth={440}>
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
      </Modal>

      <Modal isOpen={!!returnOrder} onClose={() => setReturnOrder(null)} title="Process Return" maxWidth={560}>
        <p className="return-subtitle">{returnOrder && `Order #${returnOrder.id.substring(0, 8).toUpperCase()} — ${returnOrder.shippingAddress ? `${returnOrder.customer?.name || 'Guest'}` : ''}`}</p>

        <form onSubmit={handleSubmitReturns} className="elite-form">
          {returnOrder?.items?.map(item => {
            const remaining = remainingReturnable(item);
            const line = returnLines[item.id] || { quantity: 0, condition: 'GOOD', note: '' };
            return (
              <div key={item.id} className="return-line">
                <div className="return-line-header">
                  <span>{item.variant?.product?.name} ({item.variant?.size})</span>
                  <span className="return-remaining">{remaining} of {item.quantity} returnable</span>
                </div>
                {remaining > 0 ? (
                  <div className="return-line-fields">
                    <input
                      type="number" min="0" max={remaining}
                      value={line.quantity}
                      onChange={e => updateReturnLine(item.id, 'quantity', e.target.value)}
                      placeholder="Qty"
                    />
                    <select value={line.condition} onChange={e => updateReturnLine(item.id, 'condition', e.target.value)}>
                      <option value="GOOD">Good — Restock</option>
                      <option value="DAMAGED">Damaged — Write off</option>
                    </select>
                    <input
                      type="text"
                      value={line.note}
                      onChange={e => updateReturnLine(item.id, 'note', e.target.value)}
                      placeholder="Note (optional)"
                    />
                  </div>
                ) : (
                  <p className="return-fulfilled">Fully returned already.</p>
                )}
              </div>
            );
          })}

          <div className="modal-actions-elite">
            <button type="submit" className="elite-btn" disabled={returnSubmitting}>
              {returnSubmitting ? 'Processing...' : 'Record Return'}
            </button>
            <button type="button" className="elite-btn-outline" onClick={() => setReturnOrder(null)}>Cancel</button>
          </div>
        </form>
      </Modal>

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
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: 4px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          flex: 1;
        }
        .search-glass-input {
          background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem;
        }

        .filter-glass-matrix { display: flex; gap: 16px; }
        .select-glass-wrapper {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .select-glass-wrapper select {
          background: none; border: none; color: var(--color-text); outline: none; cursor: pointer; font-size: 0.85rem;
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
        .status-indicator.pending { background: var(--color-border-light); color: var(--color-primary); }
        .status-indicator.paid { background: rgba(39, 174, 96, 0.1); color: #2ecc71; }
        .status-indicator.shipped { background: rgba(41, 128, 185, 0.1); color: #3498db; }

        .order-patron { display: flex; align-items: center; gap: 16px; }
        .patron-avatar { width: 44px; height: 44px; background: rgba(184,155,106,0.1); border: 1px solid var(--color-border-alt); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-primary); }
        .patron-name { display: block; font-weight: 600; font-size: 0.95rem; color: var(--color-text-header); }
        .patron-email { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        .order-metrics { 
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border);
        }
        .metric-label { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); margin-bottom: 4px; }
        .metric-value { font-weight: 700; color: var(--color-text-header); }

        .order-tracking { font-size: 0.8rem; }
        .tracking-label { display: block; font-size: 0.65rem; color: var(--color-text-muted); margin-bottom: 2px; }
        .tracking-value { color: var(--color-primary); font-family: monospace; }

        .order-actions { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
        .btn-mini-action { background: none; border: none; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--color-primary); }

        .elite-btn-ship { background: var(--color-primary); color: #000; padding: 8px 16px; border-radius: 4px; border: none; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: var(--transition); }
        .elite-btn-ship:hover { filter: brightness(1.2); transform: translateY(-2px); }

        .return-subtitle { font-size: 0.8rem; color: var(--color-text-muted); margin: 0 0 24px; }

        .return-line { border: 1px solid var(--color-border); border-radius: 4px; padding: 16px; margin-bottom: 16px; }
        .return-line-header { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; }
        .return-remaining { color: var(--color-text-muted); font-weight: 500; font-size: 0.75rem; }
        .return-line-fields { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 10px; }
        .return-line-fields input, .return-line-fields select {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 8px 10px; color: var(--color-text); font-size: 0.8rem;
        }
        .return-fulfilled { font-size: 0.75rem; color: var(--color-text-muted); font-style: italic; margin: 0; }
        
        .elite-glass-input { width: 100%; background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 12px 16px; color: var(--color-text); outline: none; transition: var(--transition); font-size: 0.9rem; }
        .elite-glass-input:focus { border-color: var(--color-primary); background: var(--color-border-light); }

        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
        .elite-btn { background: var(--color-primary); color: #000; padding: 14px; border: none; border-radius: 4px; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; transition: var(--transition); }
        .elite-btn:hover { filter: brightness(1.2); }
        .elite-btn-outline { background: none; border: 1px solid var(--color-border); color: var(--color-text); padding: 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; transition: var(--transition); }
        .elite-btn-outline:hover { background: var(--color-border-light); }

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
