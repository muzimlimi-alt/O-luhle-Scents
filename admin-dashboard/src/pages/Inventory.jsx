import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import { Boxes, AlertCircle, History, TrendingUp, TrendingDown, Search, Layers, Database, Landmark, PlusCircle, ArrowLeft } from 'lucide-react';
import { DateTime } from 'luxon';

const ADJUSTMENT_TYPES = [
  { value: 'ADJUSTMENT_ADD', label: 'Stock Correction (Add)' },
  { value: 'ADJUSTMENT_REMOVE', label: 'Stock Correction (Remove)' },
  { value: 'DAMAGED', label: 'Damaged / Write-off' },
  { value: 'CORRECTION', label: 'Other Correction' },
];

export function Inventory() {
  const { showMessage } = useMessaging();
  const [activeTab, setActiveTab] = useState('levels');
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState(null); // { variantId, label }
  const [editingThreshold, setEditingThreshold] = useState(null); // variantId
  const [thresholdValue, setThresholdValue] = useState('');
  const [adjustTarget, setAdjustTarget] = useState(null); // inventory item
  const [adjustForm, setAdjustForm] = useState({ direction: 'add', quantity: '', changeType: 'ADJUSTMENT_ADD', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  async function fetchData() {
    try {
      const [invData, logData] = await Promise.all([
        adminOpsApi.inventory.list(),
        adminOpsApi.inventory.logs(auditFilter?.variantId)
      ]);
      setItems(invData);
      setLogs(logData);
    } catch (err) {
      console.error('Failed to fetch inventory data:', err);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditFilter]);

  const filteredItems = items.filter(item =>
    item.variant?.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.variant?.size?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAudit = (item) => {
    setAuditFilter({ variantId: item.variantId, label: `${item.variant?.product?.name} (${item.variant?.size})` });
    setActiveTab('history');
  };

  const startThresholdEdit = (item) => {
    setEditingThreshold(item.variantId);
    setThresholdValue(String(item.lowStockThreshold));
  };

  const saveThreshold = async (variantId) => {
    const value = parseInt(thresholdValue);
    if (!Number.isFinite(value) || value < 0) return;
    try {
      await adminOpsApi.inventory.updateThreshold(variantId, value);
      setEditingThreshold(null);
      fetchData();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message);
    }
  };

  const openAdjust = (item) => {
    setAdjustTarget(item);
    setAdjustForm({ direction: 'add', quantity: '', changeType: 'ADJUSTMENT_ADD', reason: '' });
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    const qty = parseInt(adjustForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;

    setSubmitting(true);
    try {
      const quantityChange = adjustForm.direction === 'remove' ? -qty : qty;
      await adminOpsApi.inventory.adjust(adjustTarget.variantId, {
        quantityChange,
        changeType: adjustForm.changeType,
        reason: adjustForm.reason || undefined
      });
      setAdjustTarget(null);
      fetchData();
    } catch (err) {
      showMessage('error', 'Adjustment Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="elite-inventory-container animate-fade-in">
      <PageHeader
        icon={<Boxes size={22} />}
        title="Inventory"
        subtitle="Real-time stock levels and movement history."
      />

      <div className="discovery-matrix">
        <div className="tab-glass-panel">
          <button
            className={`tab-glass-btn ${activeTab === 'levels' ? 'active' : ''}`}
            onClick={() => setActiveTab('levels')}
          >
            <Layers size={18} /> Reserve Levels
          </button>
          <button
            className={`tab-glass-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} /> Movement Archive
          </button>
        </div>

        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input
            type="text"
            className="search-glass-input"
            placeholder="Discovery via variant or size..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="atelier-stats-grid">
          <div className="elite-glass inventory-kpi">
            <div className="kpi-top">
              <Database size={20} color="var(--color-primary)" />
              <span className="kpi-label">Master Catalog SKUs</span>
            </div>
            <h3 className="reservoir-count-absolute">{items.length}</h3>
          </div>
          <div className="elite-glass inventory-kpi error">
            <div className="kpi-top">
              <AlertCircle size={20} color="#e74c3c" />
              <span className="kpi-label">Depleted Reserves</span>
            </div>
            <h3 className="reservoir-count-absolute">{items.filter(i => i.quantity <= i.lowStockThreshold).length}</h3>
          </div>
        </div>

      {activeTab === 'levels' ? (
        <div className="atelier-grid fade-in-blur">
          {filteredItems.map(item => {
            const available = item.available ?? (item.quantity - item.reserved);
            const isLow = item.quantity <= item.lowStockThreshold;
            return (
              <div key={item.id} className="elite-glass inventory-card">
                <div className="inventory-card-top">
                  <div className="variant-info">
                    <span className="variant-title-absolute">{item.variant?.product?.name}</span>
                    <span className="variant-size">{item.variant?.size}</span>
                  </div>
                  <StatusBadge tone={isLow ? 'error' : 'success'} label={isLow ? 'Critical' : 'Optimal'} />
                </div>

                  <div className="inventory-metrics">
                    <div className="metric-glass headline">
                      <span className="metric-label">Available</span>
                      <span className="metric-value-direct">{available} Units</span>
                    </div>
                    <div className="metric-glass">
                      <span className="metric-label">On Hand</span>
                      <span className="metric-value-direct">{item.quantity} Units</span>
                    </div>
                    <div className="metric-glass">
                      <span className="metric-label">Reserved</span>
                      <span className="metric-value-direct">{item.reserved} Units</span>
                    </div>
                    {item.incoming > 0 && (
                      <div className="metric-glass">
                        <span className="metric-label">Incoming</span>
                        <span className="metric-value-direct" style={{ color: 'var(--color-success-text)' }}>+{item.incoming} Units</span>
                      </div>
                    )}
                    <div className="metric-glass">
                      <span className="metric-label">Reorder Level</span>
                      {editingThreshold === item.variantId ? (
                        <div className="threshold-edit">
                          <input
                            type="number"
                            autoFocus
                            value={thresholdValue}
                            onChange={(e) => setThresholdValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveThreshold(item.variantId)}
                          />
                          <button onClick={() => saveThreshold(item.variantId)}>Save</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="metric-value-direct editable"
                          onClick={() => startThresholdEdit(item)}
                          title="Click to edit reorder level"
                        >
                          {item.lowStockThreshold} Units
                        </button>
                      )}
                    </div>
                  </div>

                <div className="inventory-footer">
                  <span className="supplier-tag">
                    <Landmark size={12} /> {item.variant?.product?.supplier?.name || 'In-House'}
                  </span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-mini-action" onClick={() => openAdjust(item)}>
                      <PlusCircle size={14} /> Adjust
                    </button>
                    <button className="btn-mini-action" onClick={() => openAudit(item)}>
                      <History size={14} /> Audit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="fade-in-blur card">
          {auditFilter && (
            <div className="audit-filter-banner">
              <button className="btn-mini-action" onClick={() => setAuditFilter(null)}>
                <ArrowLeft size={14} /> Clear Filter
              </button>
              <span>Showing movements for <strong>{auditFilter.label}</strong></span>
            </div>
          )}
          <DataTable
            columns={[
              { key: 'quantityChanged', label: 'Change', render: (val) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: val > 0 ? 'var(--color-success-text)' : 'var(--color-error-text)' }}>
                  {val > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {val > 0 ? '+' : ''}{val} Units
                </div>
              )},
              { key: 'variant', label: 'Variant', render: (val) => (
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{val?.product?.name}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{val?.size}</p>
                </div>
              )},
              { key: 'changeType', label: 'Reason', render: (val, row) => (
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>{row.reason || '—'}</p>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{val}</p>
                </div>
              )},
              { key: 'referenceId', label: 'Reference', render: (val) => (
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-primary-text)' }}>
                  {val ? `#${val.split('-')[0].toUpperCase()}` : 'SYSTEM'}
                </span>
              )},
              { key: 'createdAt', label: 'Date', render: (val) => DateTime.fromISO(val).toFormat('dd LLL yyyy, HH:mm') },
            ]}
            data={logs}
            emptyState={<EmptyState icon={<History size={40} />} title="No movements recorded yet" description="Stock changes will be logged here." />}
          />
        </div>
      )}

      <Drawer isOpen={!!adjustTarget} onClose={() => setAdjustTarget(null)} title="Adjust Stock" width={440}>
        <p className="adjust-subtitle">{adjustTarget?.variant?.product?.name} ({adjustTarget?.variant?.size}) — currently {adjustTarget?.quantity} on hand</p>

        <form onSubmit={submitAdjust} className="elite-form">
          <FormField label="Direction">
            <div className="direction-toggle">
              <button type="button" className={adjustForm.direction === 'add' ? 'active' : ''} onClick={() => setAdjustForm(f => ({ ...f, direction: 'add', changeType: 'ADJUSTMENT_ADD' }))}>Add</button>
              <button type="button" className={adjustForm.direction === 'remove' ? 'active' : ''} onClick={() => setAdjustForm(f => ({ ...f, direction: 'remove', changeType: 'ADJUSTMENT_REMOVE' }))}>Remove</button>
            </div>
          </FormField>
          <FormField label="Quantity" required>
            <input
              type="number" min="1" required
              value={adjustForm.quantity}
              onChange={(e) => setAdjustForm(f => ({ ...f, quantity: e.target.value }))}
            />
          </FormField>
          <FormField label="Reason">
            <select
              value={adjustForm.changeType}
              onChange={(e) => setAdjustForm(f => ({ ...f, changeType: e.target.value }))}
            >
              {ADJUSTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="Note (optional)">
            <input
              type="text"
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Bottle cracked in transit"
            />
          </FormField>

          <div className="modal-actions-elite">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Adjustment'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setAdjustTarget(null)}>Cancel</button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-inventory-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }
        .atelier-header { margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }

        .discovery-matrix { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 24px; }

        .tab-glass-panel { background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 4px; display: flex; gap: 4px; }
        .tab-glass-btn { background: none; border: none; color: var(--color-text-muted); padding: 8px 16px; border-radius: 2px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: var(--transition); }
        .tab-glass-btn.active { background: var(--color-primary); color: #1a1611; }
        .tab-glass-btn:hover:not(.active) { color: var(--color-text); background: var(--color-border-light); }

        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 8px 16px; display: flex; align-items: center; flex: 1; max-width: 400px; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.85rem; }

        .atelier-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
        .inventory-kpi { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
        .inventory-kpi.error { border-color: rgba(231, 76, 60, 0.3); }
        .kpi-top { display: flex; align-items: center; gap: 12px; }
        .kpi-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-text-muted); font-weight: 800; }
        .reservoir-count-absolute {
          font-size: 2.5rem; font-weight: 800; font-family: var(--font-display);
          line-height: 1; margin: 0; color: var(--color-text-header);
        }

        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px; }

        .inventory-card { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .inventory-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .variant-info { display: flex; flex-direction: column; }
        .variant-title-absolute { font-weight: 700; font-size: 1.1rem; color: var(--color-text-header); }
        .variant-size { font-size: 0.75rem; color: var(--color-primary-text); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; }

        .inventory-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .metric-glass { padding: 12px; background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 4px; }
        .metric-glass.headline { grid-column: 1 / -1; border-color: var(--color-primary); background: rgba(184,155,106,0.08); }
        .metric-label { display: block; font-size: 0.65rem; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px; font-weight: 800; letter-spacing: 0.5px; }
        .metric-value-direct { font-weight: 700; font-size: 1rem; color: var(--color-text-header); }
        .metric-value-direct.editable { cursor: pointer; border: none; border-bottom: 1px dashed var(--color-primary); background: none; font-family: inherit; padding: 0; }
        .threshold-edit { display: flex; gap: 8px; align-items: center; }
        .threshold-edit input { width: 60px; padding: 4px 6px; border: 1px solid var(--color-border); border-radius: 2px; background: var(--color-bg-card); color: var(--color-text); }
        .threshold-edit button { background: var(--color-primary); color: #1a1611; border: none; padding: 4px 8px; border-radius: 2px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }

        .inventory-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--color-border); }
        .supplier-tag { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px; }
        .btn-mini-action { background: none; border: none; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 600; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--color-primary); }

        .audit-filter-banner { display: flex; align-items: center; gap: 16px; margin: 20px 20px 0; padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; font-size: 0.85rem; }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        .fade-in-blur { animation: eliteFadeIn 0.4s ease-out; }

        .adjust-subtitle { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 24px; }
        .elite-form { display: flex; flex-direction: column; }

        .direction-toggle { display: flex; gap: 8px; }
        .direction-toggle button { flex: 1; padding: 10px; border: 1.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-muted); border-radius: 4px; cursor: pointer; font-weight: 700; font-size: 0.8rem; }
        .direction-toggle button.active { border-color: var(--color-primary); color: var(--color-primary-text); background: rgba(184,155,106,0.08); }

        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }

        @media (max-width: 768px) {
          .discovery-matrix { flex-direction: column; align-items: stretch; }
          .atelier-stats-grid { grid-template-columns: 1fr; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
