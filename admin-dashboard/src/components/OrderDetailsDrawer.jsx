import { useState, useEffect } from 'react';
import { Drawer } from './Drawer';
import { StatusBadge } from './StatusBadge';
import { FormField } from './FormField';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { OrderTracker } from './OrderTracker';
import { adminOpsApi, ordersApi } from '../services/api';
import { useMessaging } from '../context/MessagingContext';
import { User, MapPin, Package, CreditCard, RotateCcw, Truck, StickyNote, ScrollText, Download } from 'lucide-react';

const STATUS_TONE = {
  pending: 'neutral', processing: 'info', paid: 'success', shipped: 'info',
  delivered: 'success', cancelled: 'error',
  unpaid: 'neutral', partially_paid: 'warning', partially_refunded: 'warning', refunded: 'error',
};

const formatMoney = (val) => `R${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatAddress = (addr) => addr ? [addr.street, addr.city, addr.province, addr.postalCode, addr.country].filter(Boolean).join(', ') : null;

export function OrderDetailsDrawer({ orderId, onClose, onChanged }) {
  const { showMessage } = useMessaging();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ method: 'manual_eft', amount: '', reference: '' });
  const [refundForm, setRefundForm] = useState({ method: 'eft', amount: '', notes: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const data = await adminOpsApi.orders.getDetail(orderId);
      setOrder(data);
      setNotes(data.internalNotes || '');
    } catch (err) {
      showMessage('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await ordersApi.updateNotes(orderId, notes);
      showMessage('success', 'Notes Saved', 'Internal notes updated.');
      onChanged?.();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setSubmittingPayment(true);
    try {
      await adminOpsApi.orders.recordPayment(orderId, {
        method: paymentForm.method,
        amount: parseFloat(paymentForm.amount),
        reference: paymentForm.reference || undefined,
      });
      showMessage('success', 'Payment Recorded', 'The payment has been recorded.');
      setPaymentForm({ method: 'manual_eft', amount: '', reference: '' });
      fetchOrder();
      onChanged?.();
    } catch (err) {
      showMessage('error', 'Record Failed', err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleIssueRefund = async (e) => {
    e.preventDefault();
    setSubmittingRefund(true);
    try {
      await adminOpsApi.orders.issueRefund(orderId, {
        method: refundForm.method,
        amount: parseFloat(refundForm.amount),
        notes: refundForm.notes || undefined,
      });
      showMessage('success', 'Refund Recorded', 'The refund has been recorded.');
      setRefundForm({ method: 'eft', amount: '', notes: '' });
      fetchOrder();
      onChanged?.();
    } catch (err) {
      showMessage('error', 'Refund Failed', err.message);
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('toca_admin_token');
      const response = await fetch(`http://localhost:3000/api/admin/ops/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMessage('error', 'Download Failed', err.message);
    }
  };

  const subtotal = order ? order.items.reduce((sum, i) => sum + Number(i.priceAtPurchase) * i.quantity, 0) : 0;

  return (
    <Drawer
      isOpen={!!orderId}
      onClose={onClose}
      title={order ? `Order #${order.orderNumber || order.id.slice(0, 8).toUpperCase()}` : 'Order Details'}
      width={860}
    >
      {loading ? (
        <LoadingState label="Loading order..." />
      ) : !order ? (
        <EmptyState title="Order not found" />
      ) : (
        <div className="od">
          <div className="od-status-row">
            <StatusBadge tone={STATUS_TONE[order.status] || 'neutral'} label={order.status?.toUpperCase()} />
            <StatusBadge tone={STATUS_TONE[order.paymentStatus] || 'neutral'} label={order.paymentStatus?.replace('_', ' ').toUpperCase()} />
            {order.invoices?.length > 0 && (
              <button className="btn btn--outline btn--sm" onClick={() => handleDownloadInvoice(order.invoices[0].id, order.invoices[0].invoiceNumber)}>
                <Download size={14} /> Invoice
              </button>
            )}
          </div>

          <div className="od-grid-3">
            <div className="card od-card">
              <h4><User size={16} /> Customer</h4>
              <p className="od-line">{order.customer?.name || 'Guest'}</p>
              <p className="od-line od-muted">{order.customer?.email || '—'}</p>
              <p className="od-line od-muted">{order.customer?.phone || '—'}</p>
            </div>
            <div className="card od-card">
              <h4><MapPin size={16} /> Shipping Address</h4>
              <p className="od-line">{formatAddress(order.shippingAddress) || <span className="od-muted">Not set</span>}</p>
            </div>
            <div className="card od-card">
              <h4><MapPin size={16} /> Billing Address</h4>
              <p className="od-line">{formatAddress(order.billingAddress) || <span className="od-muted">Same as shipping</span>}</p>
            </div>
          </div>

          <div className="card od-card">
            <h4><Package size={16} /> Items</h4>
            <div className="od-table-wrap">
              <table className="od-table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.id}>
                      <td>{item.productNameSnapshot || item.variant?.product?.name} {item.variantLabelSnapshot ? `(${item.variantLabelSnapshot})` : ''}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.priceAtPurchase)}</td>
                      <td>{formatMoney(Number(item.priceAtPurchase) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="od-pricing">
              <div className="od-pricing-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              {Number(order.discountAmount) > 0 && (
                <div className="od-pricing-row od-pricing-discount">
                  <span>Discount {order.coupon ? `(${order.coupon.code})` : ''}</span>
                  <span>-{formatMoney(order.discountAmount)}</span>
                </div>
              )}
              {Number(order.taxAmount) > 0 && (
                <div className="od-pricing-row">
                  <span>Tax {order.taxRate ? `(${order.taxRate.name})` : ''}</span>
                  <span>{formatMoney(order.taxAmount)}</span>
                </div>
              )}
              <div className="od-pricing-row"><span>Shipping</span><span>{formatMoney(order.shippingCost)}</span></div>
              <div className="od-pricing-row od-pricing-total"><span>Total</span><span>{formatMoney(order.totalAmount)}</span></div>
            </div>
          </div>

          <div className="card od-card">
            <h4><CreditCard size={16} /> Payment History</h4>
            {order.payments.length === 0 ? (
              <EmptyState title="No payments recorded" />
            ) : (
              <div className="od-table-wrap">
                <table className="od-table">
                  <thead><tr><th>Method</th><th>Reference</th><th>Amount</th><th>Date</th></tr></thead>
                  <tbody>
                    {order.payments.map(p => (
                      <tr key={p.id}>
                        <td>{p.paymentMethod}</td>
                        <td>{p.transactionReference || '—'}</td>
                        <td>{formatMoney(p.amount)}</td>
                        <td>{p.paidAt ? new Date(p.paidAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={handleRecordPayment} className="od-inline-form">
              <FormField label="Method">
                <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="manual_eft">EFT</option>
                  <option value="manual_cash">Cash</option>
                  <option value="manual_card">Card</option>
                </select>
              </FormField>
              <FormField label="Amount">
                <input type="number" step="0.01" min="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
              </FormField>
              <FormField label="Reference">
                <input type="text" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} />
              </FormField>
              <button type="submit" className="btn btn--primary btn--sm" disabled={submittingPayment}>
                {submittingPayment ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </div>

          {order.paymentMilestones?.length > 0 && (
            <div className="card od-card">
              <h4>Payment Schedule</h4>
              <div className="od-table-wrap">
                <table className="od-table">
                  <thead><tr><th>Label</th><th>Amount Due</th><th>Due Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {order.paymentMilestones.map(m => (
                      <tr key={m.id}>
                        <td>{m.label}</td>
                        <td>{formatMoney(m.amountDue)}</td>
                        <td>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}</td>
                        <td><StatusBadge tone={m.status === 'PAID' ? 'success' : m.status === 'OVERDUE' ? 'error' : 'neutral'} label={m.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card od-card">
            <h4><RotateCcw size={16} /> Refunds</h4>
            {order.refunds.length === 0 ? (
              <EmptyState title="No refunds issued" />
            ) : (
              <div className="od-table-wrap">
                <table className="od-table">
                  <thead><tr><th>Method</th><th>Amount</th><th>Notes</th><th>Date</th></tr></thead>
                  <tbody>
                    {order.refunds.map(r => (
                      <tr key={r.id}>
                        <td>{r.method}</td>
                        <td>{formatMoney(r.amount)}</td>
                        <td>{r.notes || '—'}</td>
                        <td>{new Date(r.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={handleIssueRefund} className="od-inline-form">
              <FormField label="Method">
                <select value={refundForm.method} onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="eft">EFT</option>
                  <option value="cash">Cash</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="payfast_manual">PayFast (manual)</option>
                </select>
              </FormField>
              <FormField label="Amount">
                <input type="number" step="0.01" min="0.01" required value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))} />
              </FormField>
              <FormField label="Notes">
                <input type="text" value={refundForm.notes} onChange={e => setRefundForm(f => ({ ...f, notes: e.target.value }))} />
              </FormField>
              <button type="submit" className="btn btn--outline btn--sm" disabled={submittingRefund}>
                {submittingRefund ? 'Recording...' : 'Issue Refund'}
              </button>
            </form>
          </div>

          <div className="card od-card">
            <h4><Truck size={16} /> Tracking</h4>
            <OrderTracker events={order.logisticsEvents} createdAt={order.createdAt} />
          </div>

          <div className="card od-card">
            <h4><StickyNote size={16} /> Internal Notes</h4>
            <FormField label="Staff-only notes" hint="Not visible to the customer.">
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </FormField>
            <button className="btn btn--outline btn--sm" onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          <div className="card od-card">
            <h4><ScrollText size={16} /> Audit Trail</h4>
            {order.auditLogs?.length === 0 ? (
              <EmptyState title="No activity logged" />
            ) : (
              <ul className="od-audit-list">
                {order.auditLogs.map(log => (
                  <li key={log.id}>
                    <span className="od-audit-action">{log.action.replace(/_/g, ' ')}</span>
                    <span className="od-muted"> by {log.adminUser?.name || 'System'} · {new Date(log.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .od { display: flex; flex-direction: column; gap: var(--sp-5); }
        .od-status-row { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
        .od-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); }
        .od-card h4 { display: flex; align-items: center; gap: var(--sp-2); margin: 0 0 var(--sp-3); font-size: 1.05rem; color: var(--text-primary); }
        .od-card h4 svg { color: var(--y-base); }
        .od-line { margin: 0 0 4px; font-size: .88rem; color: var(--text-secondary); }
        .od-muted { color: var(--text-muted); }

        .od-table-wrap { overflow-x: auto; margin-bottom: var(--sp-4); }
        .od-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
        .od-table th { text-align: left; padding: var(--sp-2) var(--sp-3); color: var(--text-muted); font-size: .66rem; letter-spacing: .12em; text-transform: uppercase; border-bottom: 1px solid var(--border-default); }
        .od-table td { padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--border-low); color: var(--text-secondary); }

        .od-pricing { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-3); border-top: 1px solid var(--border-low); }
        .od-pricing-row { display: flex; justify-content: space-between; font-size: .85rem; color: var(--text-secondary); }
        .od-pricing-discount { color: var(--success); }
        .od-pricing-total { font-size: .95rem; color: var(--text-primary); padding-top: var(--sp-2); border-top: 1px solid var(--border-low); }

        .od-inline-form { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: var(--sp-3); align-items: end; }
        .od-inline-form .form-field { margin-bottom: 0; }

        .od-audit-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
        .od-audit-list li { font-size: .82rem; color: var(--text-secondary); }
        .od-audit-action { color: var(--text-primary); text-transform: capitalize; }

        @media (max-width: 768px) {
          .od-grid-3 { grid-template-columns: 1fr; }
          .od-inline-form { grid-template-columns: 1fr; }
        }
      `}} />
    </Drawer>
  );
}

export default OrderDetailsDrawer;
