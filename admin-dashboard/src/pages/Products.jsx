import { useState, useEffect, useCallback } from 'react';
import { productsApi, categoriesApi } from '../services/api';
import {
  Plus, Search, Filter, Edit2, Trash2, Package,
  ImageIcon, Tag, Truck,
  BarChart3, Layers, Eye, EyeOff,
  AlertCircle, Fingerprint
} from 'lucide-react';
import ProductModal from '../components/ProductModal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const STATUS_TONE = { ACTIVE: 'success', DRAFT: 'warning', ARCHIVED: 'neutral' };

export function Products() {
  const { showMessage } = useMessaging();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Pagination & Filtering State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

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

  return (
    <div className="products-page">
      <PageHeader
        icon={<Package size={22} />}
        title="Products"
        subtitle="Curating the finest artisanal fragrances in the TOCA collection."
        actions={(
          <button onClick={handleCreate} className="btn btn--primary">
            <Plus size={18} /> Create Product
          </button>
        )}
      />

      {/* DISCOVERY BAR */}
      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input
            type="text"
            placeholder="Search by name, brand, or SKU..."
            className="search-glass-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-glass-matrix">
          <div className="select-glass-wrapper">
            <Filter size={14} className="glass-icon" />
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Live</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="select-glass-wrapper">
            <Package size={14} className="glass-icon" />
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            >
              <option value="all">All Categories</option>
              {orderedCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{'—'.repeat(cat.depth)} {cat.name}</option>
              ))}
            </select>
          </div>

          <div className="select-glass-wrapper">
            <BarChart3 size={14} className="glass-icon" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* PRODUCT GALLERY */}
      <div className="products-gallery">
        {loading && products.length === 0 ? (
          <LoadingState label="Loading products..." />
        ) : products.length === 0 ? (
          <EmptyState icon={<Package size={40} />} title="No products found" description="Adjust your search or filters, or create your first product." />
        ) : (
          <>
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
                      <button onClick={() => handleEdit(product)} className="icon-btn" title="Edit"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(product.id)} className="icon-btn danger" title="Delete"><Trash2 size={14} /></button>
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

            {/* Pagination Controls */}
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
          </>
        )}
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={editingProduct}
        categories={categories}
        onSave={handleSave}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .products-page { padding: 40px; max-width: 1600px; margin: 0 auto; min-height: 100vh; }

        /* DISCOVERY BAR */
        .atelier-discovery { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 32px; }
        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 10px 16px; display: flex; align-items: center; flex: 1; min-width: 280px; max-width: 420px; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }
        .filter-glass-matrix { display: flex; flex-wrap: wrap; gap: 12px; }
        .select-glass-wrapper { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px 16px; display: flex; align-items: center; gap: 10px; }
        .select-glass-wrapper select { background: none; border: none; color: var(--color-text); outline: none; cursor: pointer; font-size: 0.85rem; }

        /* GALLERY GRID */
        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(600px, 1fr)); gap: 24px; }
        .atelier-card-wrapper, .atelier-card { min-width: 0; }
        @media (max-width: 1400px) { .atelier-grid { grid-template-columns: 1fr; } }

        .card-top {
          padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid var(--color-border-light);
        }
        .card-actions { display: flex; gap: 8px; }

        .card-content-layout { display: flex; padding: 20px; gap: 20px; }

        .card-visual-sidebar { width: 180px; flex-shrink: 0; }
        .image-atelier-frame {
          width: 100%; height: 200px; border-radius: 4px; overflow: hidden;
          background: var(--color-surface); border: 1px solid var(--color-border);
          margin-bottom: 16px;
        }
        .image-atelier-frame img { width: 100%; height: 100%; object-fit: cover; }
        .image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); }

        .sidebar-meta { display: flex; flex-direction: column; gap: 8px; }
        .meta-item { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: var(--color-text-muted); }
        .meta-item .label { opacity: 0.7; }
        .meta-item .value { color: var(--color-primary-text); font-weight: 500; }

        .card-main-body { flex: 1; min-width: 0; }
        .brand-eyebrow {
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em;
          color: var(--color-primary-text); text-transform: uppercase; margin-bottom: 6px; display: block;
        }
        .product-name { font-family: var(--font-display); font-size: 1.6rem; font-weight: 500; margin: 0 0 12px 0; color: var(--color-text-header); }

        .tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .atelier-tag {
          font-size: 0.65rem; padding: 4px 10px; border-radius: 4px;
          background: var(--color-surface); border: 1px solid var(--color-border);
          color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* VARIANT TABLE */
        .variant-matrix-container { background: var(--color-bg-dark); border-radius: 4px; border: 1px solid var(--color-border); overflow: hidden; }
        .matrix-header {
          padding: 10px 16px; border-bottom: 1px solid var(--color-border);
          display: flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 700;
          color: var(--color-primary-text); letter-spacing: 0.1em; text-transform: uppercase;
        }
        .matrix-scroll { overflow-x: auto; }
        .matrix-table { width: 100%; border-collapse: collapse; }
        .matrix-table th {
          text-align: left; padding: 10px 16px; font-size: 0.65rem; color: var(--color-text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .matrix-table td { padding: 10px 16px; font-size: 0.8rem; border-bottom: 1px solid var(--color-border-light); }
        .matrix-table tr:last-child td { border-bottom: none; }

        .price-primary { color: var(--color-text-header); font-weight: 600; }
        .price-cost { color: var(--color-text-muted); font-size: 0.75rem; }

        .stock-level-indicator { display: flex; align-items: center; gap: 6px; }
        .stock-count { font-weight: 700; }
        .stock-count.low { color: var(--color-warning-text); }
        .low-stock-icon { color: var(--color-warning-text); }

        .sku-cell { display: flex; align-items: center; gap: 6px; }
        .sku-text { font-family: monospace; font-size: 0.7rem; color: var(--color-text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .barcode-icon { color: var(--color-primary); opacity: 0.6; }

        .opacity-50 { opacity: 0.5; pointer-events: none; }

        /* PAGINATION */
        .table-footer.products-pagination { margin-top: 32px; padding: 20px 4px; border-top: 1px solid var(--color-border); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; }
        .pagination-info { font-size: 0.85rem; color: var(--color-text-muted); }
        .pagination { display: flex; align-items: center; gap: 16px; }
        .page-btn { background: none; border: 1px solid var(--color-border); color: var(--color-text); padding: 8px 18px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: var(--transition); }
        .page-btn:not(:disabled):hover { border-color: var(--color-primary); color: var(--color-primary-text); background: var(--color-border-light); }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--color-border-focus); }
        .page-info { font-size: 0.8rem; font-weight: 600; color: var(--color-text-header); }

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
