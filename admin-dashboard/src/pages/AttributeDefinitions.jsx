import { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import { SlidersHorizontal, Plus, Trash2, Layers } from 'lucide-react';

const FAMILIES = ['PERFUME', 'CANDLE', 'HOME_FRAGRANCE', 'ACCESSORY', 'GIFT_SET'];
const DATA_TYPES = ['TEXT', 'NUMBER', 'ENUM', 'BOOLEAN'];

const EMPTY_FORM = {
  key: '', label: '', family: 'CANDLE', dataType: 'TEXT', unit: '',
  optionsCsv: '', isFilterable: false, displayOrder: '0'
};

export function AttributeDefinitions() {
  const { showMessage } = useMessaging();
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminOpsApi.attributeDefinitions.list();
      setDefinitions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch attribute definitions:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDefinitions(); }, [fetchDefinitions]);

  const openCreate = (family) => {
    setForm({ ...EMPTY_FORM, family: family || 'CANDLE' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminOpsApi.attributeDefinitions.create({
        key: form.key,
        label: form.label,
        family: form.family,
        dataType: form.dataType,
        unit: form.unit || undefined,
        options: form.dataType === 'ENUM' ? form.optionsCsv.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        isFilterable: form.isFilterable,
        displayOrder: form.displayOrder
      });
      setShowModal(false);
      fetchDefinitions();
    } catch (err) {
      showMessage('error', 'Create Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (def) => {
    if (!window.confirm(`Delete "${def.label}"? Any product/variant values already using it are removed too.`)) return;
    try {
      await adminOpsApi.attributeDefinitions.delete(def.id);
      fetchDefinitions();
    } catch (err) {
      showMessage('error', 'Delete Failed', err.message);
    }
  };

  const grouped = FAMILIES.map(family => ({
    family,
    items: definitions.filter(d => d.family === family)
  }));

  return (
    <div className="attr-page">
      <PageHeader
        icon={<SlidersHorizontal size={22} />}
        title="Attribute Definitions"
        subtitle="Defines the extra fields each product family can carry — e.g. a Candle's Wax Type or Burn Time — without a developer or a database change. Configured here, rendered automatically in the product editor."
        actions={(
          <button className="btn btn--primary" onClick={() => openCreate()}>
            <Plus size={16} /> New Attribute
          </button>
        )}
      />

      {loading ? <LoadingState label="Loading attribute definitions..." /> : grouped.map(({ family, items }) => (
        <div className="card" key={family} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Layers size={16} color="var(--color-primary)" /> {family.replace('_', ' ')}
            </h3>
            <button className="btn btn--sm" onClick={() => openCreate(family)}><Plus size={14} /> Add</button>
          </div>
          {items.length === 0 ? (
            <EmptyState title="No attributes defined yet" description={`Add the first attribute for ${family.replace('_', ' ').toLowerCase()}.`} />
          ) : (
            <div className="attr-list">
              {items.map(def => (
                <div key={def.id} className="attr-row">
                  <div>
                    <span className="attr-label">{def.label}</span>
                    <span className="attr-key"> · {def.key}</span>
                  </div>
                  <div className="attr-meta">
                    <span className="attr-type">{def.dataType}{def.unit ? ` (${def.unit})` : ''}</span>
                    {def.isFilterable && <StatusBadge tone="info" label="Filterable" />}
                  </div>
                  <button className="icon-btn danger" onClick={() => handleDelete(def)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title="New Attribute" width={480}>
        <form onSubmit={handleSubmit} className="attr-form">
          <FormField label="Family">
            <select value={form.family} onChange={e => setForm(f => ({ ...f, family: e.target.value }))}>
              {FAMILIES.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
            </select>
          </FormField>
          <FormField label="Label (shown to admins)" required>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value, key: f.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }))} required placeholder="e.g. Wax Type" />
          </FormField>
          <FormField label="Key (used internally, no spaces)" required>
            <input type="text" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} required placeholder="wax_type" />
          </FormField>
          <div className="form-grid-2">
            <FormField label="Data Type">
              <select value={form.dataType} onChange={e => setForm(f => ({ ...f, dataType: e.target.value }))}>
                {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Unit (optional)">
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="hours, g, ml..." />
            </FormField>
          </div>
          {form.dataType === 'ENUM' && (
            <FormField label="Options (comma-separated)">
              <input type="text" value={form.optionsCsv} onChange={e => setForm(f => ({ ...f, optionsCsv: e.target.value }))} placeholder="Soy, Coconut, Beeswax" />
            </FormField>
          )}
          <div className="attr-checkboxes">
            <label><input type="checkbox" checked={form.isFilterable} onChange={e => setForm(f => ({ ...f, isFilterable: e.target.checked }))} /> Show as a storefront filter</label>
          </div>
          <div className="attr-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Attribute'}
            </button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .attr-list { display: flex; flex-direction: column; gap: var(--sp-2); }
        .attr-row { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-3) var(--sp-4); background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); }
        .attr-row > div:first-child { flex: 1; }
        .attr-label { font-weight: 500; font-size: 0.88rem; }
        .attr-key { color: var(--text-muted); font-size: 0.75rem; font-family: var(--f-mono, monospace); }
        .attr-meta { display: flex; gap: var(--sp-2); align-items: center; }
        .attr-type { font-size: 0.72rem; color: var(--text-muted); background: var(--bg-surface); padding: 2px var(--sp-2); border-radius: var(--r-pill); border: 1px solid var(--border-default); }
        .icon-btn.danger { color: var(--error); }

        .attr-form { display: flex; flex-direction: column; }
        .attr-checkboxes { display: flex; flex-direction: column; gap: var(--sp-3); font-size: 0.82rem; color: var(--text-muted); margin-bottom: var(--sp-5); }
        .attr-checkboxes label { display: flex; align-items: center; gap: var(--sp-2); }
        .attr-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }

        @media (max-width: 480px) {
          .attr-row { flex-wrap: wrap; }
          .attr-meta { flex-wrap: wrap; }
          .attr-actions { flex-wrap: wrap; }
          .attr-actions button { flex: 1; }
        }
      `}} />
    </div>
  );
}
