import { useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { productsApi, categoriesApi, testimonialsApi } from '../services/api';
import {
  Plus, Search, Edit2, Trash2, Package,
  ImageIcon, Tag, Truck,
  Layers, Eye, EyeOff,
  AlertCircle, Fingerprint, ArrowUpDown, Star
} from 'lucide-react';
import ProductModal from '../components/ProductModal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const STATUS_TONE = { ACTIVE: 'success', DRAFT: 'warning', ARCHIVED: 'neutral' };

const VIEW_KEY = 'toca_products_view';

function loadView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'table' || saved === 'grid' ? saved : 'grid';
  } catch {
    return 'grid';
  }
}

// Aggregates a product's variants into the single stock figure/status the
// table row needs — a product itself has no status beyond ACTIVE/DRAFT/
// ARCHIVED, so "low stock"/"sold out" are derived from its real variants,
// not a separate fabricated field.
function stockSummary(product) {
  const variants = product.variants || [];
  const totalStock = variants.reduce((s, v) => s + (v.inventory?.quantity || 0), 0);
  const anyLow = variants.some((v) => (v.inventory?.quantity ?? 0) <= (v.inventory?.lowStockThreshold ?? 5));
  return { totalStock, anyLow };
}

function priceRange(product) {
  const prices = (product.variants || []).map((v) => Number(v.price)).filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
}

export function Products() {
  const { showMessage } = useMessaging();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('products', 'write');
  const canDelete = hasPermission('products', 'delete');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [view, setView] = useState(loadView);
  const [draftCount, setDraftCount] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);

  // Pagination & Filtering State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* noop */ }
  }, [view]);

  // Top-level categories first, each followed by its children — mirrors the
  // hierarchy set up in Admin -> Categories without needing a tree widget here.
  const orderedCategories = (() => {
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
  const topLevelCategories = orderedCategories.filter((c) => c.depth === 0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await productsApi.list({
        page,
        limit: 8,
        sort: sortBy,
        category: selectedCategory,
        status: selectedStatus,
        search: searchTerm
      });

      setProducts(response.products || []);
      setTotalPages(response.totalPages || 1);
      setTotalProducts(response.total || 0);
    } catch (err) {
      console.error('Failed to sync inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, selectedCategory, selectedStatus, searchTerm]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to resolve category list:', err);
    }
  }, []);

  // Debounce search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reset to first page on new search
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchProducts]);

  // Handle other filter changes
  useEffect(() => {
    fetchProducts();
  }, [page, sortBy, selectedCategory, selectedStatus, fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Page-head "drafts awaiting copy" stat and the Reviews-pending card both
  // need one lightweight fetch each, independent of the catalogue filters.
  useEffect(() => {
    let isMounted = true;
    productsApi.list({ page: 1, limit: 1, status: 'draft' })
      .then((r) => { if (isMounted) setDraftCount(r.total || 0); })
      .catch(() => { if (isMounted) setDraftCount(null); });
    testimonialsApi.list('pending')
      .then((r) => { if (isMounted) setPendingReviews((Array.isArray(r) ? r : []).slice(0, 5)); })
      .catch(() => { if (isMounted) setPendingReviews([]); });
    return () => { isMounted = false; };
  }, []);

  const handleCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSave = async (formData, id) => {
    try {
      if (id) {
        await productsApi.update(id, formData);
        showMessage('success', 'Product Updated', 'Changes have been saved.');
      } else {
        await productsApi.create(formData);
        showMessage('success', 'Product Created', 'The new product is now in your catalog.');
      }
      await fetchProducts();
    } catch (err) {
      console.error('Failed to preserve product state:', err);
      showMessage('error', 'Save Failed', err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productsApi.delete(id);
        showMessage('success', 'Product Deleted', 'The product has been removed from your catalog.');
        fetchProducts();
      } catch (err) {
        showMessage('error', 'Delete Failed', err.message);
      }
    }
  };

  const toggleNameSort = () => {
    setSortBy((s) => (s === 'name-asc' ? 'name-desc' : 'name-asc'));
    setPage(1);
  };

  const statusChips = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
  ];

  return (
    <div className="products-page">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Commerce</li><li aria-current="page">Products</li></ol>
          <h1>Products</h1>
          <p className="sub">
            {totalProducts} product{totalProducts === 1 ? '' : 's'} across {topLevelCategories.length} categor{topLevelCategories.length === 1 ? 'y' : 'ies'}
            {draftCount > 0 && <> · {draftCount} draft{draftCount === 1 ? '' : 's'} awaiting copy</>}
          </p>
        </div>
        <div className="head-actions">
          {canWrite && (
            <button type="button" className="btn-primary btn-sm" onClick={handleCreate}>
              <Plus size={14} /> New product
            </button>
          )}
        </div>
      </div>

      <section className="card mb-6">
        <div className="card-head">
          <h3>Catalogue</h3>
          <div className="seg" role="group" aria-label="Catalogue view">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
          </div>
        </div>

        <div className="toolbar">
          <span className="field-inline">
            <Search size={13} aria-hidden="true" />
            <label className="vh" htmlFor="pSearch">Search catalogue</label>
            <input
              className="input"
              id="pSearch"
              type="search"
              placeholder="Search by name, brand, or SKU…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </span>

          <label className="vh" htmlFor="pCat">Category</label>
          <select
            className="select"
            id="pCat"
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
          >
            <option value="all">All categories</option>
            {orderedCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{'—'.repeat(cat.depth)} {cat.name}</option>
            ))}
          </select>

          <label className="vh" htmlFor="pSort">Sort by</label>
          <select
            className="select"
            id="pSort"
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>

          <div className="chips" role="group" aria-label="Status filter">
            {statusChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className="chip"
                aria-pressed={selectedStatus === chip.value}
                onClick={() => { setSelectedStatus(chip.value); setPage(1); }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <span className="push mono">{totalProducts} result{totalProducts === 1 ? '' : 's'}</span>
        </div>

        <div className="card-body flush">
          {loading && products.length === 0 ? (
            <LoadingState label="Loading products..." />
          ) : products.length === 0 ? (
            <EmptyState icon={<Package size={40} />} title="No products found" description="Adjust your search or filters, or create your first product." />
          ) : view === 'table' ? (
            <div className="t-scroll">
              <table className="tbl">
                <caption className="vh">Product catalogue. Select a product name to edit it.</caption>
                <thead>
                  <tr>
                    <th scope="col"><button type="button" onClick={toggleNameSort}>Product <ArrowUpDown size={11} aria-hidden="true" /></button></th>
                    <th scope="col">SKU</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">Price</th>
                    <th scope="col" className="num">Stock</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="vh">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-50' : ''}>
                  {products.map((product) => {
                    const { totalStock, anyLow } = stockSummary(product);
                    const range = priceRange(product);
                    const primarySku = product.variants?.[0]?.sku || '—';
                    const extraVariants = (product.variants?.length || 0) - 1;
                    return (
                      <tr key={product.id}>
                        <th scope="row" className="tbl-rowhead">
                          <button type="button" className="row-link" onClick={() => handleEdit(product)}>
                            {product.primaryImage ? (
                              <img className="mono-thumb mono-thumb--img" src={`${API_ORIGIN}/images/products/${product.primaryImage}`} alt="" aria-hidden="true" />
                            ) : (
                              <span className="mono-thumb" aria-hidden="true">{product.name?.charAt(0) || '?'}</span>
                            )}
                            <span className="cell-stack">
                              {product.name}
                              <span className="sub">{product.variants?.[0]?.size || product.category?.name || ''}</span>
                            </span>
                          </button>
                        </th>
                        <td className="mono">{primarySku}{extraVariants > 0 && <span className="sku-extra"> +{extraVariants}</span>}</td>
                        <td>{product.category?.name || 'Uncategorized'}</td>
                        <td className="num strong">
                          {range == null ? '—' : range.min === range.max ? `R ${range.min.toLocaleString()}` : `From R ${range.min.toLocaleString()}`}
                        </td>
                        <td className="num">{totalStock}</td>
                        <td>
                          {product.status !== 'ACTIVE' ? (
                            <span className="pill mute">{product.status === 'DRAFT' ? 'Draft' : 'Archived'}</span>
                          ) : totalStock === 0 ? (
                            <span className="pill bad">Sold out</span>
                          ) : anyLow ? (
                            <span className="pill warn">Low stock</span>
                          ) : (
                            <span className="pill ok">Active</span>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {canWrite && <button type="button" className="icon-mini" aria-label={`Edit ${product.name}`} onClick={() => handleEdit(product)}><Edit2 size={13} /></button>}
                            {canDelete && <button type="button" className="icon-mini" aria-label={`Delete ${product.name}`} onClick={() => handleDelete(product.id)}><Trash2 size={13} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`atelier-grid ${loading ? 'opacity-50' : ''}`}>
              {products.map(product => (
                <div key={product.id} className="card atelier-card">
                  {/* CARD HEADER: STATUS & BRAND */}
                  <div className="card-top">
                    <StatusBadge
                      tone={STATUS_TONE[product.status] || 'neutral'}
                      icon={product.status === 'ACTIVE' ? <Eye size={12} /> : <EyeOff size={12} />}
                      label={product.status === 'ACTIVE' ? 'Live' : product.status === 'DRAFT' ? 'Draft' : 'Archived'}
                    />
                    <div className="card-actions">
                      {canWrite && <button onClick={() => handleEdit(product)} className="icon-btn" title="Edit"><Edit2 size={14} /></button>}
                      {canDelete && <button onClick={() => handleDelete(product.id)} className="icon-btn danger" title="Delete"><Trash2 size={14} /></button>}
                    </div>
                  </div>

                  <div className="card-content-layout">
                    {/* LEFT: THUMBNAIL */}
                    <div className="card-visual-sidebar">
                      <div className="image-atelier-frame">
                        {product.primaryImage ? (
                          <img src={`${API_ORIGIN}/images/products/${product.primaryImage}`} alt={product.name} />
                        ) : (
                          <div className="image-placeholder">
                            <ImageIcon size={32} opacity={0.3} />
                          </div>
                        )}
                      </div>

                      <div className="sidebar-meta">
                        <div className="meta-item">
                          <Tag size={12} />
                          <span className="label">Category:</span>
                          <span className="value">{product.category?.name || 'Uncategorized'}</span>
                        </div>
                        <div className="meta-item">
                          <Truck size={12} />
                          <span className="label">Supplier:</span>
                          <span className="value">{product.supplier?.name || 'In-House'}</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: DETAILS & VARIANTS */}
                    <div className="card-main-body">
                      <div className="product-identity">
                        <span className="brand-eyebrow">{product.brand || "TOCA"}</span>
                        <h3 className="product-name">{product.name}</h3>
                        {product.tags?.length > 0 && (
                          <div className="tag-cloud">
                            {product.tags.map((tag, idx) => (
                              <span key={idx} className="atelier-tag">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="variant-matrix-container">
                        <div className="matrix-header">
                          <Layers size={14} />
                          <span>Variants</span>
                        </div>
                        <div className="matrix-scroll">
                          <table className="matrix-table">
                            <thead>
                              <tr>
                                <th>Size</th>
                                <th>Retail</th>
                                <th>Cost</th>
                                <th>Stock</th>
                                <th>SKU/Barcode</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.variants?.map(v => (
                                <tr key={v.id}>
                                  <td>{v.size}</td>
                                  <td className="price-primary">R{v.price}</td>
                                  <td className="price-cost">R{v.costPrice || '--'}</td>
                                  <td>
                                    <div className="stock-level-indicator">
                                      <span className={`stock-count ${v.inventory?.quantity <= (v.inventory?.lowStockThreshold || 5) ? 'low' : ''}`}>
                                        {v.inventory?.quantity || 0}
                                      </span>
                                      {v.inventory?.quantity <= (v.inventory?.lowStockThreshold || 5) && (
                                        <AlertCircle size={12} className="low-stock-icon" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="sku-cell">
                                    <span className="sku-text" title={`Barcode: ${v.barcode || 'N/A'}`}>{v.sku}</span>
                                    {v.barcode && <Fingerprint size={10} className="barcode-icon" />}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {products.length > 0 && (
          <div className="table-footer products-pagination">
            <div className="pagination-info">
              Showing {products.length} of {totalProducts} products
            </div>
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page === 1 || loading}
                onClick={() => setPage(p => p - 1)}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button
                className="page-btn"
                disabled={page === totalPages || loading}
                onClick={() => setPage(p => p + 1)}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {topLevelCategories.length > 0 && (
        <>
          <div className="section-title"><h2>Collections</h2></div>
          <div className="grid kpi-row mb-6">
            {topLevelCategories.map((cat) => (
              <article className="kpi" key={cat.id}>
                <div className="kpi-top"><h3 className="kpi-label">{cat.name}</h3><span className="ic" aria-hidden="true"><Package size={16} /></span></div>
                <p className="kpi-val" style={{ fontSize: '1.7rem' }}>{cat._count?.products ?? 0} <small>products</small></p>
                {cat.description && <p className="kpi-foot">{cat.description}</p>}
              </article>
            ))}
          </div>
        </>
      )}

      <section className="card" aria-labelledby="h-rev2">
        <div className="card-head">
          <div><h3 id="h-rev2">Reviews <em>pending</em></h3><p className="hint">Awaiting moderation</p></div>
          {pendingReviews.length > 0 && <span className="pill warn">{pendingReviews.length} new</span>}
        </div>
        <div className="card-body flush">
          <ul className="feed">
            {pendingReviews.map((t) => (
              <li key={t.id}>
                <span className="fi" aria-hidden="true"><Star size={14} /></span>
                <span className="ft"><b>{t.name}</b> — "{t.quote}"</span>
                <time dateTime={t.createdAt}>{DateTime.fromISO(t.createdAt).toRelative()}</time>
              </li>
            ))}
            {pendingReviews.length === 0 && <EmptyState title="Nothing to moderate" description="New testimonials awaiting approval will appear here." />}
          </ul>
        </div>
      </section>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={editingProduct}
        categories={categories}
        onSave={handleSave}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .products-page { padding: 40px; max-width: 1600px; margin: 0 auto; min-height: 100vh; }

        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .products-page .card { border-color: var(--border-low); }
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

        .btn-primary, .btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
          min-height: var(--tap); padding: 0 var(--sp-5);
          border-radius: var(--r); font-size: .86rem; font-weight: 400;
          letter-spacing: .06em; text-transform: uppercase;
          border: 1px solid transparent; cursor: pointer;
          transition: all var(--t-fast) var(--ease); white-space: nowrap;
        }
        .btn-primary { background: var(--y-base); color: var(--text-inverse); font-weight: 500; }
        .btn-primary:hover { background: var(--y-hover); box-shadow: 0 6px 22px rgba(var(--y-rgb), .3); }
        .btn-outline { border-color: var(--border-strong); color: var(--text-primary); background: none; }
        .btn-outline:hover { border-color: var(--y-base); background: var(--y-base); color: var(--text-inverse); }
        .btn-sm { min-height: 36px; padding: 0 var(--sp-4); font-size: .74rem; }
        .btn-primary:focus-visible, .btn-outline:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

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
        .input, .select {
          height: var(--tap); padding: 0 var(--sp-4);
          background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-primary); font-family: var(--f-body); font-weight: 300; font-size: .86rem;
        }
        .field-inline .input { width: 100%; padding-left: 36px; }
        .input::placeholder { color: var(--text-muted); }
        .input:hover, .select:hover { border-color: var(--border-strong); }
        .input:focus-visible, .select:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }
        .select {
          appearance: none; padding-right: 36px;
          background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
          background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%;
          background-size: 5px 5px; background-repeat: no-repeat;
        }

        .chips { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 var(--sp-4); border: 1px solid var(--border-default); border-radius: var(--r-pill); font-size: .76rem; color: var(--text-secondary); background: none; cursor: pointer; transition: all var(--t-fast) var(--ease); }
        .chip:hover { border-color: var(--y-dark); color: var(--text-primary); }
        .chip[aria-pressed="true"] { background: rgba(var(--y-rgb), .14); border-color: var(--y-base); color: var(--y-base); }
        .push { margin-left: auto; }
        .mono { font-family: var(--f-mono); font-size: .76rem; color: var(--text-muted); }

        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th { text-align: left; font-weight: 400; font-size: .66rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-default); white-space: nowrap; background: var(--bg-section); }
        .tbl th.num, .tbl td.num { text-align: right; }
        .tbl th button { display: inline-flex; align-items: center; gap: 6px; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; background: none; border: none; cursor: pointer; padding: 0; }
        .tbl th button:hover { color: var(--y-base); }
        .tbl td, .tbl th.tbl-rowhead { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border-low); color: var(--text-secondary); vertical-align: middle; font-weight: 400; text-align: left; }
        .tbl tbody tr:hover { background: rgba(255, 255, 255, .028); }
        .tbl tbody tr:last-child td, .tbl tbody tr:last-child th { border-bottom: 0; }
        .tbl .strong { color: var(--text-primary); }
        .tbl .num, .tbl .mono { font-family: var(--f-mono); font-variant-numeric: tabular-nums; font-size: .83rem; }
        .sku-extra { color: var(--text-muted); }

        .row-link { display: inline-flex; align-items: center; gap: var(--sp-3); background: none; border: none; cursor: pointer; text-align: left; color: inherit; padding: 0; }
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
        .mono-thumb--img { object-fit: cover; border-radius: var(--r); }

        .icon-mini { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--border-low); border-radius: var(--r); color: var(--text-muted); background: none; cursor: pointer; }
        .icon-mini:hover { border-color: var(--y-base); color: var(--y-base); }
        .row-actions { display: flex; gap: 6px; justify-content: flex-end; }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.ok { color: var(--success); border-color: rgba(var(--ok-rgb), .4); background: rgba(var(--ok-rgb), .09); }
        .pill.warn { color: var(--warning); border-color: rgba(var(--warn-rgb), .4); background: rgba(var(--warn-rgb), .09); }
        .pill.bad { color: var(--error); border-color: rgba(var(--bad-rgb), .4); background: rgba(var(--bad-rgb), .09); }
        .pill.mute { color: var(--text-muted); border-color: var(--border-default); }

        .section-title { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-4); margin: var(--sp-7) 0 var(--sp-4); flex-wrap: wrap; }
        .section-title h2 { font-size: 1.5rem; }

        .grid { display: grid; gap: var(--sp-5); }
        .kpi-row { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

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
        .kpi-val small { font-size: .75em; color: var(--text-muted); font-family: var(--f-body); }
        .kpi-foot { font-size: .78rem; color: var(--text-muted); margin: 0; }

        .feed { list-style: none; margin: 0; padding: 0; }
        .feed li { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-low); }
        .feed li:last-child { border-bottom: 0; }
        .feed .fi { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border: 1px solid var(--border-low); border-radius: var(--r); color: var(--y-base); }
        .feed .ft { flex: 1; min-width: 0; font-size: .86rem; color: var(--text-secondary); line-height: 1.45; }
        .feed .ft b { color: var(--text-primary); font-weight: 400; }
        .feed time { font-family: var(--f-mono); font-size: .7rem; color: var(--text-muted); white-space: nowrap; }

        /* GALLERY GRID (existing card view, unchanged) */
        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(600px, 1fr)); gap: 24px; padding: var(--sp-5); }
        .atelier-card-wrapper, .atelier-card { min-width: 0; }
        @media (max-width: 1400px) { .atelier-grid { grid-template-columns: 1fr; } }

        .card-top {
          padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid var(--border-low);
        }
        .card-actions { display: flex; gap: 8px; }

        .card-content-layout { display: flex; padding: 20px; gap: 20px; }

        .card-visual-sidebar { width: 180px; flex-shrink: 0; }
        .image-atelier-frame {
          width: 100%; height: 200px; border-radius: var(--r); overflow: hidden;
          background: var(--bg-section); border: 1px solid var(--border-default);
          margin-bottom: 16px;
        }
        .image-atelier-frame img { width: 100%; height: 100%; object-fit: cover; }
        .image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); }

        .sidebar-meta { display: flex; flex-direction: column; gap: 8px; }
        .meta-item { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--text-muted); }
        .meta-item .label { opacity: 0.7; }
        .meta-item .value { color: var(--y-base); font-weight: 500; }

        .card-main-body { flex: 1; min-width: 0; }
        .brand-eyebrow {
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em;
          color: var(--y-base); text-transform: uppercase; margin-bottom: 6px; display: block;
        }
        .product-name { font-family: var(--f-display); font-size: 1.6rem; font-weight: 500; margin: 0 0 12px 0; color: var(--text-primary); }

        .tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .atelier-tag {
          font-size: 0.65rem; padding: 4px 10px; border-radius: var(--r);
          background: var(--bg-section); border: 1px solid var(--border-default);
          color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* VARIANT TABLE */
        .variant-matrix-container { background: var(--bg-page); border-radius: var(--r); border: 1px solid var(--border-default); overflow: hidden; }
        .matrix-header {
          padding: 10px 16px; border-bottom: 1px solid var(--border-default);
          display: flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 700;
          color: var(--y-base); letter-spacing: 0.1em; text-transform: uppercase;
        }
        .matrix-scroll { overflow-x: auto; }
        .matrix-table { width: 100%; border-collapse: collapse; }
        .matrix-table th {
          text-align: left; padding: 10px 16px; font-size: 0.65rem; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .matrix-table td { padding: 10px 16px; font-size: 0.8rem; border-bottom: 1px solid var(--border-low); }
        .matrix-table tr:last-child td { border-bottom: none; }

        .price-primary { color: var(--text-primary); font-weight: 600; }
        .price-cost { color: var(--text-muted); font-size: 0.75rem; }

        .stock-level-indicator { display: flex; align-items: center; gap: 6px; }
        .stock-count { font-weight: 700; }
        .stock-count.low { color: var(--warning-text); }
        .low-stock-icon { color: var(--warning-text); }

        .sku-cell { display: flex; align-items: center; gap: 6px; }
        .sku-text { font-family: monospace; font-size: 0.7rem; color: var(--text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .barcode-icon { color: var(--y-base); opacity: 0.6; }

        .opacity-50 { opacity: 0.5; pointer-events: none; }

        /* PAGINATION */
        .table-footer.products-pagination { padding: var(--sp-5); border-top: 1px solid var(--border-low); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; }
        .pagination-info { font-size: 0.85rem; color: var(--text-muted); }
        .pagination { display: flex; align-items: center; gap: 16px; }
        .page-btn { background: none; border: 1px solid var(--border-default); color: var(--text-primary); padding: 8px 18px; border-radius: var(--r); font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: var(--transition); }
        .page-btn:not(:disabled):hover { border-color: var(--y-base); color: var(--y-base); background: var(--bg-elevated); }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }
        .page-info { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); }

        @media (max-width: 768px) {
          .products-page { padding: 20px; }
          .card-content-layout { flex-direction: column; align-items: center; }
          .card-visual-sidebar { width: 100%; max-width: 300px; }
          .card-main-body { width: 100%; min-width: 0; }
          .products-pagination { flex-direction: column; text-align: center; }
        }
      `}} />
    </div>
  );
}
