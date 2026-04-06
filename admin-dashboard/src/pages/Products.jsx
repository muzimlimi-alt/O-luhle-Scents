import React, { useState, useEffect } from 'react';
import { productsApi, categoriesApi } from '../services/api';
import { 
  Plus, Search, Filter, Edit2, Trash2, Package, 
  Sparkles, ImageIcon, Loader2, Tag, Truck, 
  BarChart3, Layers, ShoppingBag, Eye, EyeOff,
  AlertCircle, DollarSign, Fingerprint
} from 'lucide-react';
import ProductModal from '../components/ProductModal';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

export function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchProducts = async () => {
    try {
      const response = await productsApi.list();
      const data = response.products || response;
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to sync inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to resolve category list:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
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
      } else {
        await productsApi.create(formData);
      }
      await fetchProducts();
    } catch (err) {
      console.error('Failed to preserve product state:', err);
      alert('Preservation failed: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to decommission this product?')) {
      try {
        await productsApi.delete(id);
        fetchProducts();
      } catch (err) {
        alert('Failed to delete product: ' + err.message);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.variants?.some(v => v.sku?.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="elite-products-container">
      {/* ATELIER EXPLORER HEADER */}
      <div className="atelier-header">
        <div className="header-badge">
          <Sparkles size={14} className="mr-1" />
          MASTER INVENTORY
        </div>
        <div className="header-main">
          <div className="header-titles">
            <h1 className="atelier-title">Scent Portfolio</h1>
            <p className="atelier-subtitle">Curating the finest artisanal fragrances in the O'luhle collection.</p>
          </div>
          <button onClick={handleCreate} className="btn-elite-primary">
            <Plus size={20} />
            <span>CREATE NEW FRAGRANCE</span>
          </button>
        </div>
      </div>

      {/* DISCOVERY BAR */}
      <div className="atelier-discovery">
        <div className="search-glass-container">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Explore by name, brand, or SKU..." 
            className="search-glass-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <button className="btn-glass">
            <Filter size={16} />
            <span>CATEGORIES</span>
          </button>
        </div>
      </div>

      {/* PRODUCT GALLERY */}
      <div className="products-atelier-gallery">
        {loading ? (
          <div className="atelier-loading">
            <Loader2 className="spinner" size={40} />
            <p>SYNCHRONIZING ATELIER DATA...</p>
          </div>
        ) : (
          <div className="atelier-grid">
            {filteredProducts.map(product => (
              <div key={product.id} className="atelier-card-wrapper animate-in">
                <div className="atelier-card elite-glass">
                  {/* CARD HEADER: STATUS & BRAND */}
                  <div className="card-top">
                    <div className="status-indicator">
                      {product.isActive !== false ? (
                        <span className="badge-status active">
                          <Eye size={12} /> LIVE ON BOUTIQUE
                        </span>
                      ) : (
                        <span className="badge-status archived">
                          <EyeOff size={12} /> ARCHIVED
                        </span>
                      )}
                    </div>
                    <div className="card-actions">
                      <button onClick={() => handleEdit(product)} className="btn-mini-action" title="Edit Portfolio"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(product.id)} className="btn-mini-action danger" title="Decommission"><Trash2 size={14} /></button>
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
                        <div className="image-overlay-glow"></div>
                      </div>
                      
                      <div className="sidebar-meta">
                        <div className="meta-item">
                          <Tag size={12} />
                          <span className="label">Category:</span>
                          <span className="value">{product.category?.name || 'Uncategorized'}</span>
                        </div>
                        <div className="meta-item">
                          <Truck size={12} />
                          <span className="label">Artisan:</span>
                          <span className="value">{product.supplier?.name || 'In-House'}</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: DETAILS & VARIANTS */}
                    <div className="card-main-body">
                      <div className="product-identity">
                        <span className="brand-eyebrow">{product.brand || "O'luhle Scents"}</span>
                        <h3 className="product-name">{product.name}</h3>
                        {product.tags && (
                          <div className="tag-cloud">
                            {product.tags.split(',').map((tag, idx) => (
                              <span key={idx} className="atelier-tag">{tag.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="variant-matrix-container">
                        <div className="matrix-header">
                          <Layers size={14} />
                          <span>VARIATION MATRIX</span>
                        </div>
                        <div className="matrix-scroll">
                          <table className="matrix-table">
                            <thead>
                              <tr>
                                <th>SIZE</th>
                                <th>RETAIL</th>
                                <th>COST</th>
                                <th>STOCK</th>
                                <th>SKU/BARCODE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.variants?.map(v => (
                                <tr key={v.id}>
                                  <td className="font-outfit">{v.size}</td>
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
              </div>
            ))}
          </div>
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
        :root {
          --atelier-bg: #0f0e0d;
          --atelier-card: rgba(22, 21, 19, 0.7);
          --atelier-gold: #b89b6a;
          --atelier-gold-low: rgba(184, 155, 106, 0.15);
          --atelier-border: rgba(184, 155, 106, 0.2);
          --atelier-text: #e2e1df;
          --atelier-text-muted: #9a9895;
          --atelier-success: #27ae60;
          --atelier-error: #c0392b;
          --atelier-font-header: 'Outfit', sans-serif;
          --atelier-font-body: 'Inter', sans-serif;
        }

        .elite-products-container {
          padding: 40px;
          min-height: 100vh;
          background: radial-gradient(circle at 0% 0%, #1c1a17 0%, #0f0e0d 100%);
          color: var(--atelier-text);
          font-family: var(--atelier-font-body);
        }

        /* HEADER STYLES */
        .atelier-header { margin-bottom: 40px; }
        .header-badge {
          display: inline-flex; align-items: center;
          padding: 6px 14px; border-radius: 40px;
          background: var(--atelier-gold-low); border: 1px solid var(--atelier-border);
          color: var(--atelier-gold); font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.2em; margin-bottom: 16px;
        }
        .header-main { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
        .atelier-title { 
          font-family: var(--atelier-font-header); font-size: 2.8rem; font-weight: 300;
          letter-spacing: -0.02em; line-height: 1.1; margin: 0;
        }
        .atelier-subtitle { color: var(--atelier-text-muted); font-size: 1rem; margin-top: 10px; max-width: 500px; }
        
        .btn-elite-primary {
          background: var(--atelier-gold); color: #000;
          border: none; border-radius: 8px; padding: 14px 28px;
          display: flex; align-items: center; gap: 12px;
          font-family: var(--atelier-font-header); font-size: 0.85rem; font-weight: 600;
          letter-spacing: 0.1em; cursor: pointer; transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
          box-shadow: 0 10px 30px rgba(184,155,106,0.15);
        }
        .btn-elite-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(184,155,106,0.25); filter: brightness(1.1); }

        /* DISCOVERY BAR */
        .atelier-discovery { 
          display: flex; gap: 20px; margin-bottom: 40px; 
          animation: slideIn 0.8s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .search-glass-container {
          flex: 1; position: relative; display: flex; align-items: center;
        }
        .search-icon { position: absolute; left: 20px; color: var(--atelier-gold); opacity: 0.6; }
        .search-glass-input {
          width: 100%; padding: 16px 20px 16px 54px;
          background: var(--atelier-card); border: 1.5px solid var(--atelier-border);
          border-radius: 12px; color: #fff; font-size: 0.95rem;
          transition: all 0.3s; backdrop-filter: blur(10px);
        }
        .search-glass-input:focus { border-color: var(--atelier-gold); outline: none; box-shadow: 0 0 20px rgba(184,155,106,0.1); }

        .btn-glass {
          background: var(--atelier-card); border: 1.5px solid var(--atelier-border);
          border-radius: 12px; color: var(--atelier-text); padding: 0 24px;
          height: 100%; display: flex; align-items: center; gap: 10px;
          font-size: 0.85rem; letter-spacing: 0.1em; cursor: pointer; transition: all 0.3s;
        }
        .btn-glass:hover { border-color: var(--atelier-gold); background: var(--atelier-gold-low); }

        /* GALLERY GRID */
        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(650px, 1fr)); gap: 30px; }
        @media (max-width: 1400px) { .atelier-grid { grid-template-columns: 1fr; } }

        .atelier-card-wrapper { transition: transform 0.4s; }
        .atelier-card-wrapper:hover { transform: translateY(-5px); }

        .elite-glass {
          background: var(--atelier-card);
          border: 1.5px solid var(--atelier-border);
          border-radius: 20px;
          backdrop-filter: blur(12px);
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .atelier-card:hover { border-color: rgba(184,155,106,0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }

        .card-top { 
          padding: 16px 24px; display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid rgba(184,155,106,0.1);
        }
        .badge-status { 
          display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
          padding: 4px 10px; border-radius: 4px;
        }
        .badge-status.active { color: var(--atelier-success); background: rgba(39, 174, 96, 0.1); }
        .badge-status.archived { color: var(--atelier-text-muted); background: rgba(255,255,255,0.05); }

        .btn-mini-action {
          width: 32px; height: 32px; border: 1px solid var(--atelier-border);
          border-radius: 8px; background: transparent; color: var(--atelier-text-muted);
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s; margin-left: 8px;
        }
        .btn-mini-action:hover { border-color: var(--atelier-gold); color: var(--atelier-gold); background: var(--atelier-gold-low); }
        .btn-mini-action.danger:hover { border-color: var(--atelier-error); color: var(--atelier-error); background: rgba(192,57,43,0.1); }

        .card-content-layout { display: flex; padding: 24px; gap: 24px; }

        /* SBAR: VISUALS */
        .card-visual-sidebar { width: 180px; flex-shrink: 0; }
        .image-atelier-frame {
          width: 100%; height: 220px; border-radius: 12px; overflow: hidden;
          background: #1a1917; border: 1px solid var(--atelier-border);
          position: relative; margin-bottom: 16px;
        }
        .image-atelier-frame img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s; }
        .atelier-card:hover .image-atelier-frame img { transform: scale(1.05); }
        .image-overlay-glow {
          position: absolute; inset: 0; 
          background: linear-gradient(to top, rgba(15,14,13,0.6) 0%, transparent 50%);
        }
        .image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--atelier-gold); }

        .sidebar-meta { display: flex; flex-direction: column; gap: 8px; }
        .meta-item { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: var(--atelier-text-muted); }
        .meta-item .label { opacity: 0.6; }
        .meta-item .value { color: var(--atelier-gold); font-weight: 500; }

        /* BODY: CONTENT */
        .card-main-body { flex: 1; }
        .brand-eyebrow { 
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.25em; 
          color: var(--atelier-gold); text-transform: uppercase; margin-bottom: 6px; display: block;
        }
        .product-name { font-family: var(--atelier-font-header); font-size: 1.7rem; font-weight: 400; margin: 0 0 12px 0; color: #fff; }
        
        .tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
        .atelier-tag { 
          font-size: 0.6rem; padding: 4px 10px; border-radius: 4px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
          color: var(--atelier-text-muted); text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* MATRIX TABLE */
        .variant-matrix-container {
          background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid rgba(184,155,106,0.1);
          overflow: hidden;
        }
        .matrix-header { 
          padding: 10px 16px; border-bottom: 1px solid rgba(184,155,106,0.1);
          display: flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 700;
          color: var(--atelier-gold); letter-spacing: 0.1em;
        }
        .matrix-scroll { overflow-x: auto; }
        .matrix-table { width: 100%; border-collapse: collapse; }
        .matrix-table th { 
          text-align: left; padding: 10px 16px; font-size: 0.55rem; color: var(--atelier-text-muted);
          text-transform: uppercase; letter-spacing: 0.1em; background: rgba(255,255,255,0.015);
        }
        .matrix-table td { padding: 12px 16px; font-size: 0.8rem; border-bottom: 1px solid rgba(184,155,106,0.05); }
        .matrix-table tr:last-child td { border-bottom: none; }

        .price-primary { color: #fff; font-weight: 600; }
        .price-cost { color: var(--atelier-text-muted); font-size: 0.75rem; }
        
        .stock-level-indicator { display: flex; align-items: center; gap: 6px; }
        .stock-count { font-weight: 700; }
        .stock-count.low { color: #e67e22; }
        .low-stock-icon { color: #e67e22; }

        .sku-cell { display: flex; align-items: center; gap: 6px; }
        .sku-text { font-family: monospace; font-size: 0.7rem; color: var(--atelier-text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .barcode-icon { color: var(--atelier-gold); opacity: 0.5; }

        /* UTILS */
        .animate-in { animation: cardIn 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards; opacity: 0; transform: translateY(20px); }
        @keyframes cardIn { to { opacity: 1; transform: translateY(0); } }
        .font-outfit { font-family: var(--atelier-font-header); }
        .mr-1 { margin-right: 4px; }
        .atelier-loading { padding: 100px 0; text-align: center; color: var(--atelier-gold); }
        .spinner { animation: spin 2s linear infinite; margin-bottom: 15px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      `}} />
    </div>
  );
}

