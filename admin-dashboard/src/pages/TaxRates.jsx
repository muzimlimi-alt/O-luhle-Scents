import React, { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import { Percent, Plus, Trash2 } from 'lucide-react';

const EMPTY_FORM = { name: '', rate: '', region: '', isDefault: false };

export function TaxRates() {
  const { showMessage } = useMessaging();
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminOpsApi.taxRates.list();
      setRates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch tax rates:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminOpsApi.taxRates.create({
        name: form.name,
        rate: parseFloat(form.rate) / 100,
        region: form.region || undefined,
        isDefault: form.isDefault,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchRates();
    } catch (err) {
      showMessage('error', 'Create Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (rate) => {
    try {
      await adminOpsApi.taxRates.update(rate.id, { active: !rate.active });
      fetchRates();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message);
    }
  };

  const handleDelete = async (rate) => {
    if (!window.confirm(`Disable "${rate.name}"?`)) return;
    try {
      await adminOpsApi.taxRates.delete(rate.id);
      fetchRates();
    } catch (err) {
      showMessage('error', 'Disable Failed', err.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Tax Rate', render: (val, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
        <Percent size={14} color="var(--color-primary)" /> {val}
        {row.isDefault && <StatusBadge tone="info" label="Default" />}
      </div>
    )},
    { key: 'rate', label: 'Rate', render: (val) => `${(Number(val) * 100).toFixed(2)}%` },
    { key: 'region', label: 'Region', render: (val) => val || 'All regions' },
    { key: 'active', label: 'Status', render: (val) => (
      <StatusBadge tone={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Disabled'} />
    )},
  ];

  return (
    <div className="tax-rates-page">
      <PageHeader
        icon={<Percent size={22} />}
        title="Tax Rates"
        subtitle="Applied automatically to checkout and admin-created orders based on region, or the default rate if none matches."
        actions={(
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Tax Rate
          </button>
        )}
      />

      {loading ? (
        <LoadingState label="Loading tax rates..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={rates}
            emptyState={<EmptyState icon={<Percent size={40} />} title="No tax rates configured" description="Orders will be created with no tax applied until a rate is added." />}
            actions={(r) => (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn--outline btn--sm" onClick={() => handleToggleActive(r)}>
                  {r.active ? 'Disable' : 'Enable'}
                </button>
                <button className="icon-btn danger" title="Disable" onClick={() => handleDelete(r)}><Trash2 size={14} /></button>
              </div>
            )}
          />
        </div>
      )}

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title="Add Tax Rate" width={440}>
        <form onSubmit={handleSubmit} className="admin-form">
          <FormField label="Name" required>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. VAT" />
          </FormField>
          <FormField label="Rate (%)" required>
            <input type="number" step="0.01" min="0" max="100" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} required placeholder="15" />
          </FormField>
          <FormField label="Region (optional)" hint="Leave blank to apply everywhere, or set as the default below.">
            <input type="text" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} placeholder="Western Cape" />
          </FormField>
          <label className="tax-default-check">
            <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
            Use as the default rate when no region matches
          </label>
          <div className="attr-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Tax Rate'}
            </button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .attr-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
        .icon-btn.danger { color: var(--color-error-text); }
        .tax-default-check { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 20px; }
      `}} />
    </div>
  );
}

export default TaxRates;
