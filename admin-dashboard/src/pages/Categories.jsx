import { useState, useEffect, useCallback } from 'react';
import { categoriesApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { FolderTree, Plus, Edit2, Archive, CornerDownRight } from 'lucide-react';

const EMPTY_FORM = { name: '', description: '', parentId: '', displayOrder: '0' };

export function Categories() {
  const { showMessage } = useMessaging();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('categories', 'write');
  const canDelete = hasPermission('categories', 'delete');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.list();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch categories:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Top-level categories first, each immediately followed by its children —
  // gives the table a tree-like reading order without a tree widget.
  const orderedRows = (() => {
    const byParent = {};
    categories.forEach(c => {
      const key = c.parentId || 'root';
      (byParent[key] = byParent[key] || []).push(c);
    });
    const rows = [];
    const walk = (parentKey, depth) => {
      (byParent[parentKey] || []).forEach(c => {
        rows.push({ ...c, depth });
        walk(c.id, depth + 1);
      });
    };
    walk('root', 0);
    return rows;
  })();

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      displayOrder: String(category.displayOrder ?? 0)
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, parentId: form.parentId || null };
      if (editing) {
        await categoriesApi.update(editing.id, payload);
      } else {
        await categoriesApi.create(payload);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!editing) return;
    try {
      const updated = await categoriesApi.uploadImage(editing.id, file);
      setEditing(updated);
      fetchCategories();
    } catch (err) {
      showMessage('error', 'Image Upload Failed', err.message);
    }
  };

  const handleImageRemove = async () => {
    if (!editing) return;
    try {
      const updated = await categoriesApi.removeImage(editing.id);
      setEditing(updated);
      fetchCategories();
    } catch (err) {
      showMessage('error', 'Image Remove Failed', err.message);
    }
  };

  const handleArchive = async (category) => {
    if (!window.confirm(`Remove "${category.name}"? This only works if it has no products or subcategories.`)) return;
    try {
      await categoriesApi.delete(category.id);
      fetchCategories();
    } catch (err) {
      showMessage('error', 'Archive Failed', err.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Category', render: (val, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: row.depth * 20 }}>
        {row.depth > 0 && <CornerDownRight size={13} color="var(--color-text-muted)" />}
        <span style={{ fontWeight: row.depth === 0 ? 700 : 500 }}>{val}</span>
      </div>
    )},
    { key: 'slug', label: 'Slug', render: (val) => <code style={{ fontSize: '0.75rem' }}>{val}</code> },
    { key: '_count', label: 'Products', render: (val) => val?.products ?? 0 },
    { key: 'isActive', label: 'Status', render: (val) => (
      <StatusBadge tone={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Archived'} />
    )},
  ];

  const availableParents = categories.filter(c => c.id !== editing?.id);

  return (
    <div className="categories-page">
      <PageHeader
        icon={<FolderTree size={22} />}
        title="Categories"
        subtitle="Organize the catalog into a browsable hierarchy."
        actions={canWrite ? (
          <button className="btn btn--primary" onClick={openCreate}>
            <Plus size={16} /> New Category
          </button>
        ) : null}
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={orderedRows}
          loading={loading}
          actions={(row) => (
            <>
              {canWrite && <button className="icon-btn" title="Edit" onClick={() => openEdit(row)}><Edit2 size={16} /></button>}
              {canDelete && <button className="icon-btn" title="Archive" onClick={() => handleArchive(row)}><Archive size={16} /></button>}
            </>
          )}
        />
      </div>

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'New Category'} width={480}>
        <form onSubmit={handleSubmit} className="cat-form">
          <FormField label="Name" required>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Candles" />
          </FormField>
          <FormField label="Parent Category">
            <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
              <option value="">None — top level</option>
              {availableParents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Description">
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Display Order">
            <input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
          </FormField>
          {editing && (
            <FormField label="Banner image" hint="Shown behind the title on this category's shop page. A wide landscape photo works best.">
              {editing.image ? (
                <div className="cat-banner-preview">
                  <img src={`/images/categories/${editing.image}`} alt="" />
                  {canWrite && (
                    <button type="button" className="btn btn--sm" onClick={handleImageRemove}>Remove</button>
                  )}
                </div>
              ) : (
                <p className="cat-banner-hint">No banner image yet. The shop shows a plain dark banner for <code>{editing.name}</code>.</p>
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
          <div className="cat-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .cat-form { display: flex; flex-direction: column; }
        .cat-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }
        .cat-banner-preview { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
        .cat-banner-preview img { width: 100%; max-height: 140px; object-fit: cover; border-radius: 4px; border: 1px solid var(--color-border); }
        .cat-banner-hint { font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 8px; }

        @media (max-width: 480px) {
          .cat-actions { flex-wrap: wrap; }
          .cat-actions button { flex: 1; }
        }
      `}} />
    </div>
  );
}
