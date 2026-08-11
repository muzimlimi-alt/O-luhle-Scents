<<<<<<< HEAD
import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateTime } from 'luxon';
=======
import { useState, useEffect, useCallback } from 'react';
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
import { ordersApi, adminOpsApi, productsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { OrderDetailsDrawer } from '../components/OrderDetailsDrawer';
import { CreateOrderDrawer } from '../components/CreateOrderDrawer';
import { useMessaging } from '../context/MessagingContext';
import { ShoppingBag, Search, Truck, Filter, Hash, Landmark, RotateCcw, Eye, Plus, Download, PackageOpen, Timer, Printer } from 'lucide-react';

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
  const [quickFilter, setQuickFilter] = useState('all');

  // Unfiltered order/return data for the KPI row and fulfilment board — kept
  // independent of the table's own status/payment filters below, so those
  // numbers don't silently shift when an admin narrows the table view.
  const [allOrders, setAllOrders] = useState([]);
  const [returnsList, setReturnsList] = useState([]);

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

  useEffect(() => {
    ordersApi.list().then(setAllOrders).catch(() => setAllOrders([]));
    adminOpsApi.returns.list().then(setReturnsList).catch(() => setReturnsList([]));
  }, []);

  // Fulfilment board columns — grouped by the order's real status, not
  // fabricated picking/packing stages this app has no data for.
  const board = useMemo(() => {
    const cols = { pending: [], paid: [], shipped: [], delivered: [] };
    allOrders.forEach((o) => { if (cols[o.status]) cols[o.status].push(o); });
    return cols;
  }, [allOrders]);

  const unfulfilledOrders = useMemo(() => allOrders.filter(o => ['pending', 'paid'].includes(o.status)), [allOrders]);
  const inTransitOrders = useMemo(() => allOrders.filter(o => o.status === 'shipped'), [allOrders]);

  const oldestUnfulfilledHours = useMemo(() => {
    if (unfulfilledOrders.length === 0) return null;
    const hours = unfulfilledOrders.map(o => DateTime.now().diff(DateTime.fromISO(o.createdAt), 'hours').hours);
    return Math.round(Math.max(...hours));
  }, [unfulfilledOrders]);

  const avgFulfilmentDays = useMemo(() => {
    const shipped = allOrders.filter(o => o.shippedAt && o.createdAt);
    if (shipped.length === 0) return null;
    const totalDays = shipped.reduce((s, o) => s + DateTime.fromISO(o.shippedAt).diff(DateTime.fromISO(o.createdAt), 'days').days, 0);
    return totalDays / shipped.length;
  }, [allOrders]);

  const openReturns = useMemo(() => returnsList.filter(r => !r.restocked), [returnsList]);
  const returnsGoodCount = useMemo(() => returnsList.filter(r => r.condition === 'GOOD').length, [returnsList]);
  const returnsDamagedCount = useMemo(() => returnsList.filter(r => r.condition === 'DAMAGED').length, [returnsList]);
  const refundValueIssued = useMemo(() => returnsList.reduce((s, r) => s + (r.refunds || []).reduce((s2, rf) => s2 + Number(rf.amount || 0), 0), 0), [returnsList]);
  const returnOrderIds = useMemo(() => new Set(returnsList.map(r => r.orderItem?.order?.id).filter(Boolean)), [returnsList]);

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

  const handlePrintPickingList = () => {
    setQuickFilter('unfulfilled');
    setTimeout(() => window.print(), 100);
  };

  const handleExportCsv = () => {
    const headers = ['Order ID', 'Customer', 'Email', 'Total', 'Status', 'Payment Status', 'Tracking', 'Date'];
    const rows = visibleOrders.map(o => [
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

  // Quick-filter chips layered on top of the search box and the dropdown
  // status/payment filters above — a second, composable filter axis rather
  // than a replacement for them.
  const visibleOrders = filteredOrders.filter((o) => {
    if (quickFilter === 'unfulfilled') return ['pending', 'paid'].includes(o.status);
    if (quickFilter === 'unpaid') return o.paymentStatus === 'unpaid';
    if (quickFilter === 'returns') return returnOrderIds.has(o.id);
    return true;
  });

  const columns = [
    { key: 'orderNumber', label: 'Order', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--y-base)', fontFamily: 'var(--f-display)' }}>
        <Hash size={13} /> {val}
      </div>
    )},
    { key: 'customer', label: 'Customer', render: (val) => (
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>{val?.name || 'Private Client'}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{val?.email || 'Guest checkout'}</p>
      </div>
    )},
    { key: 'totalAmount', label: 'Total', render: (val) => <span style={{ fontWeight: 700 }}>R{Number(val).toLocaleString()}</span> },
    { key: 'status', label: 'Status', render: (val) => (
      <StatusBadge tone={STATUS_TONE[val?.toLowerCase()] || 'neutral'} label={val?.toUpperCase()} />
    )},
    { key: 'trackingNumber', label: 'Tracking', render: (val) => (
      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {val || 'Awaiting fulfillment'}
      </span>
    )},
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="elite-orders-container animate-fade-in">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Commerce</li><li aria-current="page">Orders</li></ol>
          <h1>Orders</h1>
          <p className="sub">
            {unfulfilledOrders.length} order{unfulfilledOrders.length === 1 ? '' : 's'} awaiting fulfilment
            {oldestUnfulfilledHours != null && ` · oldest waiting ${oldestUnfulfilledHours}h`}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn-outline btn-sm" onClick={handlePrintPickingList}>
            <Printer size={14} /> Print picking list
          </button>
          <button type="button" className="btn-outline btn-sm" onClick={handleExportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowCreateOrder(true)}>
            <Plus size={14} /> Create order
          </button>
        </div>
      </div>

      <div className="grid kpi-row mb-6">
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Unfulfilled</h2><span className="ic" aria-hidden="true"><PackageOpen size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{unfulfilledOrders.length}</p>
          <p className="kpi-foot">{oldestUnfulfilledHours != null ? `Oldest waiting ${oldestUnfulfilledHours} hours` : 'All caught up'}</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">In transit</h2><span className="ic" aria-hidden="true"><Truck size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{inTransitOrders.length}</p>
          <p className="kpi-foot">Currently with couriers</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Returns open</h2><span className="ic" aria-hidden="true"><RotateCcw size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{openReturns.length}</p>
          <p className="kpi-foot"><span className="delta flat">{allOrders.length > 0 ? `${((openReturns.length / allOrders.length) * 100).toFixed(1)}% of orders` : '—'}</span></p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Avg. fulfilment</h2><span className="ic" aria-hidden="true"><Timer size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{avgFulfilmentDays != null ? avgFulfilmentDays.toFixed(1) : '—'} <small>days</small></p>
          <p className="kpi-foot">Placed to shipped</p>
        </article>
      </div>

      <div className="section-title">
        <div><h2>Fulfilment <em>board</em></h2><p className="sub" style={{ color: 'var(--text-muted)', fontSize: '.86rem' }}>Select an order to open its detail panel.</p></div>
      </div>
      <div className="board mb-6">
        {[
          { key: 'pending', label: 'New' },
          { key: 'paid', label: 'Paid' },
          { key: 'shipped', label: 'Shipped' },
          { key: 'delivered', label: 'Delivered' },
        ].map((col) => (
          <section className="col" key={col.key}>
            <div className="col-head"><h4>{col.label}</h4><span className="n">{board[col.key].length}</span></div>
            <div className="col-body">
              {board[col.key].slice(0, 8).map((o) => (
                <button type="button" className="tile" key={o.id} onClick={() => setViewOrderId(o.id)}>
                  <span className="tile-id">#{o.orderNumber}</span>
                  <span className="tile-name">{o.customer?.name || 'Guest'}</span>
                  <span className="tile-meta"><span>{(o.items || []).length} item{(o.items || []).length === 1 ? '' : 's'} · R{Number(o.totalAmount).toLocaleString()}</span></span>
                </button>
              ))}
              {board[col.key].length === 0 && <p className="col-empty">None</p>}
              {board[col.key].length > 8 && <p className="col-more">+{board[col.key].length - 8} more</p>}
            </div>
          </section>
        ))}
      </div>

      <section className="card mb-6">
        <div className="card-head">
          <h3>All orders</h3>
          <div className="seg" role="group" aria-label="Order status filter">
            {[
              { v: 'all', l: 'All' },
              { v: 'unfulfilled', l: 'Unfulfilled' },
              { v: 'unpaid', l: 'Unpaid' },
              { v: 'returns', l: 'Returns' },
            ].map((c) => (
              <button key={c.v} type="button" aria-pressed={quickFilter === c.v} onClick={() => setQuickFilter(c.v)}>{c.l}</button>
            ))}
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
        <div className="card-body flush">
          <DataTable
            columns={columns}
            data={visibleOrders}
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
      </section>

      <section className="card mb-6">
        <div className="card-head">
          <div><h3>Returns &amp; <em>refunds</em></h3></div>
          {openReturns.length > 0 && <span className="pill warn">{openReturns.length} open</span>}
        </div>
        <div className="card-body">
          {returnsList.length === 0 ? (
            <EmptyState title="No returns yet" description="Processed returns will appear here." />
          ) : (
            <ul className="stat-list">
              <li>Good condition (restockable) <span className="v">{returnsGoodCount}</span></li>
              <li>Damaged (write-off) <span className="v">{returnsDamagedCount}</span></li>
              <li>Awaiting restock <span className="v">{openReturns.length}</span></li>
              <li>Refund value issued <span className="v">R {refundValueIssued.toLocaleString()}</span></li>
            </ul>
          )}
        </div>
      </section>

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
          max-width: 1600px;
          margin: 0 auto;
          min-height: 100vh;
        }

        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .elite-orders-container .card { border-color: var(--border-low); }
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
        .btn-primary:focus-visible, .btn-outline:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

        .grid { display: grid; gap: var(--sp-5); }
        .kpi-row { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

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
        .kpi-val small { font-size: .6em; color: var(--text-muted); font-family: var(--f-body); }
        .kpi-foot { font-size: .78rem; color: var(--text-muted); margin: 0; }
        .delta.flat { color: var(--text-muted); font-family: var(--f-mono); }

        .section-title { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-4); margin: var(--sp-7) 0 var(--sp-4); flex-wrap: wrap; }
        .section-title h2 { font-size: 1.5rem; }

        .board { display: grid; grid-template-columns: repeat(5, minmax(200px, 1fr)); gap: var(--sp-4); overflow-x: auto; padding-bottom: var(--sp-2); }
        .col { background: var(--bg-surface); border: 1px solid var(--border-low); border-radius: var(--r); min-width: 0; display: flex; flex-direction: column; }
        .col-head { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-low); }
        .col-head h4 { font-size: .78rem; text-transform: uppercase; letter-spacing: .1em; color: var(--text-secondary); }
        .col-head .n { font-family: var(--f-mono); font-size: .72rem; color: var(--text-muted); background: var(--bg-elevated); border-radius: var(--r-pill); padding: 1px 8px; }
        .col-body { padding: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
        .tile {
          display: flex; flex-direction: column; gap: 4px; text-align: left;
          padding: var(--sp-3); background: var(--bg-elevated); border: 1px solid var(--border-low); border-radius: var(--r);
          cursor: pointer; transition: border-color var(--t-fast) var(--ease);
        }
        .tile:hover { border-color: var(--y-base); }
        .tile-id { font-family: var(--f-mono); font-size: .72rem; color: var(--y-base); }
        .tile-name { font-size: .84rem; color: var(--text-primary); }
        .tile-meta { font-size: .74rem; color: var(--text-muted); }
        .col-empty, .col-more { font-size: .76rem; color: var(--text-muted); text-align: center; padding: var(--sp-2); margin: 0; }

        .card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low); flex-wrap: wrap; }
        .card-head h3 { font-size: 1.15rem; }
        .card-body { padding: var(--sp-5); }
        .card-body.flush { padding: 0; }

        .seg { display: flex; border: 1px solid var(--border-default); border-radius: var(--r); overflow: hidden; }
        .seg button { min-height: var(--tap); padding: 0 var(--sp-4); font-size: .76rem; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); background: none; border: none; border-right: 1px solid var(--border-low); cursor: pointer; transition: all var(--t-fast) var(--ease); }
        .seg button:last-child { border-right: 0; }
        .seg button:hover { color: var(--text-primary); background: var(--bg-elevated); }
        .seg button[aria-pressed="true"] { background: rgba(var(--y-rgb), .14); color: var(--y-base); }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.warn { color: var(--warning); border-color: rgba(var(--warn-rgb), .4); background: rgba(var(--warn-rgb), .09); }

        .stat-list { list-style: none; margin: 0; padding: 0; }
        .stat-list li { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-low); font-size: .86rem; color: var(--text-secondary); }
        .stat-list li:last-child { border-bottom: 0; }
        .stat-list .v { font-family: var(--f-mono); color: var(--text-primary); font-size: .88rem; }

        .atelier-discovery {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: var(--sp-4) var(--sp-5);
          border-bottom: 1px solid var(--border-low);
        }

        .search-glass-wrapper {
          position: relative;
          background: var(--bg-surface);
          border: 1.5px solid var(--border-default);
          border-radius: var(--r);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          flex: 1;
        }
        .search-glass-input {
          background: none; border: none; color: var(--text-primary); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem;
        }

        .filter-glass-matrix { display: flex; gap: 16px; }
        .select-glass-wrapper {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--r);
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .select-glass-wrapper select {
          background: none; border: none; color: var(--text-primary); outline: none; cursor: pointer; font-size: 0.85rem;
        }

        .return-subtitle { font-size: 0.8rem; color: var(--text-muted); margin: 0 0 24px; }

        .return-line { border: 1px solid var(--border-default); border-radius: var(--r); padding: 16px; margin-bottom: 16px; }
        .return-line-header { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; }
        .return-remaining { color: var(--text-muted); font-weight: 500; font-size: 0.75rem; }
        .return-line-fields { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 10px; }
        .return-line-fields input, .return-line-fields select {
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
          padding: 8px 10px; color: var(--text-primary); font-size: 0.8rem; min-width: 0; width: 100%;
        }
        .return-action-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
        .return-action-row input, .return-action-row select {
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
          padding: 8px 10px; color: var(--text-primary); font-size: 0.8rem; min-width: 0; width: 100%;
        }
        @media (max-width: 480px) {
          .return-line-fields { grid-template-columns: 1fr; }
          .return-action-row { grid-template-columns: 1fr; }
          .return-line-header { flex-direction: column; align-items: flex-start; gap: 4px; }
        }
        .return-fulfilled { font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin: 0; }

        .order-status-select {
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
          padding: 6px 8px; color: var(--text-primary); font-size: 0.78rem; cursor: pointer;
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
