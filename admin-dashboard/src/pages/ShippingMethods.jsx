import { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import { Truck, Plus, Trash2, Pencil } from 'lucide-react';

const EMPTY_FORM = { key: '', name: '', trackingUrlTemplate: '', estimatedDays: '' };

export function ShippingMethods() {
  const { showMessage } = useMessaging();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminOpsApi.shippingMethods.list();
      setMethods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch shipping methods:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (method) => {
    setEditingId(method.id);
    setForm({ key: method.key, name: method.name, trackingUrlTemplate: method.trackingUrlTemplate || '', estimatedDays: method.estimatedDays?.toString() || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await adminOpsApi.shippingMethods.update(editingId, {
          name: form.name,
          trackingUrlTemplate: form.trackingUrlTemplate || undefined,
          estimatedDays: form.estimatedDays || undefined,
        });
      } else {
        await adminOpsApi.shippingMethods.create({
          key: form.key,
          name: form.name,
          trackingUrlTemplate: form.trackingUrlTemplate || undefined,
          estimatedDays: form.estimatedDays || undefined,
        });
      }
      setShowModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchMethods();
    } catch (err) {
      showMessage('error', editingId ? 'Update Failed' : 'Create Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (method) => {
    try {
      await adminOpsApi.shippingMethods.update(method.id, { active: !method.active });
      fetchMethods();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message);
    }
  };

  const handleDelete = async (method) => {
    if (!window.confirm(`Disable "${method.name}"? Historical orders keep their courier name; this only hides it from future dispatches.`)) return;
    try {
      await adminOpsApi.shippingMethods.delete(method.id);
      fetchMethods();
    } catch (err) {
      showMessage('error', 'Disable Failed', err.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Courier', render: (val, row) => (
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>{val}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{row.key}</p>
      </div>
    )},
    { key: 'estimatedDays', label: 'Est. Days', render: (val) => val ? `${val} days` : '—' },
    { key: 'active', label: 'Status', render: (val) => (
      <StatusBadge tone={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Disabled'} />
    )},
  ];

  return (
    <div className="shipping-methods-page">
      <PageHeader
        icon={<Truck size={22} />}
        title="Shipping Methods"
        subtitle="Couriers available for order dispatch and fulfillment tracking."
        actions={(
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={16} /> Add Courier
          </button>
        )}
      />

      {loading ? (
        <LoadingState label="Loading shipping methods..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={methods}
            emptyState={<EmptyState icon={<Truck size={40} />} title="No shipping methods configured" description="Add a courier to enable order dispatch." />}
            actions={(m) => (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="icon-btn" title="Edit" onClick={() => openEdit(m)}><Pencil size={14} /></button>
                <button className="btn btn--outline btn--sm" onClick={() => handleToggleActive(m)}>
                  {m.active ? 'Disable' : 'Enable'}
                </button>
                <button className="icon-btn danger" title="Disable" onClick={() => handleDelete(m)}><Trash2 size={14} /></button>
              </div>
            )}
          />
        </div>
      )}

      <Drawer isOpen={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? 'Edit Shipping Method' : 'Add Shipping Method'} width={440}>
        <form onSubmit={handleSubmit} className="admin-form">
          <FormField label="Courier Name" required>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, key: editingId ? f.key : (f.key || e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')) }))} required placeholder="e.g. The Courier Guy" />
          </FormField>
          <FormField label="Key (used internally)" required hint={editingId ? 'Key cannot be changed after creation.' : undefined}>
            <input type="text" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} required placeholder="THE_COURIER_GUY" disabled={!!editingId} />
          </FormField>
          <FormField label="Tracking URL Template (optional)" hint="Use {trackingNumber} as a placeholder.">
            <input type="text" value={form.trackingUrlTemplate} onChange={e => setForm(f => ({ ...f, trackingUrlTemplate: e.target.value }))} placeholder="https://example.com/track/{trackingNumber}" />
          </FormField>
          <FormField label="Estimated Delivery Days (optional)">
            <input type="number" min="1" value={form.estimatedDays} onChange={e => setForm(f => ({ ...f, estimatedDays: e.target.value }))} placeholder="3" />
          </FormField>
          <div className="attr-actions">
            <button type="button" className="btn" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Courier'}
            </button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .attr-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
        .icon-btn.danger { color: var(--color-error-text); }
      `}} />
    </div>
  );
}

export default ShippingMethods;
