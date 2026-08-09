import { useState, useEffect, useCallback } from 'react';
import { ordersApi, adminOpsApi, productsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { OrderDetailsDrawer } from '../components/OrderDetailsDrawer';
import { CreateOrderDrawer } from '../components/CreateOrderDrawer';
import { useMessaging } from '../context/MessagingContext';
import { ShoppingBag, Search, Truck, Filter, Hash, Landmark, RotateCcw, Eye, Plus, Download } from 'lucide-react';

const STATUS_ACTIONS = ['processing', 'shipped', 'delivered', 'cancelled'];

const COURIERS = [
  { key: 'THE_COURIER_GUY', name: 'The Courier Guy' },
  { key: 'ARAMEX', name: 'Aramex' },
  { key: 'FEDEX', name: 'FedEx' },
  { key: 'POST_OFFICE', name: 'SAPO' }
];

const STATUS_TONE = {
  pending: 'neutral',
  paid: 'success',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
};

export function Orders() {
  const { showMessage } = useMessaging();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillData, setFulfillData] = useState({ trackingNumber: '', courierKey: 'THE_COURIER_GUY', estimatedDelivery: '' });
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [returnOrder, setReturnOrder] = useState(null); // full order detail with items+returnItems
  const [returnLines, setReturnLines] = useState({}); // { [orderItemId]: { quantity, condition, note, action, refundAmount, refundMethod, exchangeVariantId } }
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [exchangeVariants, setExchangeVariants] = useState([]);
  const [viewOrderId, setViewOrderId] = useState(null);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const items = await ordersApi.list({
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined
      });
      setOrders(items);
    } catch (err) {
      console.warn('Orders API failed:', err.message);
    } finally {
      setLoading(false);
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
      showMessage('error', 'Fulfillment Failed', err.message);
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
        initialLines[item.id] = { quantity: 0, condition: 'GOOD', note: '', action: 'none', refundAmount: '', refundMethod: 'eft', exchangeVariantId: '' };
      });
      setReturnLines(initialLines);
      productsApi.list({ limit: 200 }).then(res => {
        const flattened = (res.products || []).flatMap(p =>
          (p.variants || []).map(v => ({
            variantId: v.id,
            label: `${p.name}${v.size ? ` (${v.size})` : ''}`,
            stock: (v.inventory?.quantity || 0) - (v.inventory?.reserved || 0),
          }))
        );
        setExchangeVariants(flattened);
      }).catch(() => setExchangeVariants([]));
    } catch (err) {
      showMessage('error', 'Load Failed', err.message);
    }
  };

  const updateReturnLine = (itemId, field, value) => {
    setReturnLines(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleSubmitReturns = async (e) => {
    e.preventDefault();
    const toProcess = Object.entries(returnLines).filter(([, line]) => parseInt(line.quantity) > 0);
    if (!toProcess.length) return showMessage('warning', 'No Items Selected', 'Enter a quantity for at least one item to return.');

    setReturnSubmitting(true);
    try {
      for (const [orderItemId, line] of toProcess) {
        const returnItem = await adminOpsApi.returns.create({
          orderItemId,
          quantity: parseInt(line.quantity),
          condition: line.condition,
          note: line.note || undefined
        });

        if (line.action === 'refund' && line.refundAmount) {
          await adminOpsApi.orders.issueRefund(returnOrder.id, {
            amount: parseFloat(line.refundAmount),
            method: line.refundMethod,
            returnItemId: returnItem.id
          });
        } else if (line.action === 'exchange' && line.exchangeVariantId) {
          await adminOpsApi.exchanges.create({
            returnItemId: returnItem.id,
            replacementVariantId: line.exchangeVariantId
          });
        }
      }
      setReturnOrder(null);
      fetchOrders();
    } catch (err) {
      showMessage('error', 'Return Failed', err.message);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleStatusChange = async (order, status) => {
    setStatusUpdating(order.id);
    try {
      await ordersApi.updateStatus(order.id, status);
      fetchOrders();
    } catch (err) {
      showMessage('error', 'Status Update Failed', err.message);
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Order ID', 'Customer', 'Email', 'Total', 'Status', 'Payment Status', 'Tracking', 'Date'];
    const rows = filteredOrders.map(o => [
      o.id, o.customer?.name || 'Guest', o.customer?.email || '', Number(o.totalAmount).toFixed(2),
      o.status, o.paymentStatus, o.trackingNumber || '', new Date(o.createdAt).toISOString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filteredOrders = orders.filter(o =>
    o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'orderNumber', label: 'Order', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--color-primary-text)', fontFamily: 'var(--font-display)' }}>
        <Hash size={13} /> {val}
      </div>
    )},
    { key: 'customer', label: 'Customer', render: (val) => (
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>{val?.name || 'Private Client'}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{val?.email || 'Guest checkout'}</p>
      </div>
    )},
    { key: 'totalAmount', label: 'Total', render: (val) => <span style={{ fontWeight: 700 }}>R{Number(val).toLocaleString()}</span> },
    { key: 'status', label: 'Status', render: (val) => (
      <StatusBadge tone={STATUS_TONE[val?.toLowerCase()] || 'neutral'} label={val?.toUpperCase()} />
    )},
    { key: 'trackingNumber', label: 'Tracking', render: (val) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: val ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
        {val || 'Awaiting fulfillment'}
      </span>
    )},
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="elite-orders-container animate-fade-in">
      <PageHeader
        icon={<ShoppingBag size={22} />}
        title="Orders"
        subtitle="Track fulfillment status and process returns."
        actions={(
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn--outline" onClick={handleExportCsv}>
              <Download size={16} /> Export CSV
            </button>
            <button className="btn btn--primary" onClick={() => setShowCreateOrder(true)}>
              <Plus size={16} /> Create Order
            </button>
          </div>
        )}
      />

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
                <option value="processing">Processing</option>
                <option value="shipped">In Transit</option>
                <option value="delivered">Clinical Delivery</option>
                <option value="cancelled">Voided</option>
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

      {loading ? (
        <LoadingState label="Loading orders..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={filteredOrders}
            emptyState={<EmptyState icon={<ShoppingBag size={40} />} title="No orders yet" description="Orders will appear here as customers check out." />}
            actions={(o) => (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="icon-btn" title="View details" onClick={() => setViewOrderId(o.id)}>
                  <Eye size={16} />
                </button>
                {o.status === 'paid' && !o.trackingNumber && (
                  <button className="btn btn--primary btn--sm" onClick={() => handleOpenFulfill(o)}>
                    <Truck size={14} /> Dispatch
                  </button>
                )}
                {['paid', 'shipped', 'delivered'].includes(o.status) && (
                  <button className="icon-btn" title="Process return" onClick={() => handleOpenReturn(o)}>
                    <RotateCcw size={16} />
                  </button>
                )}
                <select
                  className="order-status-select"
                  value=""
                  disabled={statusUpdating === o.id}
                  onChange={(e) => { if (e.target.value) handleStatusChange(o, e.target.value); }}
                >
                  <option value="">Change status...</option>
                  {STATUS_ACTIONS.filter(s => s !== o.status).map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
          />
        </div>
      )}

      <Drawer isOpen={showFulfillModal} onClose={() => setShowFulfillModal(false)} title="Logistics Dispatch" width={440}>
        <form onSubmit={handleFulfill} className="elite-form">
           <FormField label="Courier" required>
             <select
                value={fulfillData.courierKey}
                onChange={e => setFulfillData({...fulfillData, courierKey: e.target.value})}
                required
             >
               {COURIERS.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
             </select>
           </FormField>

           <FormField label="Tracking Number" required>
             <input
               type="text"
               value={fulfillData.trackingNumber}
               onChange={e => setFulfillData({...fulfillData, trackingNumber: e.target.value})}
               required
               placeholder="e.g. TCG-TOCA-8849"
             />
           </FormField>

           <div className="modal-actions-elite">
             <button type="submit" className="btn btn--primary" disabled={submitting}>
               {submitting ? 'Dispatching...' : 'Confirm Shipment'}
             </button>
             <button type="button" className="btn btn--outline" onClick={() => setShowFulfillModal(false)}>Cancel</button>
           </div>
        </form>
      </Drawer>

      <Drawer isOpen={!!returnOrder} onClose={() => setReturnOrder(null)} title="Process Return" width={560}>
        <p className="return-subtitle">{returnOrder && `Order #${returnOrder.orderNumber || returnOrder.id.substring(0, 8).toUpperCase()} — ${returnOrder.shippingAddress ? `${returnOrder.customer?.name || 'Guest'}` : ''}`}</p>

        <form onSubmit={handleSubmitReturns} className="elite-form">
          {returnOrder?.items?.map(item => {
            const remaining = remainingReturnable(item);
            const line = returnLines[item.id] || { quantity: 0, condition: 'GOOD', note: '', action: 'none', refundAmount: '', refundMethod: 'eft', exchangeVariantId: '' };
            return (
              <div key={item.id} className="return-line">
                <div className="return-line-header">
                  <span>{item.variant?.product?.name} ({item.variant?.size})</span>
                  <span className="return-remaining">{remaining} of {item.quantity} returnable</span>
                </div>
                {remaining > 0 ? (
                  <>
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
                    {parseInt(line.quantity) > 0 && (
                      <div className="return-action-row">
                        <select value={line.action} onChange={e => updateReturnLine(item.id, 'action', e.target.value)}>
                          <option value="none">No refund/exchange</option>
                          <option value="refund">Issue refund</option>
                          <option value="exchange">Exchange for different item</option>
                        </select>
                        {line.action === 'refund' && (
                          <>
                            <input
                              type="number" step="0.01" min="0.01"
                              placeholder="Refund amount"
                              value={line.refundAmount}
                              onChange={e => updateReturnLine(item.id, 'refundAmount', e.target.value)}
                            />
                            <select value={line.refundMethod} onChange={e => updateReturnLine(item.id, 'refundMethod', e.target.value)}>
                              <option value="eft">EFT</option>
                              <option value="cash">Cash</option>
                              <option value="store_credit">Store Credit</option>
                            </select>
                          </>
                        )}
                        {line.action === 'exchange' && (
                          <select value={line.exchangeVariantId} onChange={e => updateReturnLine(item.id, 'exchangeVariantId', e.target.value)}>
                            <option value="">Select replacement item...</option>
                            {exchangeVariants.map(v => (
                              <option key={v.variantId} value={v.variantId}>{v.label} ({v.stock} in stock)</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="return-fulfilled">Fully returned already.</p>
                )}
              </div>
            );
          })}

          <div className="modal-actions-elite">
            <button type="submit" className="btn btn--primary" disabled={returnSubmitting}>
              {returnSubmitting ? 'Processing...' : 'Record Return'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setReturnOrder(null)}>Cancel</button>
          </div>
        </form>
      </Drawer>

      <OrderDetailsDrawer
        orderId={viewOrderId}
        onClose={() => setViewOrderId(null)}
        onChanged={fetchOrders}
      />

      <CreateOrderDrawer
        isOpen={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        onCreated={fetchOrders}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-orders-container {
          padding: 40px; 
          max-width: 1400px; 
          margin: 0 auto; 
          min-height: 100vh;
        }

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

        .return-subtitle { font-size: 0.8rem; color: var(--color-text-muted); margin: 0 0 24px; }

        .return-line { border: 1px solid var(--color-border); border-radius: 4px; padding: 16px; margin-bottom: 16px; }
        .return-line-header { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; }
        .return-remaining { color: var(--color-text-muted); font-weight: 500; font-size: 0.75rem; }
        .return-line-fields { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 10px; }
        .return-line-fields input, .return-line-fields select {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 8px 10px; color: var(--color-text); font-size: 0.8rem; min-width: 0; width: 100%;
        }
        .return-action-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
        .return-action-row input, .return-action-row select {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 8px 10px; color: var(--color-text); font-size: 0.8rem; min-width: 0; width: 100%;
        }
        @media (max-width: 480px) {
          .return-line-fields { grid-template-columns: 1fr; }
          .return-action-row { grid-template-columns: 1fr; }
          .return-line-header { flex-direction: column; align-items: flex-start; gap: 4px; }
        }
        .return-fulfilled { font-size: 0.75rem; color: var(--color-text-muted); font-style: italic; margin: 0; }

        .order-status-select {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 6px 8px; color: var(--color-text); font-size: 0.78rem; cursor: pointer;
        }

        .elite-form { display: flex; flex-direction: column; }
        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .filter-glass-matrix { flex-wrap: wrap; }
          .select-glass-wrapper { flex: 1 1 140px; }
        }
      `}} />
    </div>
  );
}

export default Orders;
