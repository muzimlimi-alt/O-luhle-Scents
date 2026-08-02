import React, { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { SlidersHorizontal, Plus, Trash2, Layers } from 'lucide-react';

const FAMILIES = ['PERFUME', 'CANDLE', 'HOME_FRAGRANCE', 'ACCESSORY', 'GIFT_SET'];
const DATA_TYPES = ['TEXT', 'NUMBER', 'ENUM', 'BOOLEAN'];

const EMPTY_FORM = {
  key: '', label: '', family: 'CANDLE', dataType: 'TEXT', unit: '',
  optionsCsv: '', isFilterable: false, displayOrder: '0'
};

export function AttributeDefinitions() {
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
      alert('Failed to create attribute: ' + err.message);
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
      alert(err.message);
    }
  };

  const grouped = FAMILIES.map(family => ({
    family,
    items: definitions.filter(d => d.family === family)
  }));

  return (
    <div className="attr-page">
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title"><SlidersHorizontal size={20} style={{ verticalAlign: 'text-bottom', marginRight: 8 }} />Attribute Definitions</h2>
        <button className="btn btn--primary" onClick={() => openCreate()}>
          <Plus size={16} /> New Attribute
        </button>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Defines the extra fields each product family can carry — e.g. a Candle's Wax Type or Burn Time — without a developer or a database change. Configured here, rendered automatically in the product editor.
      </p>

      {loading ? <p>Loading...</p> : grouped.map(({ family, items }) => (
        <div className="card" key={family} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Layers size={16} color="var(--color-primary)" /> {family.replace('_', ' ')}
            </h3>
            <button className="btn btn--sm" onClick={() => openCreate(family)}><Plus size={14} /> Add</button>
          </div>
          {items.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No attributes defined yet.</p>
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
                    {def.isFilterable && <span className="attr-tag">filterable</span>}
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
          <div className="attr-field">
            <label>Family</label>
            <select value={form.family} onChange={e => setForm(f => ({ ...f, family: e.target.value }))}>
              {FAMILIES.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="attr-field">
            <label>Label (shown to admins)</label>
            <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value, key: f.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }))} required placeholder="e.g. Wax Type" />
          </div>
          <div className="attr-field">
            <label>Key (used internally, no spaces)</label>
            <input type="text" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} required placeholder="wax_type" />
          </div>
          <div className="form-grid-2">
            <div className="attr-field">
              <label>Data Type</label>
              <select value={form.dataType} onChange={e => setForm(f => ({ ...f, dataType: e.target.value }))}>
                {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="attr-field">
              <label>Unit (optional)</label>
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="hours, g, ml..." />
            </div>
          </div>
          {form.dataType === 'ENUM' && (
            <div className="attr-field">
              <label>Options (comma-separated)</label>
              <input type="text" value={form.optionsCsv} onChange={e => setForm(f => ({ ...f, optionsCsv: e.target.value }))} placeholder="Soy, Coconut, Beeswax" />
            </div>
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
        .attr-list { display: flex; flex-direction: column; gap: 8px; }
        .attr-row { display: flex; align-items: center; gap: 16px; padding: 10px 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; }
        .attr-row > div:first-child { flex: 1; }
        .attr-label { font-weight: 600; font-size: 0.88rem; }
        .attr-key { color: var(--color-text-muted); font-size: 0.75rem; font-family: monospace; }
        .attr-meta { display: flex; gap: 8px; align-items: center; }
        .attr-type { font-size: 0.72rem; color: var(--color-text-muted); background: var(--color-bg-card); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--color-border); }
        .attr-tag { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary); }
        .icon-btn.danger { color: var(--color-error-text, #c0392b); }

        .attr-form { display: flex; flex-direction: column; gap: 16px; }
        .attr-field { display: flex; flex-direction: column; gap: 6px; }
        .attr-field label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
        .attr-field input, .attr-field select {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 10px 12px; color: var(--color-text); font-size: 0.85rem;
        }
        .attr-checkboxes { display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; color: var(--color-text-muted); }
        .attr-checkboxes label { display: flex; align-items: center; gap: 8px; }
        .attr-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }

        @media (max-width: 480px) {
          .attr-row { flex-wrap: wrap; }
          .attr-meta { flex-wrap: wrap; }
        }
      `}} />
    </div>
  );
}
