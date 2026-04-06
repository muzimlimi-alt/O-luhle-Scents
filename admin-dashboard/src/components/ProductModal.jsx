import React, { useState, useEffect, useRef } from 'react';
import {
  X, Plus, Trash2, GripVertical, AlertCircle, Loader2,
  Upload, Sparkles, Camera, ImagePlus, Settings, 
  Package, DollarSign, Info, Eye, EyeOff, Layout
} from 'lucide-react';
import { ReactSortable } from 'react-sortablejs';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const EMPTY_FORM = {
  name: '',
  brand: "O'luhle Scents",
  categoryId: '',
  supplierId: '',
  description: '',
  isActive: true,
  tags: ''
};

const EMPTY_VARIANT = { 
  size: '50ml', 
  price: '', 
  costPrice: '', 
  quantity: '0', 
  sku: '', 
  barcode: '',
  lowStockThreshold: '5' 
};

const ProductModal = ({ isOpen, onClose, product = null, categories = [], suppliers = [], onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // details, images, inventory
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [images, setImages] = useState([]);
  const [variants, setVariants] = useState([{ ...EMPTY_VARIANT }]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (product) {
      setFormData({
        name: product.name || '',
        brand: product.brand || "O'luhle Scents",
        categoryId: typeof product.category === 'object' ? product.category.id : (product.categoryId || ''),
        supplierId: product.supplierId || '',
        description: product.description || '',
        isActive: product.isActive !== false,
        tags: product.tags || ''
      });

      let existing = [];
      try {
        if (product.images) {
          const filenames = typeof product.images === 'string'
            ? JSON.parse(product.images)
            : product.images;
          if (Array.isArray(filenames)) {
            existing = filenames.map(name => ({
              id: name,
              url: `${API_ORIGIN}/images/products/${name}`,
              existing: true,
              name
            }));
          }
        }
      } catch (e) {
        console.error('Image parse error:', e);
      }
      setImages(existing);

      const vars = product.variants?.map(v => ({
        id: v.id,
        size: v.size || '',
        price: v.price?.toString() || '',
        costPrice: v.costPrice?.toString() || '',
        quantity: v.inventory?.quantity?.toString() ?? v.quantity?.toString() ?? '0',
        sku: v.sku || '',
        barcode: v.barcode || '',
        lowStockThreshold: v.inventory?.lowStockThreshold?.toString() ?? '5'
      })) || [];
      setVariants(vars.length > 0 ? vars : [{ ...EMPTY_VARIANT }]);
    } else {
      setFormData({
        ...EMPTY_FORM,
        categoryId: categories?.[0]?.id || ''
      });
      setImages([]);
      setVariants([{ ...EMPTY_VARIANT }]);
    }

    setError(null);
    setActiveTab('details');
  }, [product, isOpen, categories]);

  const addFiles = (files) => {
    const newImages = Array.from(files).map(file => ({
      id: Math.random().toString(36).slice(2, 11),
      file,
      url: URL.createObjectURL(file),
      existing: false,
      name: file.name
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const handleImageUpload = (e) => addFiles(e.target.files);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) addFiles(files);
  };

  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const addVariant = () => setVariants(prev => [...prev, { ...EMPTY_VARIANT }]);

  const removeVariant = (index) => {
    if (variants.length === 1) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index, field, value) => {
    setVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => data.append(k, v));

      const existingNames = images.filter(img => img.existing).map(img => img.name);
      data.append('existingImages', JSON.stringify(existingNames));
      images.filter(img => !img.existing && img.file).forEach(img => data.append('images', img.file));

      const sanitizedVariants = variants.map(v => ({
        ...v,
        price: v.price === '' ? '0' : v.price,
        costPrice: v.costPrice === '' ? '0' : v.costPrice,
        quantity: v.quantity === '' ? '0' : v.quantity,
        lowStockThreshold: v.lowStockThreshold === '' ? '5' : v.lowStockThreshold
      }));

      data.append('variants', JSON.stringify(sanitizedVariants));

      await onSave(data, product?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to preserve product artistry');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = !!product;

  return (
    <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="elite-modal">
        
        {/* ── Visual Sidebar ── */}
        <aside className="elite-sidebar">
          <div className="elite-sidebar-top">
            <div className="elite-emblem">
              {images.length > 0 ? (
                <img src={images[0].url} alt="Cover" className="elite-emblem-img" />
              ) : (
                <Camera size={32} strokeWidth={1} />
              )}
            </div>
            <div className="elite-status-badge">
              <span className={`status-dot ${formData.isActive ? 'active' : ''}`} />
              {formData.isActive ? 'Live on Boutique' : 'Store Hidden'}
            </div>
          </div>

          <nav className="elite-nav">
            <button 
              className={`elite-nav-item ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              <Info size={16} /> General Details
            </button>
            <button 
              className={`elite-nav-item ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => setActiveTab('images')}
            >
              <ImagePlus size={16} /> Asset Gallery
            </button>
            <button 
              className={`elite-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <Package size={16} /> Variations & Stock
            </button>
          </nav>

          <div className="elite-sidebar-footer">
            <p className="elite-id-label">PRODUCT SYSTEM ID</p>
            <code className="elite-id-value">{isEdit ? product.id.slice(0, 8).toUpperCase() : 'NEW-ENTRY'}</code>
          </div>
        </aside>

        {/* ── Main Workspce ── */}
        <div className="elite-workspace">
          
          <header className="elite-header">
            <div className="elite-header-title">
              <span className="elite-eyebrow">Redesigning Artisanal Scent Portfolio</span>
              <h2>{isEdit ? formData.name : 'Curate New Fragrance'}</h2>
            </div>
            <button onClick={onClose} className="elite-close-btn">
              <X size={20} />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="elite-main-form" id="product-art-form">
            {error && (
              <div className="elite-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="elite-scroll-area">
              
              {activeTab === 'details' && (
                <div className="elite-fade-in section-details">
                  <div className="elite-grid">
                    <div className="field-group span-full">
                      <label>Fragrance Name</label>
                      <input 
                        type="text" 
                        value={formData.name} 
                        onChange={e => set('name', e.target.value)}
                        placeholder="e.g. Midnight Silk Oud"
                        required
                      />
                    </div>
                    
                    <div className="field-group">
                      <label>House / Brand</label>
                      <input 
                        type="text" 
                        value={formData.brand} 
                        onChange={e => set('brand', e.target.value)}
                        placeholder="O'luhle Scents"
                      />
                    </div>

                    <div className="field-group">
                      <label>Collection / Category</label>
                      <select 
                        value={formData.categoryId} 
                        onChange={e => set('categoryId', e.target.value)}
                        required
                      >
                        <option value="">Select Gallery Category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label>Artisan Supplier</label>
                      <select 
                        value={formData.supplierId} 
                        onChange={e => set('supplierId', e.target.value)}
                      >
                        <option value="">Select Boutique Supplier...</option>
                        {suppliers.map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group span-full">
                      <label>Artisan Story / Description</label>
                      <textarea 
                        rows={6}
                        value={formData.description} 
                        onChange={e => set('description', e.target.value)}
                        placeholder="Describe the sensory notes and inspiration behind this creation..."
                      />
                    </div>

                    <div className="field-group">
                      <label>Aromatic Tags (Comma Separated)</label>
                      <input 
                        type="text" 
                        value={formData.tags} 
                        onChange={e => set('tags', e.target.value)}
                        placeholder="Woody, Spicy, Earthy"
                      />
                    </div>

                    <div className="field-group">
                      <label>Visibility Status</label>
                      <div className="elite-status-toggle" onClick={() => set('isActive', !formData.isActive)}>
                        {formData.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                        <span>{formData.isActive ? 'Public Display' : 'Archive / Draft'}</span>
                        <div className={`elite-switch ${formData.isActive ? 'active' : ''}`} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'images' && (
                <div className="elite-fade-in section-images">
                  <div className="elite-asset-header">
                    <h3>Visual Assets</h3>
                    <p>The first image serves as the primary boutique thumbnail. Drag to rearrange the aesthetic sequence.</p>
                  </div>

                  <div 
                    className={`elite-uploader ${dragOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" multiple accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    
                    <ReactSortable 
                      list={images} 
                      setList={setImages} 
                      className="elite-image-grid"
                      animation={250}
                      handle=".drag-trigger"
                    >
                      {images.map((img, i) => (
                        <div key={img.id} className="elite-asset-card">
                          {i === 0 && <span className="primary-tag">PRIMARY</span>}
                          <img src={img.url} alt="Product" />
                          <div className="asset-overlay">
                            <div className="drag-trigger"><GripVertical size={14} /></div>
                            <button type="button" onClick={() => removeImage(img.id)} className="asset-del">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="elite-add-asset" onClick={() => fileInputRef.current?.click()}>
                        <Plus size={24} />
                        <span>Add Asset</span>
                      </button>
                    </ReactSortable>
                  </div>
                </div>
              )}

              {activeTab === 'inventory' && (
                <div className="elite-fade-in section-inventory">
                  <div className="elite-asset-header">
                    <h3>Variation Matrix</h3>
                    <button type="button" className="elite-btn-outline mini" onClick={addVariant}>
                      <Plus size={14} /> New Variation
                    </button>
                  </div>

                  <div className="elite-variant-list">
                    {variants.map((v, i) => (
                      <div key={i} className="elite-variant-item">
                        <div className="variant-header">
                          <span className="variant-label">VARIATION #{i + 1}</span>
                          <button type="button" className="variant-del" onClick={() => removeVariant(i)} disabled={variants.length === 1}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="variant-grid">
                          <div className="field">
                            <label>Volume / Size</label>
                            <input type="text" value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)} placeholder="50ml" />
                          </div>
                          <div className="field">
                            <label>Retail Price (R)</label>
                            <div className="input-with-icon">
                              <DollarSign size={12} />
                              <input type="number" step="0.01" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)} placeholder="1250" />
                            </div>
                          </div>
                          <div className="field">
                            <label>Cost Price (R)</label>
                            <div className="input-with-icon">
                              <DollarSign size={12} />
                              <input type="number" step="0.01" value={v.costPrice} onChange={e => updateVariant(i, 'costPrice', e.target.value)} placeholder="450" />
                            </div>
                          </div>
                          <div className="field">
                            <label>Current Stock</label>
                            <input type="number" value={v.quantity} onChange={e => updateVariant(i, 'quantity', e.target.value)} placeholder="10" />
                          </div>
                          <div className="field">
                            <label>SKU Registry</label>
                            <input type="text" value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} placeholder="PRD-50-UD" />
                          </div>
                          <div className="field">
                            <label>Low Stock Alert</label>
                            <input type="number" value={v.lowStockThreshold} onChange={e => updateVariant(i, 'lowStockThreshold', e.target.value)} placeholder="5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            <footer className="elite-actions">
              <button type="button" className="elite-btn-cancel" onClick={onClose}>Discard Drafting</button>
              <button type="submit" className="elite-btn-save" disabled={loading}>
                {loading ? (
                  <><Loader2 className="spin" size={18} /> Processing Creation...</>
                ) : (
                  <><Sparkles size={18} /> {isEdit ? 'Finalize Master Entry' : 'Seal & Publish Entry'}</>
                )}
              </button>
            </footer>
          </form>

        </div>

        <style>{`
          .elite-overlay {
            position: fixed; inset: 0; z-index: 3000;
            background: rgba(8, 7, 6, 0.92);
            backdrop-filter: blur(24px) saturate(180%);
            display: flex; align-items: center; justify-content: center;
            padding: 24px;
            animation: eliteFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          
          .elite-modal {
            display: flex; width: 100%; max-width: 1100px; height: 100%; max-height: 820px;
            background: #11100f;
            border: 1px solid rgba(184, 155, 106, 0.25);
            border-radius: 4px; overflow: hidden;
            box-shadow: 0 40px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(184,155,106,0.05);
            animation: eliteSlideScale 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* ── Sidebar ── */
          .elite-sidebar {
            width: 260px; background: rgba(0,0,0,0.3);
            border-right: 1px solid rgba(184,155,106,0.15);
            display: flex; flex-direction: column;
            flex-shrink: 0;
          }
          .elite-sidebar-top { padding: 32px 24px; text-align: center; }
          .elite-emblem {
            width: 80px; height: 80px; margin: 0 auto 20px;
            border-radius: 2px; border: 1px solid rgba(184,155,106,0.25);
            display: flex; align-items: center; justify-content: center;
            color: #b89b6a; background: rgba(184,155,106,0.03);
            overflow: hidden;
          }
          .elite-emblem-img { width: 100%; height: 100%; object-fit: cover; }
          .elite-status-badge {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 6px 12px; border-radius: 100px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
            font-size: 0.65rem; color: rgba(255,255,255,0.45); letter-spacing: 0.05em;
          }
          .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #333; }
          .status-dot.active { background: #b89b6a; box-shadow: 0 0 8px #b89b6a; }

          .elite-nav { flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
          .elite-nav-item {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 16px; border-radius: 2px; border: none;
            background: transparent; color: rgba(255,255,255,0.3);
            font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
            cursor: pointer; transition: all 0.25s; text-align: left;
          }
          .elite-nav-item:hover { color: rgba(255,255,255,0.7); background: rgba(184,155,106,0.05); }
          .elite-nav-item.active { color: #b89b6a; background: rgba(184,155,106,0.08); }

          .elite-sidebar-footer { padding: 24px; border-top: 1px solid rgba(255,255,255,0.03); }
          .elite-id-label { font-size: 0.5rem; letter-spacing: 0.2em; color: rgba(184,155,106,0.4); margin-bottom: 4px; }
          .elite-id-value { font-family: monospace; font-size: 0.7rem; color: rgba(255,255,255,0.2); }

          /* ── Workspace ── */
          .elite-workspace { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }
          .elite-header {
            padding: 24px 32px; border-bottom: 1px solid rgba(184,155,106,0.12);
            display: flex; align-items: flex-start; justify-content: space-between;
          }
          .elite-eyebrow { font-size: 0.58rem; letter-spacing: 0.25em; text-transform: uppercase; color: #b89b6a; opacity: 0.6; display: block; margin-bottom: 4px; }
          .elite-header-title h2 { font-size: 1.4rem; font-weight: 300; letter-spacing: 0.1em; color: #e8dcc8; margin: 0; text-transform: uppercase; }
          .elite-close-btn { 
            width: 40px; height: 40px; border-radius: 2px; background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4);
            display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
          }
          .elite-close-btn:hover { border-color: #b89b6a; color: #b89b6a; }

          .elite-main-form { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
          .elite-scroll-area { flex: 1; overflow-y: auto; padding: 32px; scrollbar-width: thin; scrollbar-color: rgba(184,155,106,0.2) transparent; }
          .elite-scroll-area::-webkit-scrollbar { width: 5px; }
          .elite-scroll-area::-webkit-scrollbar-thumb { background: rgba(184,155,106,0.2); }

          .elite-fade-in { animation: eliteFadeSlide 0.4s ease-out; }
          
          /* ── Grid & Inputs ── */
          .elite-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .field-group { display: flex; flex-direction: column; gap: 8px; }
          .field-group.span-full { grid-column: 1 / -1; }
          .field-group label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(184,155,106,0.6); }
          .field-group input, .field-group select, .field-group textarea {
            background: rgba(255,255,255,0.04); border: 1px solid rgba(184,155,106,0.15);
            padding: 12px 16px; border-radius: 2px; color: #ddd; font-size: 0.85rem; outline: none;
            transition: all 0.3s; font-family: inherit;
          }
          .field-group input:focus, .field-group select:focus, .field-group textarea:focus { border-color: #b89b6a; background: rgba(184,155,106,0.05); }
          .field-group select option { background: #1a1611; }

          .elite-status-toggle {
            display: flex; align-items: center; gap: 12px;
            background: rgba(255,255,255,0.03); border: 1px solid rgba(184,155,106,0.1);
            padding: 10px 16px; border-radius: 2px; cursor: pointer; transition: all 0.3s;
          }
          .elite-status-toggle:hover { border-color: rgba(184,155,106,0.4); }
          .elite-status-toggle span { font-size: 0.72rem; color: rgba(255,255,255,0.5); flex: 1; letter-spacing: 0.05em; }
          .elite-switch { width: 32px; height: 16px; border-radius: 20px; background: rgba(255,255,255,0.1); position: relative; transition: 0.3s; }
          .elite-switch::after { content: ''; position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #555; top: 3px; left: 3px; transition: 0.3s; }
          .elite-switch.active { background: #b89b6a; }
          .elite-switch.active::after { transform: translateX(16px); background: #fff; }

          /* ── Images ── */
          .elite-asset-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
          .elite-asset-header h3 { font-size: 0.65rem; letter-spacing: 0.25em; text-transform: uppercase; color: #b89b6a; margin: 0; }
          .elite-asset-header p { font-size: 0.72rem; color: rgba(255,255,255,0.3); margin: 4px 0 0; }
          
          .elite-uploader { padding: 4px; }
          .elite-image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
          .elite-asset-card {
            position: relative; aspect-ratio: 1; border-radius: 2px; border: 1px solid rgba(184,155,106,0.2);
            background: #000; overflow: hidden;
          }
          .elite-asset-card img { width: 100%; height: 100%; object-fit: cover; }
          .primary-tag {
            position: absolute; top: 0; left: 0; right: 0; background: #b89b6a; color: #111;
            font-size: 0.5rem; font-weight: 800; text-align: center; padding: 4px; letter-spacing: 0.1em; z-index: 2;
          }
          .asset-overlay {
            position: absolute; inset: 0; background: rgba(0,0,0,0.6);
            display: flex; align-items: center; justify-content: center; gap: 12px;
            opacity: 0; transition: opacity 0.25s;
          }
          .elite-asset-card:hover .asset-overlay { opacity: 1; }
          .drag-trigger { color: #fff; cursor: grab; padding: 8px; }
          .asset-del { background: rgba(180,40,30,0.8); border: none; color: #fff; padding: 8px; border-radius: 2px; cursor: pointer; }
          
          .elite-add-asset {
            aspect-ratio: 1; border: 1.5px dashed rgba(184,155,106,0.3); background: transparent;
            border-radius: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 12px; color: rgba(184,155,106,0.5); cursor: pointer; transition: all 0.3s;
          }
          .elite-add-asset:hover { border-color: #b89b6a; background: rgba(184,155,106,0.05); color: #b89b6a; }
          .elite-add-asset span { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; }

          /* ── Inventory ── */
          .elite-variant-list { display: flex; flex-direction: column; gap: 32px; }
          .elite-variant-item { border: 1px solid rgba(184,155,106,0.12); padding: 24px; border-radius: 2px; background: rgba(255,255,255,0.01); }
          .variant-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
          .variant-label { font-size: 0.55rem; letter-spacing: 0.25em; color: rgba(184,155,106,0.4); font-weight: 600; }
          .variant-del { background: transparent; border: none; color: rgba(255,255,255,0.2); cursor: pointer; transition: color 0.2s; }
          .variant-del:hover { color: #e04a4a; }
          .variant-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .variant-grid .field { display: flex; flex-direction: column; gap: 8px; }
          .variant-grid label { font-size: 0.55rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
          .variant-grid input {
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
            padding: 10px 14px; border-radius: 2px; color: #ddd; font-size: 0.8rem; outline: none; transition: 0.3s;
          }
          .variant-grid input:focus { border-color: rgba(184,155,106,0.4); }
          .input-with-icon { position: relative; }
          .input-with-icon svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: rgba(184,155,106,0.5); }
          .input-with-icon input { padding-left: 28px; }

          /* ── Footer ── */
          .elite-actions {
            padding: 24px 32px; background: #0c0b0a; border-top: 1px solid rgba(184,155,106,0.12);
            display: flex; align-items: center; justify-content: flex-end; gap: 20px;
          }
          .elite-btn-cancel { background: transparent; border: none; color: rgba(255,255,255,0.35); font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; }
          .elite-btn-cancel:hover { color: rgba(255,255,255,0.6); }
          .elite-btn-save {
            background: #b89b6a; color: #111; border: none; padding: 14px 40px; border-radius: 2px;
            font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
            cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 12px;
            box-shadow: 0 10px 30px rgba(184,155,106,0.15);
          }
          .elite-btn-save:hover:not(:disabled) { background: #d4b47e; transform: translateY(-2px); box-shadow: 0 15px 40px rgba(184,155,106,0.25); }
          .elite-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
          .spin { animation: eliteSpin 1s linear infinite; }

          .elite-error {
            display: flex; align-items: center; gap: 12px; padding: 16px 24px;
            background: rgba(180,40,30,0.1); border: 1px solid rgba(180,40,30,0.3);
            border-radius: 2px; color: #e57373; font-size: 0.8rem; margin-bottom: 24px;
          }

          @keyframes eliteFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes eliteSlideScale { from { opacity: 0; transform: scale(0.96) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes eliteFadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes eliteSpin { to { transform: rotate(360deg); } }

          @media (max-width: 1024px) {
            .elite-modal { flex-direction: column; max-height: 95vh; }
            .elite-sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid rgba(184,155,106,0.15); }
            .elite-nav { flex-direction: row; overflow-x: auto; padding: 8px; }
            .elite-sidebar-top, .elite-sidebar-footer { display: none; }
            .variant-grid { grid-template-columns: 1fr 1fr; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ProductModal;
