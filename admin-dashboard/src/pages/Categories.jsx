import React, { useState, useEffect, useCallback } from 'react';
import { categoriesApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { FolderTree, Plus, X, Edit2, Archive, CornerDownRight } from 'lucide-react';

const EMPTY_FORM = { name: '', description: '', parentId: '', displayOrder: '0' };

export function Categories() {
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
      alert('Failed to save category: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (category) => {
    if (!window.confirm(`Remove "${category.name}"? This only works if it has no products or subcategories.`)) return;
    try {
      await categoriesApi.delete(category.id);
      fetchCategories();
    } catch (err) {
      alert(err.message);
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
      <span className={`status-badge ${val ? 'active' : 'archived'}`}>{val ? 'Active' : 'Archived'}</span>
    )},
  ];

  const availableParents = categories.filter(c => c.id !== editing?.id);

  return (
    <div className="categories-page">
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title"><FolderTree size={20} style={{ verticalAlign: 'text-bottom', marginRight: 8 }} />Categories</h2>
        <button className="btn btn--primary" onClick={openCreate}>
          <Plus size={16} /> New Category
        </button>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={orderedRows}
          loading={loading}
          actions={(row) => (
            <>
              <button className="icon-btn" title="Edit" onClick={() => openEdit(row)}><Edit2 size={16} /></button>
              <button className="icon-btn" title="Archive" onClick={() => handleArchive(row)}><Archive size={16} /></button>
            </>
          )}
        />
      </div>

      {showModal && (
        <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="elite-modal">
            <div className="modal-top">
              <h2>{editing ? 'Edit Category' : 'New Category'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={22} /></button>
            </div>
            <form onSubmit={handleSubmit} className="cat-form">
              <div className="cat-field">
                <label>Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Candles" />
              </div>
              <div className="cat-field">
                <label>Parent Category</label>
                <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                  <option value="">None — top level</option>
                  {availableParents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="cat-field">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="cat-field">
                <label>Display Order</label>
                <input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))} />
              </div>
              <div className="cat-actions">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-overlay { position: fixed; inset: 0; background: rgba(8,7,6,0.85); backdrop-filter: blur(16px); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .elite-modal { width: 100%; max-width: 480px; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 6px; padding: 28px; }
        .modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .close-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; }
        .cat-form { display: flex; flex-direction: column; gap: 16px; }
        .cat-field { display: flex; flex-direction: column; gap: 6px; }
        .cat-field label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
        .cat-field input, .cat-field select, .cat-field textarea {
          background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 10px 12px; color: var(--color-text); font-size: 0.85rem; font-family: inherit;
        }
        .cat-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
      `}} />
    </div>
  );
}
