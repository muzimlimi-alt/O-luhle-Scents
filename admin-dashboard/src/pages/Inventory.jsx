import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminOpsApi, metricsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import { Boxes, History, TrendingUp, TrendingDown, Search, Layers, Landmark, PlusCircle, ArrowLeft, TriangleAlert, Ban, Truck, ShoppingBag } from 'lucide-react';
import { DateTime } from 'luxon';

const ADJUSTMENT_TYPES = [
  { value: 'ADJUSTMENT_ADD', label: 'Stock Correction (Add)' },
  { value: 'ADJUSTMENT_REMOVE', label: 'Stock Correction (Remove)' },
  { value: 'DAMAGED', label: 'Damaged / Write-off' },
  { value: 'CORRECTION', label: 'Other Correction' },
];

const PURCHASE_STATUS_TONE = { PENDING: 'warn', RECEIVED: 'ok', CANCELLED: 'bad' };

const VIEW_KEY = 'toca_inventory_view';

function loadView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'table' || saved === 'grid' ? saved : 'grid';
  } catch {
    return 'grid';
  }
}

export function Inventory() {
  const { showMessage } = useMessaging();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('levels');
  const [view, setView] = useState(loadView);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState(null); // { variantId, label }
  const [editingThreshold, setEditingThreshold] = useState(null); // variantId
  const [thresholdValue, setThresholdValue] = useState('');
  const [adjustTarget, setAdjustTarget] = useState(null); // inventory item
  const [adjustForm, setAdjustForm] = useState({ direction: 'add', quantity: '', changeType: 'ADJUSTMENT_ADD', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const [stockValue, setStockValue] = useState(0);
  const [predictions, setPredictions] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* noop */ }
  }, [view]);

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

  // Everything the merged reference cards need, fetched once — all
  // already-existing endpoints, none of it new backend work.
  useEffect(() => {
    metricsApi.dashboard().then((m) => setStockValue(m.stockValue || 0)).catch(() => {});
    metricsApi.predictions().then((p) => setPredictions(Array.isArray(p) ? p : [])).catch(() => {});
    adminOpsApi.suppliers.list().then((s) => setSuppliers(Array.isArray(s) ? s : [])).catch(() => {});
    adminOpsApi.purchases.list().then((p) => setPurchases(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);

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

  const totalUnits = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const belowReorder = items.filter(i => i.quantity <= i.lowStockThreshold);
  const outOfStock = items.filter(i => (i.quantity - i.reserved) <= 0);
  const incomingUnits = items.reduce((s, i) => s + (i.incoming || 0), 0);

  const predictionsByVariant = Object.fromEntries(predictions.map((p) => [p.variantId, p]));
  const openPurchases = purchases.filter((p) => p.status === 'PENDING');
  const supplierPoCounts = purchases.reduce((acc, p) => {
    if (p.supplierId) acc[p.supplierId] = (acc[p.supplierId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="elite-inventory-container animate-fade-in">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Commerce</li><li aria-current="page">Inventory</li></ol>
          <h1>Inventory</h1>
          <p className="sub">{items.length} SKUs tracked · {belowReorder.length} below reorder point</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/purchases')}>
            <ShoppingBag size={14} /> New purchase order
          </button>
        </div>
      </div>

      <div className="grid kpi-row mb-6">
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Stock on hand</h2><span className="ic" aria-hidden="true"><Boxes size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{totalUnits.toLocaleString()} <small>units</small></p>
          <p className="kpi-foot">Valued at R {stockValue.toLocaleString()} at cost</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Below reorder point</h2><span className="ic" aria-hidden="true"><TriangleAlert size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{belowReorder.length} <small>SKUs</small></p>
          <p className="kpi-foot"><span className={`delta ${belowReorder.length > 0 ? 'down' : 'flat'}`}>{belowReorder.length > 0 ? 'Action needed' : 'All healthy'}</span></p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Out of stock</h2><span className="ic" aria-hidden="true"><Ban size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{outOfStock.length} <small>SKUs</small></p>
          <p className="kpi-foot"><span className={`delta ${outOfStock.length > 0 ? 'down' : 'flat'}`}>Available stock at zero</span></p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Incoming stock</h2><span className="ic" aria-hidden="true"><Truck size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{incomingUnits.toLocaleString()} <small>units</small></p>
          <p className="kpi-foot">On {openPurchases.length} open purchase order{openPurchases.length === 1 ? '' : 's'}</p>
        </article>
      </div>

      {belowReorder.length > 0 && (
        <section className="card mb-6" aria-labelledby="h-low">
          <div className="card-head"><div><h3 id="h-low">Needs <em>attention</em></h3><p className="hint">At or below reorder point</p></div></div>
          <div className="card-body flush">
            <div className="t-scroll">
              <table className="tbl">
                <caption className="vh">Products at or below their reorder point</caption>
                <thead><tr><th scope="col">Product</th><th scope="col">Supplier</th><th scope="col" className="num">On hand</th><th scope="col" className="num">Reorder at</th><th scope="col" className="num">Days cover</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {belowReorder.map((item) => {
                    const pred = predictionsByVariant[item.variantId];
                    const soldOut = (item.quantity - item.reserved) <= 0;
                    return (
                      <tr key={item.id}>
                        <th scope="row" className="tbl-rowhead">
                          <button type="button" className="row-link" onClick={() => openAdjust(item)}>
                            <span className="mono-thumb" aria-hidden="true">{item.variant?.product?.name?.charAt(0) || '?'}</span>
                            <span className="cell-stack">{item.variant?.product?.name}<span className="sub">{item.variant?.sku}</span></span>
                          </button>
                        </th>
                        <td>{item.variant?.product?.supplier?.name || 'In-house'}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{item.lowStockThreshold}</td>
                        <td className="num">{pred ? (pred.daysRemaining >= 999 ? '—' : pred.daysRemaining) : '—'}</td>
                        <td>{soldOut ? <span className="pill bad">Sold out</span> : <span className="pill warn">Low</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="card mb-6">
        <div className="card-head">
          <h3>Reserve Levels</h3>
          <div className="seg" role="group" aria-label="Inventory view">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
          </div>
        </div>

        <div className="toolbar">
          <span className="field-inline">
            <Search size={13} aria-hidden="true" />
            <label className="vh" htmlFor="invSearch">Search inventory</label>
            <input
              className="input"
              id="invSearch"
              type="search"
              placeholder="Search by product or size…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>
          <span className="push mono">{filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}</span>
        </div>

        {activeTab === 'levels' && view === 'table' && (
          <div className="card-body flush">
            <div className="t-scroll">
              <table className="tbl">
                <caption className="vh">Full inventory list with on-hand, reserved and available stock</caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Supplier</th>
                    <th scope="col" className="num">On hand</th>
                    <th scope="col" className="num">Reserved</th>
                    <th scope="col" className="num">Available</th>
                    <th scope="col" className="num">Incoming</th>
                    <th scope="col" className="num">Reorder at</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="vh">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const available = item.available ?? (item.quantity - item.reserved);
                    const isLow = item.quantity <= item.lowStockThreshold;
                    return (
                      <tr key={item.id}>
                        <th scope="row" className="tbl-rowhead">
                          <span className="row-link-static">
                            <span className="mono-thumb" aria-hidden="true">{item.variant?.product?.name?.charAt(0) || '?'}</span>
                            <span className="cell-stack">{item.variant?.product?.name}<span className="sub">{item.variant?.size} · {item.variant?.sku}</span></span>
                          </span>
                        </th>
                        <td>{item.variant?.product?.supplier?.name || 'In-house'}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{item.reserved}</td>
                        <td className="num strong">{available}</td>
                        <td className="num">{item.incoming > 0 ? `+${item.incoming}` : '—'}</td>
                        <td className="num">
                          {editingThreshold === item.variantId ? (
                            <span className="threshold-edit">
                              <input
                                type="number"
                                autoFocus
                                value={thresholdValue}
                                onChange={(e) => setThresholdValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveThreshold(item.variantId)}
                              />
                              <button type="button" onClick={() => saveThreshold(item.variantId)}>Save</button>
                            </span>
                          ) : (
                            <button type="button" className="threshold-inline" onClick={() => startThresholdEdit(item)} title="Click to edit reorder level">
                              {item.lowStockThreshold}
                            </button>
                          )}
                        </td>
                        <td>{available <= 0 ? <span className="pill bad">Sold out</span> : isLow ? <span className="pill warn">Low</span> : <span className="pill ok">Optimal</span>}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="icon-mini" aria-label={`Adjust stock for ${item.variant?.product?.name}`} onClick={() => openAdjust(item)}><PlusCircle size={13} /></button>
                            <button type="button" className="icon-mini" aria-label={`View movement history for ${item.variant?.product?.name}`} onClick={() => openAudit(item)}><History size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 0 }}><EmptyState title="No inventory found" description="Adjust your search to see more items." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'levels' && view === 'grid' && (
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
                          <span className="metric-value-direct" style={{ color: 'var(--success-text)' }}>+{item.incoming} Units</span>
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
        )}

        {activeTab === 'history' && (
          <div className="card-body flush">
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: val > 0 ? 'var(--success-text)' : 'var(--error-text)' }}>
                    {val > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {val > 0 ? '+' : ''}{val} Units
                  </div>
                )},
                { key: 'variant', label: 'Variant', render: (val) => (
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{val?.product?.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{val?.size}</p>
                  </div>
                )},
                { key: 'changeType', label: 'Reason', render: (val, row) => (
                  <div>
                    <p style={{ margin: 0, fontSize: '0.8rem' }}>{row.reason || '—'}</p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{val}</p>
                  </div>
                )},
                { key: 'referenceId', label: 'Reference', render: (val) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--y-base)' }}>
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

        <div className="tab-foot">
          <div className="tab-glass-panel">
            <button
              className={`tab-glass-btn ${activeTab === 'levels' ? 'active' : ''}`}
              onClick={() => setActiveTab('levels')}
            >
              <Layers size={16} /> Reserve Levels
            </button>
            <button
              className={`tab-glass-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={16} /> Movement Archive
            </button>
          </div>
        </div>
      </section>

      <div className="grid g-2 mb-6">
        <section className="card">
          <div className="card-head"><div><h3>Suppliers</h3><p className="hint">Raw materials &amp; components</p></div></div>
          <div className="card-body flush">
            <div className="t-scroll">
              <table className="tbl">
                <caption className="vh">Supplier list</caption>
                <thead><tr><th scope="col">Supplier</th><th scope="col">Contact</th><th scope="col" className="num">Purchase orders</th></tr></thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <th scope="row" className="tbl-rowhead strong">{s.name}</th>
                      <td className="mono">{s.contactEmail || s.phone || '—'}</td>
                      <td className="num">{supplierPoCounts[s.id] || 0}</td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 0 }}><EmptyState title="No suppliers yet" description="Suppliers you add will appear here." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div><h3>Open purchase <em>orders</em></h3></div>{openPurchases.length > 0 && <span className="pill info">{openPurchases.length} pending</span>}</div>
          <div className="card-body flush">
            <div className="t-scroll">
              <table className="tbl">
                <caption className="vh">Open purchase orders</caption>
                <thead><tr><th scope="col">PO</th><th scope="col">Supplier</th><th scope="col" className="num">Value</th><th scope="col">Due</th></tr></thead>
                <tbody>
                  {openPurchases.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="tbl-rowhead mono strong">#{p.id.slice(0, 8).toUpperCase()}</th>
                      <td>{p.supplier?.name || '—'}</td>
                      <td className="num">R {Number(p.totalCost || 0).toLocaleString()}</td>
                      <td>{p.expectedDelivery ? DateTime.fromISO(p.expectedDelivery).toFormat('dd LLL') : '—'}</td>
                    </tr>
                  ))}
                  {openPurchases.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 0 }}><EmptyState title="No open purchase orders" description="Purchase orders awaiting delivery will appear here." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

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
        .elite-inventory-container { padding: 40px; max-width: 1600px; margin: 0 auto; min-height: 100vh; }

        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .elite-inventory-container .card { border-color: var(--border-low); }
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
        .head-actions { display: flex; align-items: center; gap: var(--sp-3); }

        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
          min-height: var(--tap); padding: 0 var(--sp-5);
          border-radius: var(--r); font-size: .86rem; font-weight: 500;
          letter-spacing: .06em; text-transform: uppercase;
          border: 1px solid transparent; cursor: pointer; text-decoration: none;
          background: var(--y-base); color: var(--text-inverse);
          transition: all var(--t-fast) var(--ease); white-space: nowrap;
        }
        .btn-primary:hover { background: var(--y-hover); box-shadow: 0 6px 22px rgba(var(--y-rgb), .3); color: var(--text-inverse); text-decoration: none; }
        .btn-sm { min-height: 36px; padding: 0 var(--sp-4); font-size: .74rem; }
        .btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

        .grid { display: grid; gap: var(--sp-5); }
        .kpi-row { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .g-2 { grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 1024px) { .g-2 { grid-template-columns: 1fr; } }

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
        .delta { font-family: var(--f-mono); font-weight: 500; }
        .delta.down { color: var(--error); }
        .delta.flat { color: var(--text-muted); }

        .card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low); flex-wrap: wrap; }
        .card-head h3 { font-size: 1.15rem; }
        .card-head .hint { font-size: .76rem; color: var(--text-muted); margin-top: 2px; }
        .card-body { padding: var(--sp-5); }
        .card-body.flush { padding: 0; }

        .seg { display: flex; border: 1px solid var(--border-default); border-radius: var(--r); overflow: hidden; }
        .seg button { min-height: var(--tap); padding: 0 var(--sp-4); font-size: .76rem; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); background: none; border: none; border-right: 1px solid var(--border-low); cursor: pointer; transition: all var(--t-fast) var(--ease); }
        .seg button:last-child { border-right: 0; }
        .seg button:hover { color: var(--text-primary); background: var(--bg-elevated); }
        .seg button[aria-pressed="true"] { background: rgba(var(--y-rgb), .14); color: var(--y-base); }

        .toolbar { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-low); }
        .field-inline { position: relative; min-width: 240px; display: inline-flex; align-items: center; }
        .field-inline svg { position: absolute; left: 12px; color: var(--text-muted); pointer-events: none; }
        .input {
          height: var(--tap); padding: 0 var(--sp-4);
          background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-primary); font-family: var(--f-body); font-weight: 300; font-size: .86rem;
        }
        .field-inline .input { width: 100%; padding-left: 36px; }
        .input::placeholder { color: var(--text-muted); }
        .input:hover { border-color: var(--border-strong); }
        .input:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }
        .push { margin-left: auto; }
        .mono { font-family: var(--f-mono); font-size: .76rem; color: var(--text-muted); }

        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th { text-align: left; font-weight: 400; font-size: .66rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-default); white-space: nowrap; background: var(--bg-section); }
        .tbl th.num, .tbl td.num { text-align: right; }
        .tbl td, .tbl th.tbl-rowhead { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-low); color: var(--text-secondary); vertical-align: middle; font-weight: 400; text-align: left; }
        .tbl tbody tr:hover { background: rgba(255, 255, 255, .028); }
        .tbl tbody tr:last-child td, .tbl tbody tr:last-child th { border-bottom: 0; }
        .tbl .strong { color: var(--text-primary); }
        .tbl .num, .tbl .mono { font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-size: .83rem; }

        .row-link, .row-link-static { display: inline-flex; align-items: center; gap: var(--sp-3); background: none; border: none; cursor: pointer; text-align: left; color: inherit; padding: 0; }
        .row-link:hover .cell-stack { color: var(--y-base); }
        .row-link:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); border-radius: var(--r); }
        .cell-stack { display: flex; flex-direction: column; line-height: 1.35; color: var(--text-primary); transition: color var(--t-fast) var(--ease); }
        .cell-stack .sub { font-size: .74rem; color: var(--text-muted); font-family: var(--f-mono); }
        .mono-thumb {
          display: inline-grid; place-items: center; width: 34px; height: 34px; flex: none;
          border: 1px solid var(--border-default);
          background: linear-gradient(160deg, rgba(var(--y-rgb), .14), rgba(var(--y-rgb), .03));
          font-family: var(--f-display); font-size: 1.05rem; color: var(--y-light);
        }

        .threshold-inline { background: none; border: none; border-bottom: 1px dashed var(--y-base); color: var(--text-primary); cursor: pointer; font-family: var(--f-mono); font-size: .83rem; padding: 0; }
        .threshold-edit { display: inline-flex; gap: 6px; align-items: center; }
        .threshold-edit input { width: 56px; padding: 4px 6px; border: 1px solid var(--border-default); border-radius: var(--r); background: var(--bg-elevated); color: var(--text-primary); font-family: var(--f-mono); }
        .threshold-edit button { background: var(--y-base); color: var(--text-inverse); border: none; padding: 4px 8px; border-radius: var(--r); font-size: .7rem; font-weight: 700; cursor: pointer; }

        .icon-mini { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border-low); border-radius: var(--r); color: var(--text-muted); background: none; cursor: pointer; }
        .icon-mini:hover { border-color: var(--y-base); color: var(--y-base); }
        .row-actions { display: flex; gap: 6px; justify-content: flex-end; }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.ok { color: var(--success); border-color: rgba(var(--ok-rgb), .4); background: rgba(var(--ok-rgb), .09); }
        .pill.warn { color: var(--warning); border-color: rgba(var(--warn-rgb), .4); background: rgba(var(--warn-rgb), .09); }
        .pill.bad { color: var(--error); border-color: rgba(var(--bad-rgb), .4); background: rgba(var(--bad-rgb), .09); }
        .pill.info { color: var(--info); border-color: rgba(var(--info-rgb), .4); background: rgba(var(--info-rgb), .09); }

        .tab-foot { padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--border-low); }
        .tab-glass-panel { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r); padding: 4px; display: inline-flex; gap: 4px; }
        .tab-glass-btn { background: none; border: none; color: var(--text-muted); padding: 8px 16px; border-radius: var(--r); font-weight: 500; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: var(--transition); }
        .tab-glass-btn.active { background: var(--y-base); color: var(--text-inverse); }
        .tab-glass-btn:hover:not(.active) { color: var(--text-primary); background: var(--bg-surface); }

        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-5); padding: var(--sp-5); }

        .inventory-card { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .inventory-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .variant-info { display: flex; flex-direction: column; }
        .variant-title-absolute { font-weight: 700; font-size: 1.1rem; color: var(--text-primary); }
        .variant-size { font-size: 0.75rem; color: var(--y-base); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; }

        .inventory-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .metric-glass { padding: 12px; background: var(--bg-section); border: 1px solid var(--border-low); border-radius: var(--r); }
        .metric-glass.headline { grid-column: 1 / -1; border-color: var(--y-base); background: rgba(var(--y-rgb),0.08); }
        .metric-label { display: block; font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; font-weight: 800; letter-spacing: 0.5px; }
        .metric-value-direct { font-weight: 700; font-size: 1rem; color: var(--text-primary); }
        .metric-value-direct.editable { cursor: pointer; border: none; border-bottom: 1px dashed var(--y-base); background: none; font-family: inherit; padding: 0; }

        .inventory-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-default); }
        .supplier-tag { font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
        .btn-mini-action { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 500; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--y-base); }

        .audit-filter-banner { display: flex; align-items: center; gap: 16px; margin: 20px 20px 0; padding: 12px 16px; background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); font-size: 0.85rem; }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        .fade-in-blur { animation: eliteFadeIn 0.4s ease-out; }

        .adjust-subtitle { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 24px; }
        .elite-form { display: flex; flex-direction: column; }

        .direction-toggle { display: flex; gap: 8px; }
        .direction-toggle button { flex: 1; padding: 10px; border: 1.5px solid var(--border-default); background: var(--bg-section); color: var(--text-muted); border-radius: var(--r); cursor: pointer; font-weight: 700; font-size: 0.8rem; }
        .direction-toggle button.active { border-color: var(--y-base); color: var(--y-base); background: rgba(var(--y-rgb),0.08); }

        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }

        @media (max-width: 768px) {
          .elite-inventory-container { padding: 20px; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
