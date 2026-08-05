import React, { useState, useEffect, useCallback } from 'react';
import { adminOpsApi, productsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { ShoppingCart, Eye, Truck, Barcode, Plus, Trash2, PackageCheck, Sparkles, Wallet } from 'lucide-react';

const STATUS_TONE = { PENDING: 'warning', RECEIVED: 'success', CANCELLED: 'error' };
const PAYMENT_STATUS_TONE = { unpaid: 'neutral', partially_paid: 'warning', paid: 'success' };

const EMPTY_ITEM = { variantId: '', quantity: '1', costPrice: '' };
const EMPTY_PAY_FORM = { method: 'eft', amount: '', reference: '', notes: '' };

const remainingBalance = (purchase) => {
  const paid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  return Math.max(Number(purchase.totalCost || 0) - paid, 0);
};

export function Purchases() {
  const { showMessage } = useMessaging();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [variantOptions, setVariantOptions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [form, setForm] = useState({ supplierId: '', expectedDelivery: '', items: [{ ...EMPTY_ITEM }] });
  const [lowStockBySupplier, setLowStockBySupplier] = useState([]);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [payForm, setPayForm] = useState(EMPTY_PAY_FORM);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminOpsApi.purchases.list();
      setPurchases(data);
    } catch (err) {
      console.error('Purchases API failed:', err.message);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
    adminOpsApi.suppliers.list().then(setSuppliers).catch(() => setSuppliers([]));
    productsApi.list({ limit: 100 }).then(res => {
      const options = (res.products || []).flatMap(p =>
        (p.variants || []).map(v => ({
          id: v.id,
          label: `${p.name} — ${v.size} (${v.sku})`,
          costPrice: v.costPrice || ''
        }))
      );
      setVariantOptions(options);
    }).catch(() => setVariantOptions([]));
    adminOpsApi.inventory.list().then(inv => {
      const lowStock = inv.filter(i => i.quantity <= i.lowStockThreshold && i.variant?.product?.supplierId);
      const groups = {};
      lowStock.forEach(i => {
        const supplierId = i.variant.product.supplierId;
        if (!groups[supplierId]) {
          groups[supplierId] = { supplierId, supplierName: i.variant.product.supplier?.name || 'Unknown Supplier', items: [] };
        }
        // Suggest topping back up to double the reorder level.
        const suggestedQty = Math.max(i.lowStockThreshold * 2 - i.quantity, 1);
        groups[supplierId].items.push({
          variantId: i.variantId,
          label: `${i.variant.product.name} — ${i.variant.size} (${i.variant.sku})`,
          quantity: suggestedQty,
          costPrice: i.variant.costPrice || ''
        });
      });
      setLowStockBySupplier(Object.values(groups));
    }).catch(() => setLowStockBySupplier([]));
  }, [fetchPurchases]);

  const openModal = () => {
    setForm({ supplierId: '', expectedDelivery: '', items: [{ ...EMPTY_ITEM }] });
    setShowModal(true);
  };

  const draftFromSuggestion = (group) => {
    setForm({
      supplierId: group.supplierId,
      expectedDelivery: '',
      items: group.items.map(i => ({ variantId: i.variantId, quantity: String(i.quantity), costPrice: String(i.costPrice) }))
    });
    setShowModal(true);
  };

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'variantId') {
        const match = variantOptions.find(v => v.id === value);
        if (match?.costPrice) items[index].costPrice = String(match.costPrice);
      }
      return { ...prev, items };
    });
  };

  const addItemRow = () => setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  const removeItemRow = (index) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const items = form.items.filter(i => i.variantId && parseInt(i.quantity) > 0);
    if (!items.length) return showMessage('warning', 'Missing Line Items', 'Add at least one line item with a variant and quantity.');

    setSubmitting(true);
    try {
      await adminOpsApi.purchases.create({
        supplierId: form.supplierId || null,
        expectedDelivery: form.expectedDelivery || null,
        items
      });
      setShowModal(false);
      fetchPurchases();
    } catch (err) {
      showMessage('error', 'Create Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (purchase) => {
    if (!window.confirm(`Mark Purchase Order #${purchase.id.split('-')[0].toUpperCase()} as received? This will add its items to stock.`)) return;
    setReceivingId(purchase.id);
    try {
      await adminOpsApi.purchases.receive(purchase.id);
      fetchPurchases();
    } catch (err) {
      showMessage('error', 'Receive Failed', err.message);
    } finally {
      setReceivingId(null);
    }
  };

  const openPayDrawer = (purchase) => {
    setPayingPurchase(purchase);
    setPayForm({ ...EMPTY_PAY_FORM, amount: remainingBalance(purchase).toFixed(2) });
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return showMessage('warning', 'Invalid Amount', 'Enter a positive payment amount.');
    }
    setPaySubmitting(true);
    try {
      await adminOpsApi.purchases.pay(payingPurchase.id, {
        method: payForm.method,
        amount,
        reference: payForm.reference || null,
        notes: payForm.notes || null,
      });
      setPayingPurchase(null);
      fetchPurchases();
    } catch (err) {
      showMessage('error', 'Payment Failed', err.message);
    } finally {
      setPaySubmitting(false);
    }
  };

  const columns = [
    { key: 'id', label: 'Purchase ID', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontFamily: 'monospace' }}>
        <Barcode size={16} color="var(--color-primary)" /> #{val.split('-')[0].toUpperCase()}
      </div>
    )},
    { key: 'supplier', label: 'Supplier', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Truck size={14} color="var(--color-text-muted)" /> {val?.name || '—'}
      </div>
    )},
    { key: 'items', label: 'Items', render: (val) => `${val?.length || 0} line item(s)` },
    { key: 'totalCost', label: 'Total Cost', render: (val) => `R${Number(val || 0).toLocaleString()}` },
    { key: 'taxAmount', label: 'VAT', render: (val) => val > 0 ? `R${Number(val).toLocaleString()}` : '—' },
    { key: 'status', label: 'Status', render: (val) => (
      <StatusBadge tone={STATUS_TONE[val] || 'neutral'} label={val} />
    )},
    { key: 'paymentStatus', label: 'AP Status', render: (val, row) => (
      <StatusBadge tone={PAYMENT_STATUS_TONE[val] || 'neutral'} label={row.status === 'RECEIVED' ? (val || 'unpaid').replace('_', ' ') : '—'} />
    )},
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="purchases-page">
      <PageHeader
        icon={<ShoppingCart size={22} />}
        title="Stock Purchases"
        subtitle="Purchase orders and goods-received tracking."
        actions={(
          <button className="btn btn--primary" onClick={openModal}>
            <Plus size={16} /> New Purchase Order
          </button>
        )}
      />

      {lowStockBySupplier.length > 0 && (
        <div className="card suggested-reorders">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Sparkles size={18} color="var(--color-primary)" /> Suggested Reorders
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Low-stock items grouped by preferred supplier — draft a purchase order pre-filled to top back up to double the reorder level.
          </p>
          <div className="suggestion-list">
            {lowStockBySupplier.map(group => (
              <div key={group.supplierId} className="suggestion-row">
                <span className="suggestion-supplier"><Truck size={14} /> {group.supplierName}</span>
                <span className="suggestion-count">{group.items.length} item(s) low on stock</span>
                <button className="btn btn--sm btn--primary" onClick={() => draftFromSuggestion(group)}>
                  Draft PO
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <DataTable
          columns={columns}
          data={purchases}
          loading={loading}
          actions={(row) => (
            <>
              <button className="icon-btn" title="View Detail"><Eye size={16} /></button>
              {row.status === 'PENDING' && (
                <button
                  className="icon-btn"
                  title="Receive Goods"
                  disabled={receivingId === row.id}
                  onClick={() => handleReceive(row)}
                >
                  <PackageCheck size={16} />
                </button>
              )}
              {row.status === 'RECEIVED' && row.paymentStatus !== 'paid' && (
                <button className="icon-btn" title="Pay Supplier" onClick={() => openPayDrawer(row)}>
                  <Wallet size={16} />
                </button>
              )}
            </>
          )}
        />
      </div>

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title="New Purchase Order" width={560}>
        <form onSubmit={handleSubmit} className="po-form">
          <div className="po-row">
            <FormField label="Supplier">
              <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Expected Delivery">
              <input type="date" value={form.expectedDelivery} onChange={e => setForm(f => ({ ...f, expectedDelivery: e.target.value }))} />
            </FormField>
          </div>

          <div className="po-items-header">
            <label>Line Items</label>
            <button type="button" className="icon-btn" onClick={addItemRow}><Plus size={16} /></button>
          </div>

          {form.items.map((item, i) => (
            <div key={i} className="po-item-row">
              <select value={item.variantId} onChange={e => updateItem(i, 'variantId', e.target.value)} required>
                <option value="">Select variant...</option>
                {variantOptions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
              <input type="number" step="0.01" min="0" placeholder="Cost (R)" value={item.costPrice} onChange={e => updateItem(i, 'costPrice', e.target.value)} />
              <button type="button" className="icon-btn danger" onClick={() => removeItemRow(i)} disabled={form.items.length === 1}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div className="po-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer isOpen={!!payingPurchase} onClose={() => setPayingPurchase(null)} title="Pay Supplier" width={440}>
        {payingPurchase && (
          <form onSubmit={handlePaySubmit} className="admin-form">
            <p className="pay-summary">
              Purchase Order #{payingPurchase.id.split('-')[0].toUpperCase()} — {payingPurchase.supplier?.name || 'Unknown Supplier'}
              <br />
              Total: R{Number(payingPurchase.totalCost || 0).toLocaleString()} · Remaining: <strong>R{remainingBalance(payingPurchase).toLocaleString()}</strong>
            </p>
            <FormField label="Method" required>
              <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}>
                <option value="eft">EFT</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Amount (R)" required>
              <input type="number" step="0.01" min="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required />
            </FormField>
            <FormField label="Reference (optional)">
              <input type="text" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="EFT reference / receipt number" />
            </FormField>
            <FormField label="Notes (optional)">
              <textarea rows={3} value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
            <div className="attr-actions">
              <button type="button" className="btn" onClick={() => setPayingPurchase(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={paySubmitting}>
                {paySubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .pay-summary { font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 20px; line-height: 1.6; }
        .attr-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
        .suggested-reorders { margin-bottom: 24px; }
        .suggestion-list { display: flex; flex-direction: column; gap: 10px; }
        .suggestion-row {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
        }
        .suggestion-supplier { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.85rem; }
        .suggestion-count { color: var(--color-text-muted); font-size: 0.8rem; flex: 1; text-align: right; margin-right: 8px; }

        .po-form { display: flex; flex-direction: column; }
        .po-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .po-item-row select, .po-item-row input {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 10px 12px; color: var(--color-text); font-size: 0.85rem;
        }

        .po-items-header { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .po-items-header label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }

        .po-item-row { display: grid; grid-template-columns: 2fr 80px 100px 36px; gap: 8px; align-items: center; }

        .po-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px; }
        .icon-btn.danger { color: var(--color-error-text, #c0392b); }

        @media (max-width: 600px) {
          .po-row { grid-template-columns: 1fr; }
          .po-item-row { grid-template-columns: 1fr; gap: 6px; padding: 10px; border: 1px solid var(--color-border); border-radius: 4px; }
        }
      `}} />
    </div>
  );
}
