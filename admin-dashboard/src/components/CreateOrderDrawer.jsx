import React, { useState, useEffect, useMemo } from 'react';
import { Drawer } from './Drawer';
import { FormField } from './FormField';
import { adminOpsApi, productsApi } from '../services/api';
import { useMessaging } from '../context/MessagingContext';
import { Search, X, Plus, Trash2 } from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'manual_eft', label: 'EFT' },
  { value: 'manual_cash', label: 'Cash' },
  { value: 'manual_card', label: 'Card (in-person)' },
  { value: 'milestone_plan', label: 'Payment Plan (installments)' },
];

const formatMoney = (val) => `R${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CreateOrderDrawer({ isOpen, onClose, onCreated }) {
  const { showMessage } = useMessaging();
  const [customerMode, setCustomerMode] = useState('existing');
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });

  const [variants, setVariants] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [items, setItems] = useState([]);

  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const [shippingCost, setShippingCost] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('manual_eft');
  const [paymentReference, setPaymentReference] = useState('');
  const [milestones, setMilestones] = useState([{ label: 'Deposit', amountDue: '', dueDate: '' }]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    adminOpsApi.customers.list().then(setCustomers).catch(() => setCustomers([]));
    productsApi.list({ limit: 200 }).then(res => {
      const flattened = (res.products || []).flatMap(p =>
        (p.variants || []).map(v => ({
          variantId: v.id,
          productName: p.name,
          label: v.size || v.sku,
          price: Number(v.price),
          stock: (v.inventory?.quantity || 0) - (v.inventory?.reserved || 0),
        }))
      );
      setVariants(flattened);
    }).catch(() => setVariants([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCustomerMode('existing'); setCustomerId(''); setCustomerSearch('');
      setNewCustomer({ name: '', email: '', phone: '' });
      setProductSearch(''); setItems([]);
      setCouponCode(''); setCouponPreview(null);
      setShippingCost('0'); setPaymentMethod('manual_eft'); setPaymentReference('');
      setMilestones([{ label: 'Deposit', amountDue: '', dueDate: '' }]);
      setNotes('');
    }
  }, [isOpen]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)).slice(0, 8);
  }, [customerSearch, customers]);

  const filteredVariants = useMemo(() => {
    if (!productSearch) return [];
    const q = productSearch.toLowerCase();
    return variants.filter(v => v.productName.toLowerCase().includes(q) || v.label?.toLowerCase().includes(q)).slice(0, 8);
  }, [productSearch, variants]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const addItem = (variant) => {
    setItems(prev => {
      const existing = prev.find(i => i.variantId === variant.variantId);
      if (existing) return prev.map(i => i.variantId === variant.variantId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...variant, quantity: 1 }];
    });
    setProductSearch('');
  };

  const updateItemQty = (variantId, quantity) => {
    setItems(prev => prev.map(i => i.variantId === variantId ? { ...i, quantity: Math.max(1, parseInt(quantity) || 1) } : i));
  };

  const removeItem = (variantId) => setItems(prev => prev.filter(i => i.variantId !== variantId));

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = couponPreview?.discountAmount || 0;
  const estimatedTotal = subtotal - discountAmount + Number(shippingCost || 0);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    try {
      const result = await adminOpsApi.couponValidate(couponCode, subtotal);
      setCouponPreview(result);
    } catch (err) {
      setCouponPreview(null);
      showMessage('error', 'Invalid Coupon', err.message);
    } finally {
      setCouponChecking(false);
    }
  };

  const addMilestone = () => setMilestones(prev => [...prev, { label: '', amountDue: '', dueDate: '' }]);
  const updateMilestone = (idx, field, value) => setMilestones(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  const removeMilestone = (idx) => setMilestones(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!items.length) return showMessage('warning', 'No Items', 'Add at least one product to the order.');
    if (customerMode === 'existing' && !customerId) return showMessage('warning', 'No Customer', 'Select an existing customer or switch to "New customer".');
    if (customerMode === 'new' && !newCustomer.email) return showMessage('warning', 'Missing Email', 'A new customer needs at least an email address.');

    setSubmitting(true);
    try {
      const payload = {
        customerId: customerMode === 'existing' ? customerId : undefined,
        newCustomer: customerMode === 'new' ? newCustomer : undefined,
        items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
        shippingCost: parseFloat(shippingCost) || 0,
        couponCode: couponPreview ? couponCode : undefined,
        paymentMethod,
        paymentReference: paymentMethod !== 'milestone_plan' ? (paymentReference || undefined) : undefined,
        milestones: paymentMethod === 'milestone_plan'
          ? milestones.filter(m => m.label && m.amountDue).map(m => ({ label: m.label, amountDue: parseFloat(m.amountDue), dueDate: m.dueDate || undefined }))
          : undefined,
        notes: notes || undefined,
      };
      const order = await adminOpsApi.orders.create(payload);
      showMessage('success', 'Order Created', `Order #${order.orderNumber || order.id.slice(0, 8).toUpperCase()} has been created.`);
      onCreated?.(order);
      onClose();
    } catch (err) {
      showMessage('error', 'Order Creation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Create Order" width={620}>
      <form onSubmit={handleSubmit} className="co-form">
        <section className="co-section">
          <h4>Customer</h4>
          <div className="co-toggle">
            <button type="button" className={customerMode === 'existing' ? 'active' : ''} onClick={() => setCustomerMode('existing')}>Existing Customer</button>
            <button type="button" className={customerMode === 'new' ? 'active' : ''} onClick={() => setCustomerMode('new')}>New Customer</button>
          </div>

          {customerMode === 'existing' ? (
            <div className="form-field">
              <label className="form-field__label">Search customers</label>
              <div className="co-search-wrap">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by name or email..."
                  value={selectedCustomer ? `${selectedCustomer.name || selectedCustomer.email}` : customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setCustomerId(''); }}
                />
                {selectedCustomer && (
                  <button type="button" className="co-clear" onClick={() => { setCustomerId(''); setCustomerSearch(''); }}><X size={14} /></button>
                )}
              </div>
              {!!filteredCustomers.length && !customerId && (
                <div className="co-dropdown">
                  {filteredCustomers.map(c => (
                    <div key={c.id} className="co-dropdown-item" onClick={() => { setCustomerId(c.id); setCustomerSearch(''); }}>
                      <span>{c.name || 'Unnamed'}</span>
                      <span className="co-muted">{c.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="co-grid-2">
              <FormField label="Name">
                <input type="text" value={newCustomer.name} onChange={e => setNewCustomer(c => ({ ...c, name: e.target.value }))} />
              </FormField>
              <FormField label="Email" required>
                <input type="email" value={newCustomer.email} onChange={e => setNewCustomer(c => ({ ...c, email: e.target.value }))} required />
              </FormField>
              <FormField label="Phone">
                <input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer(c => ({ ...c, phone: e.target.value }))} />
              </FormField>
            </div>
          )}
        </section>

        <section className="co-section">
          <h4>Items</h4>
          <div className="form-field">
            <label className="form-field__label">Add a product</label>
            <div className="co-search-wrap">
              <Search size={14} className="co-search-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search products by name..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
            {!!filteredVariants.length && (
              <div className="co-dropdown">
                {filteredVariants.map(v => (
                  <div key={v.variantId} className="co-dropdown-item" onClick={() => addItem(v)}>
                    <span>{v.productName} {v.label ? `(${v.label})` : ''}</span>
                    <span className="co-muted">{formatMoney(v.price)} · {v.stock} in stock</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="co-table-wrap">
              <table className="co-table">
                <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th /></tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.variantId}>
                      <td>{i.productName} {i.label ? `(${i.label})` : ''}</td>
                      <td><input type="number" min="1" max={i.stock} value={i.quantity} onChange={e => updateItemQty(i.variantId, e.target.value)} className="co-qty-input" /></td>
                      <td>{formatMoney(i.price)}</td>
                      <td>{formatMoney(i.price * i.quantity)}</td>
                      <td><button type="button" className="icon-btn danger" onClick={() => removeItem(i.variantId)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="co-section">
          <h4>Coupon &amp; Shipping</h4>
          <div className="co-grid-2">
            <div className="form-field">
              <label className="form-field__label">Coupon Code (optional)</label>
              <div className="co-inline-input">
                <input type="text" className="form-input" value={couponCode} onChange={e => { setCouponCode(e.target.value); setCouponPreview(null); }} placeholder="SUMMER2026" />
                <button type="button" className="btn btn--outline btn--sm" onClick={handleApplyCoupon} disabled={couponChecking || !couponCode.trim()}>
                  {couponChecking ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {couponPreview && <p className="co-hint co-success">-{formatMoney(couponPreview.discountAmount)} applied</p>}
            </div>
            <FormField label="Shipping Cost">
              <input type="number" step="0.01" min="0" value={shippingCost} onChange={e => setShippingCost(e.target.value)} />
            </FormField>
          </div>

          <div className="co-pricing">
            <div className="co-pricing-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            {discountAmount > 0 && <div className="co-pricing-row co-success"><span>Discount</span><span>-{formatMoney(discountAmount)}</span></div>}
            <div className="co-pricing-row"><span>Shipping</span><span>{formatMoney(shippingCost)}</span></div>
            <div className="co-pricing-row co-total"><span>Estimated Total</span><span>{formatMoney(estimatedTotal)}</span></div>
            <p className="co-hint">Tax is calculated automatically at checkout using the active tax rate.</p>
          </div>
        </section>

        <section className="co-section">
          <h4>Payment</h4>
          <FormField label="Payment Method">
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </FormField>

          {paymentMethod === 'milestone_plan' ? (
            <div className="co-milestones">
              {milestones.map((m, idx) => (
                <div key={idx} className="co-milestone-row">
                  <input type="text" placeholder="Label (e.g. Deposit)" value={m.label} onChange={e => updateMilestone(idx, 'label', e.target.value)} />
                  <input type="number" step="0.01" min="0.01" placeholder="Amount" value={m.amountDue} onChange={e => updateMilestone(idx, 'amountDue', e.target.value)} />
                  <input type="date" value={m.dueDate} onChange={e => updateMilestone(idx, 'dueDate', e.target.value)} />
                  <button type="button" className="icon-btn danger" onClick={() => removeMilestone(idx)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn--outline btn--sm" onClick={addMilestone}><Plus size={14} /> Add Installment</button>
            </div>
          ) : (
            <FormField label="Payment Reference (optional)">
              <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="EFT reference, receipt #, etc." />
            </FormField>
          )}
        </section>

        <section className="co-section">
          <FormField label="Notes (optional)">
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </FormField>
        </section>

        <div className="co-actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        .co-form { display: flex; flex-direction: column; gap: 24px; }
        .co-section h4 { margin: 0 0 12px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary-text); }
        .co-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .co-toggle { display: flex; gap: 8px; margin-bottom: 14px; }
        .co-toggle button { flex: 1; padding: 8px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-muted); border-radius: 4px; cursor: pointer; font-size: 0.82rem; }
        .co-toggle button.active { background: var(--color-primary); color: var(--color-primary-text); border-color: var(--color-primary); }

        .co-search-wrap { position: relative; display: flex; align-items: center; }
        .co-search-icon { position: absolute; left: 10px; color: var(--color-text-muted); }
        .co-search-wrap input { width: 100%; padding-left: 30px; }
        .co-clear { position: absolute; right: 8px; background: none; border: none; cursor: pointer; color: var(--color-text-muted); }

        .co-dropdown { border: 1px solid var(--color-border); border-radius: 4px; margin-top: 4px; max-height: 200px; overflow-y: auto; background: var(--color-bg-card); }
        .co-dropdown-item { display: flex; justify-content: space-between; padding: 8px 12px; cursor: pointer; font-size: 0.82rem; gap: 10px; }
        .co-dropdown-item:hover { background: var(--color-surface); }
        .co-muted { color: var(--color-text-muted); font-size: 0.75rem; white-space: nowrap; }

        .co-table-wrap { overflow-x: auto; margin-top: 12px; }
        .co-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .co-table th { text-align: left; padding: 6px 8px; color: var(--color-text-muted); font-size: 0.7rem; text-transform: uppercase; border-bottom: 1px solid var(--color-border); }
        .co-table td { padding: 6px 8px; border-bottom: 1px solid var(--color-border-light); }
        .co-qty-input { width: 60px; }
        .icon-btn.danger { color: var(--color-error-text); background: none; border: none; cursor: pointer; }

        .co-inline-input { display: flex; gap: 8px; }
        .co-inline-input input { flex: 1; }
        .co-hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 6px 0 0; }
        .co-success { color: var(--color-success-text); }

        .co-pricing { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--color-border); }
        .co-pricing-row { display: flex; justify-content: space-between; font-size: 0.85rem; }
        .co-pricing-row.co-total { font-weight: 700; font-size: 0.95rem; padding-top: 6px; border-top: 1px solid var(--color-border); }

        .co-milestones { display: flex; flex-direction: column; gap: 8px; }
        .co-milestone-row { display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 8px; align-items: center; }

        .co-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 4px; }

        @media (max-width: 600px) {
          .co-grid-2 { grid-template-columns: 1fr; }
          .co-milestone-row { grid-template-columns: 1fr; }
        }
      `}} />
    </Drawer>
  );
}

export default CreateOrderDrawer;
