import { useState, useEffect, useCallback, useRef } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { Plus, Check, X, RotateCcw, Pencil, Trash2, Quote, GripVertical, ArrowUpDown, ImagePlus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { testimonialsApi } from '../services/api';

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'error' };
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');
const EMPTY_FORM = { name: '', designation: '', quote: '', photo: null, clearImage: false };

function monogram(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

export default function Testimonials() {
  const { showMessage } = useMessaging();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = "add" mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Pending count always reflects the true total, independent of the active
  // filter — the badge shouldn't disappear just because an admin filtered
  // the table down to "Approved".
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await testimonialsApi.list(statusFilter);
      setItems(rows);
      const countSource = statusFilter ? await testimonialsApi.list() : rows;
      setPendingCount(countSource.filter(r => r.status === 'pending').length);
    } catch (err) {
      showMessage('error', 'Load Failed', err.message || 'Unable to load testimonials.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showMessage]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPhotoPreview(null);
    setDrawerOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ name: item.name, designation: item.designation || '', quote: item.quote, photo: null, clearImage: false });
    setPhotoPreview(item.imagePath ? `${API_ORIGIN}/${item.imagePath}` : null);
    setDrawerOpen(true);
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(prev => ({ ...prev, photo: file, clearImage: false }));
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleClearPhoto() {
    setForm(prev => ({ ...prev, photo: null, clearImage: true }));
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.quote.trim()) {
      showMessage('warning', 'Missing Fields', 'Name and testimonial quote are required.');
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.append('name', form.name.trim());
      body.append('designation', form.designation.trim());
      body.append('quote', form.quote.trim());
      if (form.photo) body.append('photo', form.photo);
      if (form.clearImage) body.append('clearImage', 'true');

      if (editing) {
        await testimonialsApi.update(editing.id, body);
        showMessage('success', 'Testimonial Updated', 'Changes have been saved.');
      } else {
        await testimonialsApi.create(body);
        showMessage('success', 'Testimonial Added', 'It is now live on the storefront.');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message || 'Unable to save this testimonial.');
    } finally {
      setSaving(false);
    }
  }

  async function handleModerate(item, status) {
    try {
      await testimonialsApi.update(item.id, { status });
      const VERB = { approved: 'approved', rejected: 'rejected', pending: 'returned to pending' };
      showMessage('success', 'Status Updated', `${item.name}'s testimonial was ${VERB[status]}.`);
      load();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message || 'Unable to update this testimonial.');
    }
  }

  async function handleDelete() {
    try {
      await testimonialsApi.remove(deleteTarget.id);
      showMessage('success', 'Testimonial Deleted', 'The entry has been permanently removed.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showMessage('error', 'Deletion Failed', err.message || 'Unable to delete this testimonial.');
    }
  }

  function openReorder() {
    setReorderList(items.filter(i => i.status === 'approved').map(i => ({ ...i })));
    setReorderOpen(true);
  }

  async function saveReorder() {
    setReorderSaving(true);
    try {
      await Promise.all(reorderList.map((item, index) =>
        item.displayOrder === index ? null : testimonialsApi.update(item.id, { displayOrder: index })
      ));
      showMessage('success', 'Order Saved', 'The storefront spotlight order has been updated.');
      setReorderOpen(false);
      load();
    } catch (err) {
      showMessage('error', 'Reorder Failed', err.message || 'Unable to save the new order.');
    } finally {
      setReorderSaving(false);
    }
  }

  const columns = [
    {
      key: 'name', label: 'Testimonial', render: (_, row) => (
        <div className="testimonial-cell">
          <div className="testimonial-cell__avatar">
            {row.imagePath ? <img src={`${API_ORIGIN}/${row.imagePath}`} alt={row.name} /> : monogram(row.name)}
          </div>
          <div>
            <strong>{row.name}</strong>
            {row.designation && <div className="text-muted">{row.designation}</div>}
          </div>
        </div>
      )
    },
    { key: 'quote', label: 'Quote', render: (v) => <span title={v} className="testimonial-quote-cell">{v.length > 90 ? `${v.slice(0, 90)}…` : v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge tone={STATUS_TONE[v]} label={v[0].toUpperCase() + v.slice(1)} /> },
    { key: 'submittedBy', label: 'Source', render: (v) => v[0].toUpperCase() + v.slice(1) },
    { key: 'createdAt', label: 'Submitted', render: (v) => new Date(v).toLocaleDateString() },
  ];

  const renderActions = (row) => (
    <div className="action-cell-inner">
      {row.status === 'pending' ? (
        <>
          <button className="icon-btn" title="Approve" onClick={() => handleModerate(row, 'approved')}><Check size={16} /></button>
          <button className="icon-btn danger" title="Reject" onClick={() => handleModerate(row, 'rejected')}><X size={16} /></button>
        </>
      ) : (
        <button className="icon-btn" title="Back to pending" onClick={() => handleModerate(row, 'pending')}><RotateCcw size={16} /></button>
      )}
      <button className="icon-btn" title="Edit" onClick={() => openEdit(row)}><Pencil size={16} /></button>
      <button className="icon-btn danger" title="Delete" onClick={() => setDeleteTarget(row)}><Trash2 size={16} /></button>
    </div>
  );

  const approvedCount = items.filter(i => i.status === 'approved').length;

  return (
    <div className="testimonials-page animate-fade-in">
      <PageHeader
        icon={<Quote size={22} />}
        title="Testimonials"
        subtitle="Visitors can submit a testimonial from the storefront — review and approve before it appears publicly."
        actions={
          <>
            <button className="btn btn--outline" onClick={openReorder} disabled={approvedCount < 2}>
              <ArrowUpDown size={16} /> Reorder Display
            </button>
            <button className="btn btn--primary" onClick={openAdd}>
              <Plus size={16} /> Add Testimonial
            </button>
          </>
        }
      />

      <div className="testimonials-filter-row">
        <div className="select-glass-wrapper">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        {pendingCount > 0 && <StatusBadge tone="warning" label={`${pendingCount} Pending Review`} />}
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={items}
          actions={renderActions}
          loading={loading}
          emptyState={<EmptyState icon={<Quote size={32} />} title="No testimonials yet" description="Approved and pending submissions will appear here." />}
        />
      </div>

      {/* ADD/EDIT DRAWER */}
      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Testimonial' : 'Add Testimonial'} width={480}>
        <form onSubmit={handleSubmit} className="testimonial-form">
          <FormField label="Name" required>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.slice(0, 120) }))} placeholder="Client name" maxLength={120} required />
          </FormField>
          <FormField label="Designation" hint="Role or company — optional">
            <input type="text" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value.slice(0, 120) }))} placeholder="e.g. Loyal Customer" maxLength={120} />
          </FormField>
          <FormField label="Testimonial" required>
            <textarea rows={4} value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} placeholder="What did they say about TOCA?" required />
          </FormField>

          <div className="testimonial-photo-field">
            <span className="form-field__label">Photo <span className="hint-text">(optional)</span></span>
            <div className="testimonial-photo-row">
              <div className="testimonial-photo-preview">
                {photoPreview ? <img src={photoPreview} alt="Preview" /> : <span>{monogram(form.name)}</span>}
              </div>
              <div className="testimonial-photo-actions">
                <label className="btn btn--outline btn--sm testimonial-photo-upload">
                  <ImagePlus size={14} /> {photoPreview ? 'Replace' : 'Upload'}
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
                {photoPreview && (
                  <button type="button" className="btn btn--outline btn--sm btn--danger-outline" onClick={handleClearPhoto}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="drawer-actions">
            <button type="button" className="btn btn--outline" onClick={() => setDrawerOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Testimonial'}
            </button>
          </div>
        </form>
      </Drawer>

      {/* REORDER MODAL */}
      <Modal isOpen={reorderOpen} onClose={() => setReorderOpen(false)} title="Reorder Storefront Display" maxWidth={480}>
        <p className="reorder-hint">Drag to set the order approved testimonials appear in on the storefront spotlight.</p>
        <ReactSortable list={reorderList} setList={setReorderList} className="reorder-list" animation={200} handle=".reorder-drag">
          {reorderList.map((item) => (
            <div key={item.id} className="reorder-item">
              <span className="reorder-drag"><GripVertical size={16} /></span>
              <div className="testimonial-cell__avatar reorder-item__avatar">
                {item.imagePath ? <img src={`${API_ORIGIN}/${item.imagePath}`} alt={item.name} /> : monogram(item.name)}
              </div>
              <div className="reorder-item__text">
                <strong>{item.name}</strong>
                <span title={item.quote}>{item.quote.length > 60 ? `${item.quote.slice(0, 60)}…` : item.quote}</span>
              </div>
            </div>
          ))}
        </ReactSortable>
        <div className="drawer-actions">
          <button type="button" className="btn btn--outline" onClick={() => setReorderOpen(false)}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={saveReorder} disabled={reorderSaving}>
            {reorderSaving ? 'Saving…' : 'Save Order'}
          </button>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Testimonial" maxWidth={420}>
        <div style={{ textAlign: 'center' }}>
          <Trash2 size={40} color="var(--color-error-text)" style={{ margin: '0 auto 20px auto' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '30px' }}>
            Permanently remove {deleteTarget?.name}'s testimonial? This cannot be undone.
          </p>
          <div className="drawer-actions" style={{ justifyContent: 'center' }}>
            <button className="btn btn--outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn--danger" onClick={handleDelete}>Yes, Delete It</button>
          </div>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .testimonials-page { padding: var(--sp-7); max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .testimonials-filter-row { display: flex; gap: var(--sp-3); align-items: center; margin-bottom: var(--sp-5); flex-wrap: wrap; }
        .select-glass-wrapper { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r); padding: var(--sp-2) var(--sp-4); display: flex; align-items: center; height: var(--tap); }
        .select-glass-wrapper select { background: none; border: none; color: var(--text-primary); outline: none; cursor: pointer; font-size: 0.85rem; font-family: var(--f-body); font-weight: 300; }

        .action-cell-inner { display: flex; gap: 6px; }
        .icon-btn { background: none; border: 1px solid var(--border-default); color: var(--text-muted); padding: 6px; border-radius: var(--r); cursor: pointer; display: inline-flex; transition: all var(--t-fast, .18s) var(--ease, ease); }
        .icon-btn:hover { border-color: var(--y-base); color: var(--y-base); }
        .icon-btn.danger:hover { border-color: var(--error); color: var(--error); }

        .testimonial-cell { display: flex; align-items: center; gap: var(--sp-3); }
        .testimonial-cell__avatar {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
          background: var(--bg-section); border: 1px solid var(--border-default);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--f-display); font-size: 0.9rem; color: var(--y-base);
        }
        .testimonial-cell__avatar img { width: 100%; height: 100%; object-fit: cover; }
        .testimonial-quote-cell { color: var(--text-muted); font-size: 0.85rem; }
        .text-muted { color: var(--text-muted); font-size: 0.78rem; }

        .testimonial-form { display: flex; flex-direction: column; gap: var(--sp-5); }
        .testimonial-form textarea { resize: vertical; min-height: 90px; }
        .drawer-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; flex-wrap: wrap; margin-top: var(--sp-2); }
        .btn--danger-outline { color: var(--error); border-color: var(--error); }

        .testimonial-photo-field { display: flex; flex-direction: column; gap: var(--sp-2); }
        .form-field__label { font-size: 0.8rem; font-weight: 400; color: var(--text-secondary); }
        .hint-text { font-weight: 300; color: var(--text-muted); }
        .testimonial-photo-row { display: flex; align-items: center; gap: var(--sp-4); }
        .testimonial-photo-preview {
          width: 64px; height: 64px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: var(--bg-section); border: 1px solid var(--border-default);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--f-display); font-size: 1.3rem; color: var(--y-base);
        }
        .testimonial-photo-preview img { width: 100%; height: 100%; object-fit: cover; }
        .testimonial-photo-actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
        .testimonial-photo-upload { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }

        .reorder-hint { font-size: 0.82rem; color: var(--text-muted); margin: 0 0 var(--sp-4); }
        .reorder-list { display: flex; flex-direction: column; gap: var(--sp-2); max-height: 50vh; overflow-y: auto; margin-bottom: var(--sp-5); }
        .reorder-item {
          display: flex; align-items: center; gap: var(--sp-3); padding: 10px var(--sp-3);
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
        }
        .reorder-drag { color: var(--text-muted); cursor: grab; display: inline-flex; flex-shrink: 0; }
        .reorder-item__avatar { width: 32px; height: 32px; font-size: 0.8rem; }
        .reorder-item__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .reorder-item__text strong { font-size: 0.85rem; font-weight: 400; }
        .reorder-item__text span { font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (max-width: 768px) {
          .testimonials-page { padding: var(--sp-4); }
          .page-header__actions { width: 100%; }
        }

        @media (max-width: 480px) {
          .testimonials-filter-row { flex-direction: column; align-items: stretch; }
          .select-glass-wrapper { height: auto; }
          .testimonial-photo-row { flex-wrap: wrap; }
        }
      `}} />
    </div>
  );
}
