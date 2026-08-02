import React, { useState, useEffect, useRef } from 'react';
import {
  X, Plus, Trash2, GripVertical, AlertCircle, Loader2,
  Upload, Sparkles, Camera, ImagePlus, Settings,
  Package, DollarSign, Info, Layout, Boxes, Truck
} from 'lucide-react';
import { ReactSortable } from 'react-sortablejs';
import { adminOpsApi } from '../services/api';
import { Modal } from './Modal';

const PRODUCT_FAMILIES = [
  { value: 'PERFUME', label: 'Perfume' },
  { value: 'CANDLE', label: 'Candle' },
  { value: 'HOME_FRAGRANCE', label: 'Home Fragrance' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'GIFT_SET', label: 'Gift Set' },
];

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const EMPTY_FORM = {
  name: '',
  brand: "O'luhle Scents",
  categoryId: '',
  supplierId: '',
  description: '',
  status: 'ACTIVE',
  family: 'PERFUME',
  cardBadge: '',
  type: 'Extrait de Parfum',
  oilConcentration: '±20–40%',
  longevity: '±10–24 hours',
  scentFamily: 'Woody',
  characteristic: 'Warm, Masculine, Deep',
  topNotes: [],
  heartNotes: [],
  baseNotes: []
};

const AROMATIC_NOTES = [
  "Absinthe", "Aged Cedarwood", "Aged Oak", "Amber", "Ambrette Seed", "Aromatic Thyme", "Artemisia", "Benzoin", "Benzoin Resin", 
  "Bitter Orange Blossom", "Black Musk", "Blackcurrant Bud", "Blonde Woods", "Blue Chamomile", "Caramelised Amber", "Cashmere Musk", 
  "Cedarwood", "Clary Sage", "Clean Amber", "Clove Bud", "Cocoa", "Cold Metal", "Cool Stone", "Crushed Sea Salt", "Dark Patchouli", 
  "Dark Vetiver", "Delicate Mimosa", "Dewy Peony", "Dried Fruits", "Driftwood", "Elemi Resin", "Geranium", "Ginger", "Grapefruit Zest", 
  "Green Tea", "Honeyed Heliotrope", "Incense", "Iris", "Japanese Cypress", "Labdanum", "Lavender", "Leather", "Lily Of The Valley", 
  "Magnolia", "Mandarin", "Musk", "Night-Scented Stock", "Nutmeg", "Pale Musks", "Passion Fruit", "Patchouli", "Peony", "Pink Champagne Accord", 
  "Pink Pepper", "Powdered Violet", "Praline", "Raspberry", "Rosewood", "Saffron", "Saffron Threads", "Shiso Leaf", "Silver Birch", 
  "Smoky Birch Tar", "Smoky Labdanum", "Smoky Vetiver", "Soft Musk", "Suede", "Taif Rose", "Tobacco Leaf", "Tonka Bean", "Vanilla Absolute", 
  "Vanilla Orchid", "Vetiver", "Violet Leaf", "White Amber", "White Musk", "White Peach", "White Woods", "Ylang-Ylang", "Aged Oud", 
  "Ambergris", "Black Cardamom", "Black Pepper", "Bulgarian Rose Absolute", "Cashmeran", "Cinnamon Bark", "Cool Moonflower", 
  "Creamy Sandalwood", "Crisp Bergamot", "Damask Rose Absolute", "Dark Violet", "Deep Sandalwood", "Golden Amber", "Grey Amber", 
  "Gunpowder Accord", "Hinoki Wood", "Iris Butter", "Iris Pallida", "Italian Bergamot", "Juicy Peach", "Juniper Berry", 
  "Night-Blooming Jasmine", "Oakmoss", "Oceanic Ozone", "Orris Root", "Oud Wood", "Pear Blossom", "Powdery Orris Root", 
  "Ripe Red Berries", "Sage", "Sandalwood", "Smoky Oud", "Sparkling Bergamot", "Sun-Warmed Neroli", "Tuberose", "Turkish Rose", 
  "Violet", "Warm Vanilla", "White Jasmine", "White Lotus"
].sort();

const EMPTY_VARIANT = {
  size: '50ml',
  price: '',
  costPrice: '',
  quantity: '0',
  sku: '',
  barcode: '',
  uom: 'ml',
  volume: '50',
  weightGrams: '',
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

  // PIM: family-driven attributes (e.g. Candle -> Wax Type) and alternative suppliers
  const [attributeDefs, setAttributeDefs] = useState([]);
  const [attributeValues, setAttributeValues] = useState({}); // { [definitionId]: value }
  const [altSuppliers, setAltSuppliers] = useState([]);
  const [newAltSupplier, setNewAltSupplier] = useState({ supplierId: '', supplierSku: '', leadTimeDays: '', minOrderQty: '' });

  useEffect(() => {
    if (!isOpen) return;

    if (product) {
      setFormData({
        name: product.name || '',
        brand: product.brand || "O'luhle Scents",
        categoryId: (product.category && typeof product.category === 'object') ? product.category.id : (product.categoryId || ''),
        supplierId: product.supplierId || '',
        description: product.description || '',
        status: product.status || 'ACTIVE',
        family: product.family || 'PERFUME',
        cardBadge: product.cardBadge || '',
        type: product.type || 'Extrait de Parfum',
        oilConcentration: product.oilConcentration || '',
        longevity: product.longevity || '',
        scentFamily: product.scentFamily || 'Woody',
        characteristic: product.characteristic || '',
        topNotes: safeParseNotes(product.topNotes),
        heartNotes: safeParseNotes(product.heartNotes),
        baseNotes: safeParseNotes(product.baseNotes)
      });

      // Media library records (alt text) are keyed by filename so they can be
      // merged onto the legacy images array without changing how it's stored.
      const mediaByFilename = {};
      (product.media || []).forEach(pm => {
        mediaByFilename[pm.media.storageKey] = { mediaId: pm.mediaId, altText: pm.media.altText || '' };
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
              name,
              mediaId: mediaByFilename[name]?.mediaId || null,
              altText: mediaByFilename[name]?.altText || ''
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
        uom: v.uom || 'ml',
        volume: v.volume?.toString() || '',
        weightGrams: v.weightGrams?.toString() || '',
        lowStockThreshold: v.inventory?.lowStockThreshold?.toString() ?? '5'
      })) || [];
      setVariants(vars.length > 0 ? vars : [{ ...EMPTY_VARIANT }]);

      const existingAttrs = {};
      (product.attributeValues || []).forEach(av => { existingAttrs[av.definitionId] = av.value; });
      setAttributeValues(existingAttrs);

      adminOpsApi.productSuppliers.list(product.id).then(setAltSuppliers).catch(() => setAltSuppliers([]));
    } else {
      setFormData({
        ...EMPTY_FORM,
        categoryId: categories?.[0]?.id || ''
      });
      setImages([]);
      setVariants([{ ...EMPTY_VARIANT }]);
      setAttributeValues({});
      setAltSuppliers([]);
    }

    setError(null);
    setActiveTab('details');
  }, [product, isOpen, categories]);

  // Load the attribute set for whichever family is currently selected —
  // re-fetches whenever the admin switches Perfume <-> Candle etc.
  useEffect(() => {
    if (!isOpen) return;
    adminOpsApi.attributeDefinitions.list(formData.family)
      .then(setAttributeDefs)
      .catch(() => setAttributeDefs([]));
  }, [isOpen, formData.family]);

  const setAttributeValue = (definitionId, value) => {
    setAttributeValues(prev => ({ ...prev, [definitionId]: value }));
  };

  const addAltSupplier = async () => {
    if (!newAltSupplier.supplierId || !product?.id) return;
    try {
      const created = await adminOpsApi.productSuppliers.create(product.id, newAltSupplier);
      setAltSuppliers(prev => [...prev, created]);
      setNewAltSupplier({ supplierId: '', supplierSku: '', leadTimeDays: '', minOrderQty: '' });
    } catch (err) {
      alert('Failed to add supplier: ' + err.message);
    }
  };

  const removeAltSupplier = async (id) => {
    try {
      await adminOpsApi.productSuppliers.delete(id);
      setAltSuppliers(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert('Failed to remove supplier: ' + err.message);
    }
  };

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

  const updateAltText = (img, value) => {
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, altText: value } : i));
  };

  const saveAltText = async (img) => {
    if (!img.mediaId) return; // brand-new, unsaved images have no MediaAsset yet
    try {
      await adminOpsApi.media.updateAltText(img.mediaId, img.altText);
    } catch (err) {
      console.warn('Failed to save alt text:', err.message);
    }
  };

  const addVariant = () => setVariants(prev => [...prev, { ...EMPTY_VARIANT }]);

  const removeVariant = (index) => {
    if (variants.length === 1) return;
    setVariants(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateVariant = (index, field, value) => {
    setVariants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const safeParseNotes = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { 
      const parsed = JSON.parse(val); 
      return Array.isArray(parsed) ? parsed : [];
    } catch { 
      return typeof val === 'string' ? val.split(',').filter(Boolean).map(s => s.trim()) : []; 
    }
  };

  const toggleNote = (group, note) => {
    setFormData(prev => {
      const current = prev[group] || [];
      const updated = current.includes(note) 
        ? current.filter(n => n !== note)
        : [...current, note];
      return { ...prev, [group]: updated };
    });
  };

  const [noteSearch, setNoteSearch] = useState('');

  const filteredNotes = AROMATIC_NOTES.filter(n => 
    n.toLowerCase().includes(noteSearch.toLowerCase())
  );

  const set = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-population Rules
      if (field === 'type') {
        if (value === "Extrait de Parfum" || value === "Parfum") {
          updated.oilConcentration = "±20–40%"; updated.longevity = "±10–24 hours";
        } else if (value === "Eau de Parfum") {
          updated.oilConcentration = "±15–20%"; updated.longevity = "±6–10 hours";
        } else if (value === "Eau de Toilette") {
          updated.oilConcentration = "±5–15%"; updated.longevity = "±3–6 hours";
        } else if (value === "Eau de Cologne" || value === "Eau Fraîche") {
          updated.oilConcentration = value === "Eau de Cologne" ? "±2–4%" : "±1–3%";
          updated.longevity = "±1–2 hours";
        } else if (value === "Eau de Senteur") {
          updated.longevity = "Short, depends on solvents";
        } else if (value === "Splash & Aftershave") {
          updated.longevity = "±1–3 hours";
        } else {
          updated.oilConcentration = "Varies";
        }
      }

      if (field === 'scentFamily') {
        const charMap = {
          "Floral": "Sweet, Soft, Feminine",
          "Citrus": "Fresh, Bright, Uplifting",
          "Fruity": "Sweet, Juicy, Fun",
          "Woody": "Warm, Masculine, Deep",
          "Oriental": "Warm, Exotic, Sensual",
          "Aquatic": "Clean, Fresh, Airy; not too sweet or heavy",
          "Herbal": "Fresh, Herbal, Clean"
        };
        updated.characteristic = charMap[value] || "N/A";
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          data.append(k, JSON.stringify(v));
        } else {
          data.append(k, v);
        }
      });

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
      data.append('attributes', JSON.stringify(attributeValues));

      await onSave(data, product?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to preserve product artistry');
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!product;

  return (
    <Modal isOpen={isOpen} onClose={onClose} raw>
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
              <span className={`status-dot ${formData.status === 'ACTIVE' ? 'active' : ''}`} />
              {formData.status === 'ACTIVE' ? 'Live on Boutique' : formData.status === 'DRAFT' ? 'Draft' : 'Archived'}
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
              className={`elite-nav-item ${activeTab === 'classification' ? 'active' : ''}`}
              onClick={() => setActiveTab('classification')}
            >
              <Sparkles size={16} /> Classification
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
                    <div className="elite-section-divider span-full" style={{ marginTop: 0 }}>
                      <Info size={14} /> <span>Identity & Status</span>
                    </div>

                    <div className="field-group span-full">
                      <label>Fragrance Name</label>
                      <input 
                        type="text" 
                        value={formData.name} 
                        onChange={e => set('name', e.target.value.slice(0, 150))}
                        placeholder="e.g. Midnight Silk Oud"
                        required
                        maxLength={150}
                      />
                    </div>
                    
                    <div className="field-group">
                      <label>House / Brand</label>
                      <input 
                        type="text" 
                        value={formData.brand} 
                        onChange={e => set('brand', e.target.value.slice(0, 100))}
                        placeholder="O'luhle Scents"
                        maxLength={100}
                      />
                    </div>

                    <div className="field-group">
                      <label>Card Badge</label>
                      <select value={formData.cardBadge} onChange={e => set('cardBadge', e.target.value)}>
                        <option value="">No Badge</option>
                        <option value="Bestseller">Bestseller</option>
                        <option value="New">New</option>
                        <option value="Popular">Popular</option>
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

                    <div className="field-group">
                      <label>Visibility Status</label>
                      <select value={formData.status} onChange={e => set('status', e.target.value)}>
                        <option value="ACTIVE">Active — Public Display</option>
                        <option value="DRAFT">Draft — Not Yet Published</option>
                        <option value="ARCHIVED">Archived — Hidden</option>
                      </select>
                    </div>

                    <div className="field-group">
                      <label>Product Family</label>
                      <select value={formData.family} onChange={e => set('family', e.target.value)}>
                        {PRODUCT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>

                    <div className="field-group span-full">
                      <label>Description (Optional)</label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="Describe the sensory notes and inspiration behind this creation..."
                      />
                    </div>

                    {isEdit && (
                      <div className="field-group span-full">
                        <div className="elite-section-divider" style={{ margin: '8px 0 4px' }}>
                          <Truck size={14} /> <span>Alternative Suppliers</span>
                        </div>
                        <div className="alt-supplier-list">
                          {altSuppliers.map(s => (
                            <div key={s.id} className="alt-supplier-row">
                              <span className="alt-supplier-name">{s.supplier?.name}</span>
                              {s.supplierSku && <span className="alt-supplier-meta">SKU: {s.supplierSku}</span>}
                              {s.leadTimeDays != null && <span className="alt-supplier-meta">{s.leadTimeDays}d lead</span>}
                              {s.minOrderQty != null && <span className="alt-supplier-meta">MOQ {s.minOrderQty}</span>}
                              <button type="button" className="alt-supplier-remove" onClick={() => removeAltSupplier(s.id)}><Trash2 size={12} /></button>
                            </div>
                          ))}
                          {altSuppliers.length === 0 && <p className="alt-supplier-empty">No alternative suppliers linked yet.</p>}
                        </div>
                        <div className="alt-supplier-add">
                          <select value={newAltSupplier.supplierId} onChange={e => setNewAltSupplier(s => ({ ...s, supplierId: e.target.value }))}>
                            <option value="">Add supplier...</option>
                            {suppliers.filter(sup => sup.id !== formData.supplierId).map(sup => (
                              <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                          </select>
                          <input type="text" placeholder="Supplier SKU" value={newAltSupplier.supplierSku} onChange={e => setNewAltSupplier(s => ({ ...s, supplierSku: e.target.value }))} />
                          <input type="number" placeholder="Lead days" value={newAltSupplier.leadTimeDays} onChange={e => setNewAltSupplier(s => ({ ...s, leadTimeDays: e.target.value }))} />
                          <input type="number" placeholder="MOQ" value={newAltSupplier.minOrderQty} onChange={e => setNewAltSupplier(s => ({ ...s, minOrderQty: e.target.value }))} />
                          <button type="button" className="elite-btn-modern-variant" onClick={addAltSupplier}><Plus size={14} /></button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {activeTab === 'classification' && (
                <div className="elite-fade-in section-classification">
                  {formData.family === 'PERFUME' ? (
                  <div className="elite-grid">
                    <div className="elite-section-divider span-full" style={{ marginTop: 0 }}>
                      <Sparkles size={14} /> <span>Artisan Classification</span>
                    </div>

                    <div className="field-group">
                      <label>Product Type</label>
                      <select value={formData.type} onChange={e => set('type', e.target.value)}>
                        {["Extrait de Parfum", "Parfum", "Eau de Parfum", "Eau de Toilette", "Eau de Cologne", "Eau Fraîche", "Eau de Senteur", "Splash & Aftershave"].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label>Oil Concentration (Auto)</label>
                      <input type="text" value={formData.oilConcentration} readOnly className="read-only" />
                    </div>

                    <div className="field-group">
                      <label>Longevity Profile (Auto)</label>
                      <input type="text" value={formData.longevity} readOnly className="read-only" />
                    </div><br></br>

                    <div className="elite-section-divider span-full">
                      <Layout size={14} /> <span>Sensory & Aromatic Architecture</span>
                    </div>

                    <div className="field-group">
                      <label>Category Hub</label>
                      <select 
                        value={formData.categoryId} 
                        onChange={e => set('categoryId', e.target.value)}
                        required
                      >
                        <option value="">Select Category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label>Scent Family</label>
                      <select value={formData.scentFamily} onChange={e => set('scentFamily', e.target.value)}>
                        {["Aquatic", "Floral", "Woody", "Oriental", "Citrus", "Fruity", "Herbal"].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group span-full">
                      <label>Classification Characteristic (Auto)</label>
                      <input type="text" value={formData.characteristic} readOnly className="read-only" />
                    </div>

                    <div className="span-full aromatic-notes-section">
                      <div className="note-group search-header">
                        <label>Scent Architecture (Top, Heart & Base)</label>
                        <div className="note-search-wrapper">
                          <input 
                            type="text" 
                            placeholder="Quick search for a scent note..." 
                            value={noteSearch}
                            onChange={(e) => setNoteSearch(e.target.value)}
                            className="note-search-input"
                          />
                        </div>
                      </div>

                      <div className="scent-architecture-container">
                        <div className="architecture-column">
                          <label className="column-head">Top Notes</label>
                          <div className="architecture-grid">
                            {filteredNotes.map(note => (
                              <label key={note} className={`note-chip ${formData.topNotes?.includes(note) ? 'selected' : ''}`}>
                                <input type="checkbox" checked={formData.topNotes?.includes(note)} onChange={() => toggleNote('topNotes', note)} />
                                <span>{note}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="architecture-column">
                          <label className="column-head">Heart Notes</label>
                          <div className="architecture-grid">
                            {filteredNotes.map(note => (
                              <label key={note} className={`note-chip ${formData.heartNotes?.includes(note) ? 'selected' : ''}`}>
                                <input type="checkbox" checked={formData.heartNotes?.includes(note)} onChange={() => toggleNote('heartNotes', note)} />
                                <span>{note}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="architecture-column">
                          <label className="column-head">Base Notes</label>
                          <div className="architecture-grid">
                            {filteredNotes.map(note => (
                              <label key={note} className={`note-chip ${formData.baseNotes?.includes(note) ? 'selected' : ''}`}>
                                <input type="checkbox" checked={formData.baseNotes?.includes(note)} onChange={() => toggleNote('baseNotes', note)} />
                                <span>{note}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                  ) : (
                    <div className="elite-grid">
                      <div className="elite-section-divider span-full" style={{ marginTop: 0 }}>
                        <Boxes size={14} /> <span>{PRODUCT_FAMILIES.find(f => f.value === formData.family)?.label} Attributes</span>
                      </div>

                      <div className="field-group">
                        <label>Category Hub</label>
                        <select value={formData.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                          <option value="">Select Category...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {attributeDefs.filter(d => !d.appliesToVariant).map(def => (
                        <div className="field-group" key={def.id}>
                          <label>{def.label}{def.unit ? ` (${def.unit})` : ''}</label>
                          {def.dataType === 'ENUM' ? (
                            <select value={attributeValues[def.id] || ''} onChange={e => setAttributeValue(def.id, e.target.value)}>
                              <option value="">Select...</option>
                              {(def.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : def.dataType === 'BOOLEAN' ? (
                            <select value={attributeValues[def.id] || 'false'} onChange={e => setAttributeValue(def.id, e.target.value)}>
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          ) : (
                            <input
                              type={def.dataType === 'NUMBER' ? 'number' : 'text'}
                              value={attributeValues[def.id] || ''}
                              onChange={e => setAttributeValue(def.id, e.target.value)}
                            />
                          )}
                        </div>
                      ))}

                      {attributeDefs.filter(d => !d.appliesToVariant).length === 0 && (
                        <div className="field-group span-full">
                          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            No attributes defined for this family yet. Add some under Admin → Attributes.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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
                        <div key={img.id} className="elite-asset-item">
                          <div className="elite-asset-card">
                            {i === 0 && <span className="primary-tag">PRIMARY</span>}
                            <img src={img.url} alt={img.altText || 'Product'} />
                            <div className="asset-overlay">
                              <div className="drag-trigger"><GripVertical size={14} /></div>
                              <button type="button" onClick={() => removeImage(img.id)} className="asset-del">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {img.mediaId ? (
                            <input
                              type="text"
                              className="asset-alt-input"
                              placeholder="Alt text (for accessibility & SEO)"
                              value={img.altText || ''}
                              onChange={e => updateAltText(img, e.target.value)}
                              onBlur={() => saveAltText(img)}
                            />
                          ) : (
                            <span className="asset-alt-pending">Save to add alt text</span>
                          )}
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
                    <button type="button" className="elite-btn-modern-variant" onClick={addVariant}>
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
                            <label>Designation / Size</label>
                            <select value={v.size} onChange={e => {
                              const val = e.target.value;
                              updateVariant(i, 'size', val);
                              if (val === 'Full Size') updateVariant(i, 'volume', '100');
                              else if (val === 'Travel Size') updateVariant(i, 'volume', '50');
                            }}>
                              <option value="Full Size">Full Size</option>
                              <option value="Travel Size">Travel Size</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>UOM (ml/mg/ea)</label>
                            <input type="text" value={v.uom} onChange={e => updateVariant(i, 'uom', e.target.value)} placeholder="ml" maxLength={20} />
                          </div>
                          <div className="field">
                            <label>Volume (Numerical)</label>
                            <input type="number" value={v.volume} onChange={e => updateVariant(i, 'volume', e.target.value)} readOnly={v.size !== 'Other'} className={v.size !== 'Other' ? 'read-only' : ''} />
                          </div>
                          <div className="field">
                            <label>Retail Price (R)</label>
                            <div className="input-with-icon">
                              <input type="number" step="0.01" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)} placeholder="1250" />
                            </div>
                          </div>
                          <div className="field">
                            <label>Cost Price (R)</label>
                            <div className="input-with-icon">
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
                          <div className="field">
                            <label>Weight (g)</label>
                            <input type="number" value={v.weightGrams} onChange={e => updateVariant(i, 'weightGrams', e.target.value)} placeholder="150" />
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
          .elite-modal {
            display: flex; width: 100%; max-width: 1100px; height: 100%; max-height: 820px;
            background: var(--color-bg-card);
            border: 1px solid var(--color-border);
            border-radius: 4px; overflow: hidden;
            box-shadow: var(--shadow-lg);
            animation: eliteSlideScale 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* ── Sidebar ── */
          .elite-sidebar {
            width: 260px; background: var(--color-bg-dark);
            border-right: 1px solid var(--color-border);
            display: flex; flex-direction: column;
            flex-shrink: 0;
          }
          .elite-sidebar-top { padding: 32px 24px; text-align: center; }
          .elite-emblem {
            width: 80px; height: 80px; margin: 0 auto 20px;
            border-radius: 2px; border: 1px solid var(--color-border);
            display: flex; align-items: center; justify-content: center;
            color: var(--color-primary); background: var(--color-border-light);
            overflow: hidden;
          }
          .elite-emblem-img { width: 100%; height: 100%; object-fit: cover; }
          .elite-status-badge {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 6px 12px; border-radius: 100px;
            background: var(--color-surface); border: 1px solid var(--color-border-light);
            font-size: 0.65rem; color: var(--color-text-muted); letter-spacing: 0.05em;
          }
          .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-border); }
          .status-dot.active { background: var(--color-primary); box-shadow: 0 0 8px var(--color-primary); }

          .elite-nav { flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
          .elite-nav-item {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 16px; border-radius: 2px; border: none;
            background: transparent; color: var(--color-text-muted);
            font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase;
            cursor: pointer; transition: all 0.25s; text-align: left;
          }
          .elite-nav-item:hover { color: var(--color-text); background: var(--color-border-light); }
          .elite-nav-item.active { color: var(--color-primary); background: var(--color-border-light); }

          .elite-sidebar-footer { padding: 24px; border-top: 1px solid var(--color-border-light); }
          .elite-id-label { font-size: 0.5rem; letter-spacing: 0.2em; color: var(--color-primary); opacity: 0.6; margin-bottom: 4px; }
          .elite-id-value { font-family: monospace; font-size: 0.7rem; color: var(--color-text-muted); }

          /* ── Workspace ── */
          .elite-workspace { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }
          .elite-header {
            padding: 24px 32px; border-bottom: 1px solid var(--color-border);
            display: flex; align-items: flex-start; justify-content: space-between;
          }
          .elite-eyebrow { font-size: 0.58rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--color-primary); opacity: 0.6; display: block; margin-bottom: 4px; }
          .elite-header-title h2 { font-size: 1.4rem; font-weight: 300; letter-spacing: 0.1em; color: var(--color-text-header); margin: 0; text-transform: uppercase; }
          .elite-close-btn { 
            width: 40px; height: 40px; border-radius: 2px; background: var(--color-surface);
            border: 1px solid var(--color-border); color: var(--color-text-muted);
            display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
          }
          .elite-close-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

          .field-group input:focus, .field-group select:focus, .field-group textarea:focus { border-color: var(--color-primary); background: var(--color-border-light); }
          .field-group select option { background: var(--color-bg-card); color: var(--color-text); font-size: 0.85rem; }
          .field-group input.read-only { background: var(--color-surface); border-color: var(--color-border-light); cursor: not-allowed; color: var(--color-text-muted); }

          .alt-supplier-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
          .alt-supplier-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border-light); border-radius: 2px; font-size: 0.78rem; }
          .alt-supplier-name { font-weight: 600; flex-shrink: 0; }
          .alt-supplier-meta { color: var(--color-text-muted); font-size: 0.72rem; }
          .alt-supplier-remove { margin-left: auto; background: none; border: none; color: var(--color-text-muted); cursor: pointer; }
          .alt-supplier-remove:hover { color: var(--color-error); }
          .alt-supplier-empty { font-size: 0.78rem; color: var(--color-text-muted); font-style: italic; }
          .alt-supplier-add { display: grid; grid-template-columns: 2fr 1fr 90px 90px 40px; gap: 8px; }
          .alt-supplier-add select, .alt-supplier-add input {
            background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 2px;
            padding: 8px 10px; color: var(--color-text); font-size: 0.78rem;
          }

          .aromatic-notes-section { margin-top: 24px; display: flex; flex-direction: column; gap: 32px; }
          .note-group { display: flex; flex-direction: column; gap: 12px; }
          .checkbox-grid { 
            display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; 
            max-height: 180px; overflow-y: auto; padding: 12px; background: var(--color-surface); border: 1px solid var(--color-border);
            scrollbar-width: thin;
          }
          .checkbox-item { display: flex; align-items: center; gap: 10px; font-size: 0.72rem; color: var(--color-text); cursor: pointer; }
          .checkbox-item input { width: 14px; height: 14px; accent-color: var(--color-primary); }
          .checkbox-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

          .elite-main-form { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
          .elite-scroll-area { flex: 1; overflow-y: auto; padding: 32px; scrollbar-width: thin; scrollbar-color: rgba(184,155,106,0.2) transparent; }
          .elite-scroll-area::-webkit-scrollbar { width: 5px; }
          .elite-scroll-area::-webkit-scrollbar-thumb { background: rgba(184,155,106,0.2); }

          .elite-fade-in { animation: eliteFadeSlide 0.4s ease-out; }
          
          .elite-section-divider {
            display: flex; align-items: center; gap: 12px;
            margin: 32px 0 16px; padding: 0 4px;
          }
          .elite-section-divider span {
            font-size: 0.65rem; font-weight: 600; color: var(--color-primary);
            text-transform: uppercase; letter-spacing: 0.15em;
          }
          .elite-section-divider::after {
            content: ''; flex: 1; height: 1px;
            background: linear-gradient(to right, rgba(184, 155, 106, 0.2), transparent);
          }

          /* ── Grid & Inputs ── */
          .elite-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .field-group { display: flex; flex-direction: column; gap: 8px; }
          .field-group.span-full { grid-column: 1 / -1; }
          .field-group label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-primary); opacity: 0.7; }
          .field-group input, .field-group select, .field-group textarea {
            background: var(--color-bg-card); border: 1.5px solid var(--color-border);
            padding: 12px 16px; border-radius: 2px; color: var(--color-text); font-size: 0.85rem; outline: none;
            transition: all 0.3s; font-family: inherit;
          }
          .field-group input:focus, .field-group select:focus, .field-group textarea:focus { border-color: var(--color-primary); background: var(--color-border-light); }
          .field-group select option { background: var(--color-bg-card); color: var(--color-text); }

          .elite-status-toggle {
            display: flex; align-items: center; gap: 12px;
            background: var(--color-surface); border: 1px solid var(--color-border);
            padding: 10px 16px; border-radius: 2px; cursor: pointer; transition: all 0.3s;
          }
          .elite-status-toggle:hover { border-color: var(--color-primary); }
          .elite-status-toggle span { font-size: 0.72rem; color: var(--color-text); flex: 1; letter-spacing: 0.05em; }
          .elite-switch { width: 32px; height: 16px; border-radius: 20px; background: var(--color-border); position: relative; transition: 0.3s; }
          .elite-switch::after { content: ''; position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #999; top: 3px; left: 3px; transition: 0.3s; }
          .elite-switch.active { background: var(--color-primary); }
          .elite-switch.active::after { transform: translateX(16px); background: #fff; }

          /* ── Images ── */
          .elite-asset-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
          .elite-asset-header h3 { font-size: 0.65rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--color-primary); margin: 0; }
          .elite-asset-header p { font-size: 0.72rem; color: var(--color-text-muted); margin: 4px 0 0; }
          
          .elite-uploader { padding: 4px; }
          .elite-image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; align-items: start; }
          .elite-asset-item { display: flex; flex-direction: column; gap: 6px; }
          .asset-alt-input {
            width: 100%; font-size: 0.65rem; padding: 5px 8px; background: var(--color-surface);
            border: 1px solid var(--color-border); border-radius: 2px; color: var(--color-text); outline: none;
          }
          .asset-alt-input:focus { border-color: var(--color-primary); }
          .asset-alt-pending { font-size: 0.6rem; color: var(--color-text-muted); font-style: italic; text-align: center; }
          .elite-add-asset { align-self: start; }
          .elite-asset-card {
            position: relative; aspect-ratio: 1; border-radius: 2px; border: 1px solid var(--color-border);
            background: var(--color-bg-dark); overflow: hidden;
          }
          .elite-asset-card img { width: 100%; height: 100%; object-fit: cover; }
          .primary-tag {
            position: absolute; top: 0; left: 0; right: 0; background: var(--color-primary); color: #111;
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
          .elite-variant-item { border: 1px solid var(--color-border); padding: 24px; border-radius: 2px; background: var(--color-bg-card); }
          .variant-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
          .variant-label { font-size: 0.55rem; letter-spacing: 0.25em; color: var(--color-primary); font-weight: 600; opacity: 0.6; }
          .variant-del { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; transition: color 0.2s; }
          .variant-del:hover { color: var(--color-error); }
          .variant-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .variant-grid .field { display: flex; flex-direction: column; gap: 8px; }
          .variant-grid label { font-size: 0.55rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--color-primary); opacity: 0.7; }
          .variant-grid input, .variant-grid select {
            background: var(--color-bg-card); border: 1px solid var(--color-border);
            padding: 10px 14px; border-radius: 2px; color: var(--color-text); font-size: 0.8rem; outline: none; transition: 0.3s;
          }
          .variant-grid input:focus, .variant-grid select:focus { border-color: var(--color-primary); }
          .input-with-icon { position: relative; }
          .input-with-icon input { width: 100%; }

          /* ── Footer ── */
          .elite-actions {
            padding: 24px 32px; background: var(--color-bg-dark); border-top: 1px solid var(--color-border);
            display: flex; align-items: center; justify-content: flex-end; gap: 20px;
          }
          .elite-btn-cancel { background: transparent; border: none; color: var(--color-text-muted); font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; }
          .elite-btn-cancel:hover { color: var(--color-text); }
          .elite-btn-save {
            background: var(--color-primary); color: #111; border: none; padding: 14px 40px; border-radius: 2px;
            font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
            cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 12px;
            box-shadow: var(--shadow-md);
          }
          .elite-btn-save:hover:not(:disabled) { background: var(--color-primary-light); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
          .elite-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
          .spin { animation: eliteSpin 1s linear infinite; }

          /* New Search & Note Styling */
          .note-search-wrapper { margin-top: 8px; }
          .note-search-input {
            width: 100%; background: var(--color-surface); border: 1.5px solid var(--color-border);
            padding: 10px 16px; border-radius: 2px; color: var(--color-text); font-size: 0.8rem; outline: none; transition: all 0.3s;
          }
          .note-search-input:focus { border-color: var(--color-primary); background: var(--color-bg-card); }

          .scent-architecture-container {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
            margin-top: 24px; min-height: 400px;
          }
          .architecture-column { 
            display: flex; flex-direction: column; gap: 12px; 
            background: var(--color-surface); border: 1px solid var(--color-border);
            padding: 16px; border-radius: 2px;
          }
          .column-head { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-primary); font-weight: 700; border-bottom: 1px solid var(--color-border-light); padding-bottom: 8px; margin-bottom: 4px; }
          .architecture-grid { 
            flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
            scrollbar-width: thin; scrollbar-color: var(--color-primary) transparent;
            max-height: 350px;
          }
          .note-chip { 
            display: flex; align-items: center; gap: 8px; padding: 6px 12px; 
            font-size: 0.7rem; color: var(--color-text-muted); cursor: pointer; border-radius: 2px; transition: 0.2s;
            border: 1px solid transparent;
          }
          .note-chip:hover { background: var(--color-border-light); color: var(--color-text); }
          .note-chip.selected { background: var(--color-primary); color: #111; border-color: var(--color-primary); }
          .note-chip input { display: none; }

          .elite-btn-modern-variant {
            background: var(--color-primary); color: #111; border: none; padding: 8px 16px; border-radius: 2px;
            font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
            cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 8px;
          }
          .elite-btn-modern-variant:hover { background: var(--color-primary-light); transform: translateY(-1px); }

          @keyframes eliteFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes eliteSlideScale { from { opacity: 0; transform: scale(0.96) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          @keyframes eliteFadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes eliteSpin { to { transform: rotate(360deg); } }

          @media (max-width: 1024px) {
            .elite-modal { flex-direction: column; max-height: 95vh; overflow-y: auto; }
            .elite-sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--color-border); }
            .elite-nav { flex-direction: row; overflow-x: auto; padding: 8px; }
            .elite-sidebar-top, .elite-sidebar-footer { display: none; }
            .variant-grid { grid-template-columns: 1fr 1fr; }
            .scent-architecture-container { grid-template-columns: 1fr; }
          }
        `}</style>
      </div>
    </Modal>
  );
};

export default ProductModal;
