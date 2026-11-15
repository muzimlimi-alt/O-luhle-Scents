import { useState, useEffect, useCallback } from 'react';
import { catalogueApi, categoriesApi, collectionsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Plus, UploadCloud, Play, CheckCircle2, XCircle, Trash2, Check, X, ArrowRight, Image as ImageIcon,
} from 'lucide-react';

// Catalogue imports page: three stacked zones.
//   1. Sources — logical origins (seasonal catalogues, supplier price lists).
//   2. Imports — one row per uploaded PDF; actions are Process, Delete.
//   3. Review — expands an import, lists its ExtractedProducts for admin
//      edit / approve / reject / import.
//
// Products NEVER auto-publish from here; `/import` lands them as DRAFT in
// the main Products table, where the admin flips them to ACTIVE.

const IMPORT_STATUS_TONE = {
  UPLOADED: 'neutral',
  PROCESSING: 'warning',
  EXTRACTED: 'info',
  AWAITING_REVIEW: 'warning',
  APPROVED: 'success',
  IMPORTED: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
};

const EXTRACTED_STATUS_TONE = {
  PENDING: 'neutral',
  APPROVED: 'success',
  REJECTED: 'danger',
  IMPORTED: 'success',
};

const PRODUCT_FAMILIES = ['PERFUME', 'CANDLE', 'HOME_FRAGRANCE', 'ACCESSORY', 'GIFT_SET', 'BATH_SALT'];

export function CatalogueImports() {
  const { showMessage } = useMessaging();
  const { hasPermission } = useAuth();
  const canSourceWrite = hasPermission('catalogue', 'source:write');
  const canSourceDelete = hasPermission('catalogue', 'source:delete');
  const canUpload = hasPermission('catalogue', 'upload');
  const canProcess = hasPermission('catalogue', 'process');
  const canReview = hasPermission('catalogue', 'review');
  const canImport = hasPermission('catalogue', 'import');

  const [sources, setSources] = useState([]);
  const [imports, setImports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceForm, setSourceForm] = useState({ name: '', description: '' });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ sourceId: '', file: null, familyHint: '' });

  const [selectedImport, setSelectedImport] = useState(null);
  const [extracted, setExtracted] = useState([]);
  const [extractedLoading, setExtractedLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, i, c, cc] = await Promise.all([
        catalogueApi.listSources(),
        catalogueApi.listImports(),
        categoriesApi.list(),
        collectionsApi.list(),
      ]);
      setSources(Array.isArray(s) ? s : []);
      setImports(Array.isArray(i) ? i : []);
      setCategories(Array.isArray(c) ? c : []);
      setCollections(Array.isArray(cc) ? cc : []);
    } catch (err) {
      showMessage('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openReview = async (imp) => {
    setSelectedImport(imp);
    setExtractedLoading(true);
    try {
      const rows = await catalogueApi.listExtracted(imp.id);
      setExtracted(Array.isArray(rows) ? rows : []);
    } catch (err) {
      showMessage('error', 'Failed to load extracted products', err.message);
    } finally {
      setExtractedLoading(false);
    }
  };

  const refreshExtracted = async () => {
    if (!selectedImport) return;
    const rows = await catalogueApi.listExtracted(selectedImport.id);
    setExtracted(Array.isArray(rows) ? rows : []);
  };

  // ── Source actions ──
  const handleCreateSource = async (e) => {
    e.preventDefault();
    try {
      await catalogueApi.createSource(sourceForm);
      setShowSourceModal(false);
      setSourceForm({ name: '', description: '' });
      fetchAll();
    } catch (err) {
      showMessage('error', 'Create Failed', err.message);
    }
  };

  // ── Import actions ──
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.sourceId || !uploadForm.file) {
      showMessage('error', 'Missing fields', 'Pick a source and a PDF file.');
      return;
    }
    try {
      const imp = await catalogueApi.uploadImport(uploadForm.sourceId, uploadForm.file);
      setShowUploadModal(false);
      setUploadForm({ sourceId: '', file: null, familyHint: '' });
      if (uploadForm.familyHint) {
        try {
          await catalogueApi.processImport(imp.id, uploadForm.familyHint);
        } catch (err) {
          showMessage('warning', 'Uploaded, but extraction failed', err.message);
        }
      }
      fetchAll();
    } catch (err) {
      showMessage('error', 'Upload Failed', err.message);
    }
  };

  const handleProcess = async (imp) => {
    const familyHint = window.prompt(
      'Family hint (PERFUME / CANDLE / BATH_SALT). Leave blank to auto-detect.',
      imp.sourceName?.toLowerCase().includes('candle') ? 'CANDLE' : 'PERFUME'
    );
    if (familyHint === null) return;
    try {
      await catalogueApi.processImport(imp.id, familyHint || null);
      fetchAll();
      if (selectedImport?.id === imp.id) refreshExtracted();
    } catch (err) {
      showMessage('error', 'Process Failed', err.message);
    }
  };

  const handleDeleteImport = async (imp) => {
    if (!window.confirm(`Delete this import (${imp.originalFilename})? Extracted rows go with it.`)) return;
    try {
      await catalogueApi.deleteImport(imp.id);
      if (selectedImport?.id === imp.id) {
        setSelectedImport(null);
        setExtracted([]);
      }
      fetchAll();
    } catch (err) {
      showMessage('error', 'Delete Failed', err.message);
    }
  };

  const handleImportAll = async (imp) => {
    if (!window.confirm('Import every APPROVED row from this catalogue? Products land as DRAFT.')) return;
    try {
      const res = await catalogueApi.importAll(imp.id);
      showMessage('success', 'Import complete', `${res.imported} product(s) created as draft, ${res.failed} failed.`);
      fetchAll();
      if (selectedImport?.id === imp.id) refreshExtracted();
    } catch (err) {
      showMessage('error', 'Import Failed', err.message);
    }
  };

  // ── Extracted-product actions ──
  const handleApprove = async (row) => {
    try {
      await catalogueApi.approveExtracted(row.id);
      refreshExtracted();
    } catch (err) {
      showMessage('error', 'Approve Failed', err.message);
    }
  };

  const handleReject = async (row) => {
    const reason = window.prompt('Reject reason (optional):', '');
    if (reason === null) return;
    try {
      await catalogueApi.rejectExtracted(row.id, reason);
      refreshExtracted();
    } catch (err) {
      showMessage('error', 'Reject Failed', err.message);
    }
  };

  const handleImportOne = async (row) => {
    try {
      await catalogueApi.importExtracted(row.id);
      showMessage('success', 'Product created', `${row.name} is now a DRAFT product.`);
      refreshExtracted();
      fetchAll();
    } catch (err) {
      showMessage('error', 'Import Failed', err.message);
    }
  };

  const handleEditField = async (row, field, value) => {
    try {
      await catalogueApi.updateExtracted(row.id, { [field]: value });
      refreshExtracted();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message);
    }
  };

  const handleImageUpload = async (row, file) => {
    try {
      await catalogueApi.uploadExtractedImage(row.id, file);
      refreshExtracted();
    } catch (err) {
      showMessage('error', 'Image Upload Failed', err.message);
    }
  };

  const handleImageRemove = async (row, filename) => {
    try {
      await catalogueApi.removeExtractedImage(row.id, filename);
      refreshExtracted();
    } catch (err) {
      showMessage('error', 'Image Remove Failed', err.message);
    }
  };

  // ── Rendering ──
  const importsColumns = [
    { key: 'originalFilename', label: 'File', render: (v) => <code style={{ fontSize: '0.72rem' }}>{v}</code> },
    { key: 'source', label: 'Source', render: (v) => v?.name || '—' },
    { key: 'status', label: 'Status', render: (v) => (
      <StatusBadge tone={IMPORT_STATUS_TONE[v] || 'neutral'} label={v} />
    )},
    { key: '_count', label: 'Extracted', render: (v) => v?.extractedProducts ?? 0 },
    { key: 'createdAt', label: 'Uploaded', render: (v) => new Date(v).toLocaleString() },
  ];

  const extractedCategoriesForFamily = (family) => {
    // Filter categories loosely — admin can still pick anything, this is
    // just a convenience default based on the extracted family hint.
    if (!family) return categories;
    const wanted = { PERFUME: 'perfume', CANDLE: 'candles', BATH_SALT: 'bath-salts' }[family];
    if (!wanted) return categories;
    const match = categories.find((c) => c.slug === wanted);
    return match ? [match, ...categories.filter((c) => c.id !== match.id)] : categories;
  };

  return (
    <div className="catalogue-page">
      <PageHeader
        icon={<FileText size={22} />}
        title="Catalogue Imports"
        subtitle="Upload a supplier catalogue, extract products, review, approve, and import them as DRAFT product records."
      />

      {/* Sources */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-head">
          <h3>Sources</h3>
          {canSourceWrite && (
            <button className="btn btn--primary" onClick={() => setShowSourceModal(true)}>
              <Plus size={16} /> New Source
            </button>
          )}
        </div>
        <div className="source-list">
          {sources.length === 0 ? (
            <p className="muted">No catalogue sources yet. Create one, then upload a PDF under it.</p>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="source-chip">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.description && <div className="muted small">{s.description}</div>}
                </div>
                <span className="small muted">{s._count?.imports ?? 0} import(s)</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Imports */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-head">
          <h3>Imports</h3>
          {canUpload && (
            <button
              className="btn btn--primary"
              onClick={() => setShowUploadModal(true)}
              disabled={sources.length === 0}
            >
              <UploadCloud size={16} /> Upload PDF
            </button>
          )}
        </div>
        <DataTable
          columns={importsColumns}
          data={imports}
          loading={loading}
          actions={(row) => (
            <div style={{ display: 'flex', gap: 6 }}>
              {canProcess && (
                <button className="icon-btn" title="Process (extract)" onClick={() => handleProcess(row)}>
                  <Play size={14} />
                </button>
              )}
              <button
                className="icon-btn"
                title="Review extracted"
                onClick={() => openReview({ ...row, sourceName: row.source?.name })}
              >
                <ArrowRight size={14} />
              </button>
              {canImport && (
                <button
                  className="icon-btn"
                  title="Import all approved → DRAFT products"
                  onClick={() => handleImportAll(row)}
                  disabled={row.status === 'IMPORTED'}
                >
                  <CheckCircle2 size={14} />
                </button>
              )}
              {canProcess && (
                <button className="icon-btn" title="Delete" onClick={() => handleDeleteImport(row)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        />
      </div>

      {/* Review drawer */}
      <Drawer
        isOpen={!!selectedImport}
        onClose={() => { setSelectedImport(null); setExtracted([]); }}
        title={selectedImport ? `Review: ${selectedImport.originalFilename}` : ''}
        width={720}
      >
        {extractedLoading ? (
          <p className="muted">Loading…</p>
        ) : extracted.length === 0 ? (
          <p className="muted">
            No extracted rows yet. Click Process on the import first, or the PDF layout wasn't recognised by the parser.
          </p>
        ) : (
          <div className="extracted-list">
            {extracted.map((row) => (
              <div key={row.id} className="extracted-row">
                <div className="extracted-head">
                  <input
                    type="text"
                    className="inline-input"
                    defaultValue={row.name}
                    onBlur={(e) => { if (e.target.value !== row.name) handleEditField(row, 'name', e.target.value); }}
                  />
                  <StatusBadge tone={EXTRACTED_STATUS_TONE[row.status]} label={row.status} />
                </div>

                <div className="extracted-meta">
                  <FormField label="Family">
                    <select
                      value={row.family || ''}
                      onChange={(e) => handleEditField(row, 'family', e.target.value || null)}
                    >
                      <option value="">—</option>
                      {PRODUCT_FAMILIES.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </FormField>

                  <FormField label="Category">
                    <select
                      value={row.suggestedCategoryId || ''}
                      onChange={(e) => handleEditField(row, 'suggestedCategoryId', e.target.value || null)}
                    >
                      <option value="">—</option>
                      {extractedCategoriesForFamily(row.family).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Collection">
                    <select
                      value={row.suggestedCollectionId || ''}
                      onChange={(e) => handleEditField(row, 'suggestedCollectionId', e.target.value || null)}
                    >
                      <option value="">—</option>
                      {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FormField>

                  <FormField label="Price hint (R)">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={row.priceHint ?? ''}
                      onBlur={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        if (val !== row.priceHint) handleEditField(row, 'priceHint', val);
                      }}
                    />
                  </FormField>
                </div>

                {row.description && (
                  <p className="extracted-desc">{row.description}</p>
                )}

                <div className="extracted-variants">
                  <strong className="small">Variants:</strong>{' '}
                  {Array.isArray(row.variantsJson) && row.variantsJson.length > 0 ? (
                    row.variantsJson.map((v, idx) => (
                      <span key={idx} className="chip">
                        {v.size} — R{Number(v.price).toFixed(2)}
                      </span>
                    ))
                  ) : (
                    <span className="muted small">none extracted</span>
                  )}
                </div>

                {/* Image strip — thumbnails + add button. First image becomes
                    the product's primaryImage once the row is imported. */}
                <div className="extracted-images">
                  <strong className="small">Images:</strong>
                  {Array.isArray(row.imagesJson) && row.imagesJson.length > 0 ? (
                    row.imagesJson.map((filename) => (
                      <div key={filename} className="extracted-image-thumb">
                        <img src={`/images/products/${filename}`} alt="" />
                        {canReview && (
                          <button
                            className="extracted-image-remove"
                            title="Remove"
                            onClick={() => handleImageRemove(row, filename)}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="muted small">none attached</span>
                  )}
                  {canReview && (
                    <label className="extracted-image-add" title="Add image">
                      <ImageIcon size={14} />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(row, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>

                <div className="extracted-actions">
                  {row.status === 'PENDING' && canReview && (
                    <>
                      <button className="btn btn--sm btn--primary" onClick={() => handleApprove(row)}>
                        <Check size={14} /> Approve
                      </button>
                      <button className="btn btn--sm" onClick={() => handleReject(row)}>
                        <X size={14} /> Reject
                      </button>
                    </>
                  )}
                  {row.status === 'APPROVED' && (
                    <>
                      {canImport && (
                        <button className="btn btn--sm btn--primary" onClick={() => handleImportOne(row)}>
                          <ArrowRight size={14} /> Import → DRAFT product
                        </button>
                      )}
                      {canReview && (
                        <button className="btn btn--sm" onClick={() => handleReject(row)}>
                          <X size={14} /> Change to Reject
                        </button>
                      )}
                    </>
                  )}
                  {row.status === 'REJECTED' && canReview && (
                    <button className="btn btn--sm" onClick={() => handleApprove(row)}>
                      <Check size={14} /> Reinstate (Approve)
                    </button>
                  )}
                  {row.status === 'IMPORTED' && (
                    <span className="muted small">
                      Live product id: <code>{row.importedProductId}</code>
                    </span>
                  )}
                </div>

                {row.rejectReason && (
                  <p className="muted small" style={{ marginTop: 6 }}>
                    <XCircle size={12} /> {row.rejectReason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* New source modal */}
      <Drawer
        isOpen={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        title="New Catalogue Source"
        width={480}
      >
        <form onSubmit={handleCreateSource} className="src-form">
          <FormField label="Name" required>
            <input
              type="text"
              value={sourceForm.name}
              onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
              required
              placeholder="e.g. Officina Del Toca — Perfumes 2026"
            />
          </FormField>
          <FormField label="Description">
            <textarea
              rows={3}
              value={sourceForm.description}
              onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
              placeholder="Who supplied it, what range, which year."
            />
          </FormField>
          <div className="src-actions">
            <button type="button" className="btn" onClick={() => setShowSourceModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">Create Source</button>
          </div>
        </form>
      </Drawer>

      {/* Upload modal */}
      <Drawer
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Catalogue PDF"
        width={480}
      >
        <form onSubmit={handleUpload} className="src-form">
          <FormField label="Source" required>
            <select
              value={uploadForm.sourceId}
              onChange={(e) => setUploadForm({ ...uploadForm, sourceId: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="PDF file" required>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
              required
            />
          </FormField>
          <FormField label="Extract now? Pick the product family">
            <select
              value={uploadForm.familyHint}
              onChange={(e) => setUploadForm({ ...uploadForm, familyHint: e.target.value })}
            >
              <option value="">Just upload; I'll process later</option>
              <option value="PERFUME">Extract as Perfumes</option>
              <option value="CANDLE">Extract as Candles</option>
              <option value="BATH_SALT">Extract as Bath Salts</option>
            </select>
          </FormField>
          <div className="src-actions">
            <button type="button" className="btn" onClick={() => setShowUploadModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary"><UploadCloud size={14} /> Upload</button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-3); }
        .section-head h3 { margin: 0; }
        .source-list { display: flex; flex-wrap: wrap; gap: 10px; }
        .source-chip {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 10px 14px; border: 1px solid var(--color-border); border-radius: 8px;
          min-width: 260px; background: var(--color-surface-subtle, transparent);
        }
        .extracted-list { display: flex; flex-direction: column; gap: 12px; }
        .extracted-row {
          border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;
          background: var(--color-surface-subtle, transparent);
        }
        .extracted-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 10px; }
        .inline-input { flex: 1; font-weight: 600; font-size: 0.95rem; }
        .extracted-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 8px; }
        .extracted-desc { font-size: 0.85rem; color: var(--color-text-muted); margin: 6px 0; }
        .extracted-variants { font-size: 0.8rem; margin: 6px 0; }
        .chip { display: inline-block; padding: 2px 8px; margin-right: 6px; background: var(--color-bg-subtle, #eee); border-radius: 12px; font-size: 0.72rem; }
        .extracted-images { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 10px 0; font-size: 0.8rem; }
        .extracted-image-thumb {
          position: relative; width: 56px; height: 56px; border-radius: 6px; overflow: hidden;
          border: 1px solid var(--color-border);
        }
        .extracted-image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .extracted-image-remove {
          position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%;
          background: rgba(0,0,0,0.6); color: #fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .extracted-image-add {
          width: 56px; height: 56px; border-radius: 6px; border: 1px dashed var(--color-border);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          color: var(--color-text-muted);
        }
        .extracted-image-add:hover { border-color: var(--color-gold-light, #c9a96a); color: var(--color-gold-light, #c9a96a); }
        .extracted-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
        .src-form { display: flex; flex-direction: column; }
        .src-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }
        .muted { color: var(--color-text-muted); }
        .small { font-size: 0.75rem; }
      `}} />
    </div>
  );
}
