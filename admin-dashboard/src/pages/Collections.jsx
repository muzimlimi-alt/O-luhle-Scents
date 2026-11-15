import { useState, useEffect, useCallback } from 'react';
import { collectionsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { Layers, Plus, Edit2, Archive } from 'lucide-react';

// Collections are the merchandising groupings (Premium, Signature, Flame &
// Bloom, Gourmet Petite…) that cut across — or sit inside — a Category.
// This page is the Category admin's sibling, same look-and-feel so admins
// don't need to learn a second mental model to manage either.

const EMPTY_FORM = { name: '', description: '', displayOrder: '0', isActive: true };

export function Collections() {
  const { showMessage } = useMessaging();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('collections', 'write');
  const canDelete = hasPermission('collections', 'delete');
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await collectionsApi.list();
      setCollections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch collections:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (collection) => {
    setEditing(collection);
    setForm({
      name: collection.name,
      description: collection.description || '',
      displayOrder: String(collection.displayOrder ?? 0),
      isActive: collection.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        displayOrder: parseInt(form.displayOrder) || 0,
        isActive: form.isActive,
      };
      if (editing) {
        await collectionsApi.update(editing.id, payload);
      } else {
        await collectionsApi.create(payload);
      }
      setShowModal(false);
      fetchCollections();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (collection) => {
    if (!window.confirm(`Archive "${collection.name}"? This only works if it has no linked products.`)) return;
    try {
      await collectionsApi.delete(collection.id);
      fetchCollections();
    } catch (err) {
      showMessage('error', 'Archive Failed', err.message);
    }
  };

  const handleImageUpload = async (file) => {
    if (!editing) return;
    try {
      const updated = await collectionsApi.uploadImage(editing.id, file);
      setEditing(updated);
      fetchCollections();
    } catch (err) {
      showMessage('error', 'Image Upload Failed', err.message);
    }
  };

  const handleImageRemove = async () => {
    if (!editing) return;
    try {
      const updated = await collectionsApi.removeImage(editing.id);
      setEditing(updated);
      fetchCollections();
    } catch (err) {
      showMessage('error', 'Image Remove Failed', err.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Collection', render: (val) => <span style={{ fontWeight: 600 }}>{val}</span> },
    { key: 'slug', label: 'Slug', render: (val) => <code style={{ fontSize: '0.75rem' }}>{val}</code> },
    { key: '_count', label: 'Products', render: (val) => val?.products ?? 0 },
    { key: 'displayOrder', label: 'Order' },
    { key: 'isActive', label: 'Status', render: (val) => (
      <StatusBadge tone={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Archived'} />
    )},
  ];

  return (
    <div className="collections-page">
      <PageHeader
        icon={<Layers size={22} />}
        title="Collections"
        subtitle="Merchandising groupings — Premium, Signature, Flame & Bloom. Sit alongside Categories; one product can belong to many."
        actions={canWrite ? (
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={16} /> New Collection
          </button>
        ) : null}
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={collections}
          loading={loading}
          actions={(row) => (
            <>
              {canWrite && <button className="icon-btn" title="Edit" onClick={() => openEdit(row)}><Edit2 size={16} /></button>}
              {canDelete && <button className="icon-btn" title="Archive" onClick={() => handleArchive(row)}><Archive size={16} /></button>}
            </>
          )}
        />
      </div>

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Collection' : 'New Collection'} width={480}>
        <form onSubmit={handleSubmit} className="col-form">
          <FormField label="Name" required>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="e.g. Flame & Bloom"
            />
          </FormField>
          <FormField label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="A short editorial line shown on the storefront landing page."
            />
          </FormField>
          <FormField label="Display Order">
            <input
              type="number"
              value={form.displayOrder}
              onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))}
            />
          </FormField>
          {editing && (
            <FormField label="Hero image">
              {editing.image ? (
                <div className="col-hero-preview">
                  <img src={`/images/collections/${editing.image}`} alt="" />
                  {canWrite && (
                    <button type="button" className="btn btn--sm" onClick={handleImageRemove}>
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <p className="col-hero-hint">
                  No hero image yet. Upload one and it shows on <code>/shop.html?collection={editing.slug}</code>.
                </p>
              )}
              {canWrite && (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                    e.target.value = '';
                  }}
                />
              )}
            </FormField>
          )}
          <FormField label="Active">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              />
              <span>Visible on the storefront</span>
            </label>
          </FormField>
          <div className="col-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Collection'}
            </button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .col-form { display: flex; flex-direction: column; }
        .col-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }
        .col-hero-preview { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .col-hero-preview img {
          width: 160px; height: 90px; object-fit: cover;
          border-radius: var(--r); border: 1px solid var(--color-border, #e5e5e5);
        }
        .col-hero-hint { font-size: 0.78rem; color: var(--color-text-muted); margin: 0 0 8px; }
        .col-hero-hint code {
          background: var(--bg-section, #f6f6f6); padding: 1px 6px; border-radius: 4px; font-size: 0.72rem;
        }

        @media (max-width: 480px) {
          .col-actions { flex-wrap: wrap; }
          .col-actions button { flex: 1; }
        }
      `}} />
    </div>
  );
}
