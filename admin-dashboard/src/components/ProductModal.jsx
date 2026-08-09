import { useState, useEffect, useRef } from 'react';
import {
  X, Plus, Trash2, GripVertical, AlertCircle, Loader2,
  Sparkles, Camera, ImagePlus,
  Package, Info, Layout, Boxes, Truck
} from 'lucide-react';
import { ReactSortable } from 'react-sortablejs';
import { adminOpsApi } from '../services/api';
import { Drawer } from './Drawer';
import { FormField } from './FormField';
import { useMessaging } from '../context/MessagingContext';

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
  brand: "TOCA",
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
  packagingCost: '',
  labellingCost: '',
  quantity: '0',
  sku: '',
  barcode: '',
  uom: 'ml',
  volume: '50',
  weightGrams: '',
  lowStockThreshold: '5'
};

const ProductModal = ({ isOpen, onClose, product = null, categories = [], suppliers = [], onSave }) => {
  const { showMessage } = useMessaging();
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
        brand: product.brand || "TOCA",
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
        packagingCost: v.packagingCost?.toString() || '',
        labellingCost: v.labellingCost?.toString() || '',
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
      showMessage('error', 'Add Supplier Failed', err.message);
    }
  };

  const removeAltSupplier = async (id) => {
    try {
      await adminOpsApi.productSuppliers.delete(id);
      setAltSuppliers(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      showMessage('error', 'Remove Supplier Failed', err.message);
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
        packagingCost: v.packagingCost === '' ? '0' : v.packagingCost,
        labellingCost: v.labellingCost === '' ? '0' : v.labellingCost,
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
    <Drawer isOpen={isOpen} onClose={onClose} raw>
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

                    <div className="span-full">
                      <FormField label="Fragrance Name" required>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={e => set('name', e.target.value.slice(0, 150))}
                          placeholder="e.g. Midnight Silk Oud"
                          required
                          maxLength={150}
                        />
                      </FormField>
                    </div>

                    <FormField label="House / Brand">
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={e => set('brand', e.target.value.slice(0, 100))}
                        placeholder="TOCA"
                        maxLength={100}
                      />
                    </FormField>

                    <FormField label="Card Badge">
                      <select value={formData.cardBadge} onChange={e => set('cardBadge', e.target.value)}>
                        <option value="">No Badge</option>
                        <option value="Bestseller">Bestseller</option>
                        <option value="New">New</option>
                        <option value="Popular">Popular</option>
                      </select>
                    </FormField>

                    <FormField label="Artisan Supplier">
                      <select
                        value={formData.supplierId}
                        onChange={e => set('supplierId', e.target.value)}
                      >
                        <option value="">Select Boutique Supplier...</option>
                        {suppliers.map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Visibility Status">
                      <select value={formData.status} onChange={e => set('status', e.target.value)}>
                        <option value="ACTIVE">Active — Public Display</option>
                        <option value="DRAFT">Draft — Not Yet Published</option>
                        <option value="ARCHIVED">Archived — Hidden</option>
                      </select>
                    </FormField>

                    <FormField label="Product Family">
                      <select value={formData.family} onChange={e => set('family', e.target.value)}>
                        {PRODUCT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </FormField>

                    <div className="span-full">
                      <FormField label="Description (Optional)">
                        <textarea
                          rows={3}
                          value={formData.description}
                          onChange={e => set('description', e.target.value)}
                          placeholder="Describe the sensory notes and inspiration behind this creation..."
                        />
                      </FormField>
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
                          <select aria-label="Add alternative supplier" value={newAltSupplier.supplierId} onChange={e => setNewAltSupplier(s => ({ ...s, supplierId: e.target.value }))}>
                            <option value="">Add supplier...</option>
                            {suppliers.filter(sup => sup.id !== formData.supplierId).map(sup => (
                              <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                          </select>
                          <input aria-label="Supplier SKU" type="text" placeholder="Supplier SKU" value={newAltSupplier.supplierSku} onChange={e => setNewAltSupplier(s => ({ ...s, supplierSku: e.target.value }))} />
                          <input aria-label="Lead time in days" type="number" placeholder="Lead days" value={newAltSupplier.leadTimeDays} onChange={e => setNewAltSupplier(s => ({ ...s, leadTimeDays: e.target.value }))} />
                          <input aria-label="Minimum order quantity" type="number" placeholder="MOQ" value={newAltSupplier.minOrderQty} onChange={e => setNewAltSupplier(s => ({ ...s, minOrderQty: e.target.value }))} />
                          <button type="button" className="elite-btn-modern-variant" onClick={addAltSupplier} aria-label="Add supplier"><Plus size={14} /></button>
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

                    <FormField label="Product Type">
                      <select value={formData.type} onChange={e => set('type', e.target.value)}>
                        {["Extrait de Parfum", "Parfum", "Eau de Parfum", "Eau de Toilette", "Eau de Cologne", "Eau Fraîche", "Eau de Senteur", "Splash & Aftershave"].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Oil Concentration" hint="Automatically set from Product Type">
                      <input type="text" value={formData.oilConcentration} readOnly className="read-only" />
                    </FormField>

                    <FormField label="Longevity Profile" hint="Automatically set from Product Type">
                      <input type="text" value={formData.longevity} readOnly className="read-only" />
                    </FormField>

                    <div className="elite-section-divider span-full">
                      <Layout size={14} /> <span>Sensory & Aromatic Architecture</span>
                    </div>

                    <FormField label="Category Hub" required>
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
                    </FormField>

                    <FormField label="Scent Family">
                      <select value={formData.scentFamily} onChange={e => set('scentFamily', e.target.value)}>
                        {["Aquatic", "Floral", "Woody", "Oriental", "Citrus", "Fruity", "Herbal"].map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </FormField>

                    <div className="span-full">
                      <FormField label="Classification Characteristic" hint="Automatically set from Scent Family">
                        <input type="text" value={formData.characteristic} readOnly className="read-only" />
                      </FormField>
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

                      <FormField label="Category Hub" required>
                        <select value={formData.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                          <option value="">Select Category...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </FormField>

                      {attributeDefs.filter(d => !d.appliesToVariant).map(def => (
                        <FormField label={`${def.label}${def.unit ? ` (${def.unit})` : ''}`} key={def.id}>
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
                        </FormField>
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
                          <FormField label="Designation / Size">
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
                          </FormField>
                          <FormField label="UOM (ml/mg/ea)">
                            <input type="text" value={v.uom} onChange={e => updateVariant(i, 'uom', e.target.value)} placeholder="ml" maxLength={20} />
                          </FormField>
                          <FormField label="Volume (Numerical)">
                            <input type="number" value={v.volume} onChange={e => updateVariant(i, 'volume', e.target.value)} readOnly={v.size !== 'Other'} className={v.size !== 'Other' ? 'read-only' : ''} />
                          </FormField>
                          <FormField label="Retail Price (R)">
                            <input type="number" step="0.01" value={v.price} onChange={e => updateVariant(i, 'price', e.target.value)} placeholder="1250" />
                          </FormField>
                          <FormField label="Cost Price (R)">
                            <input type="number" step="0.01" value={v.costPrice} onChange={e => updateVariant(i, 'costPrice', e.target.value)} placeholder="450" />
                          </FormField>
                          <FormField label="Packaging Cost (R)">
                            <input type="number" step="0.01" value={v.packagingCost} onChange={e => updateVariant(i, 'packagingCost', e.target.value)} placeholder="15" />
                          </FormField>
                          <FormField label="Labelling Cost (R)">
                            <input type="number" step="0.01" value={v.labellingCost} onChange={e => updateVariant(i, 'labellingCost', e.target.value)} placeholder="5" />
                          </FormField>
                          <FormField label="Current Stock">
                            <input type="number" value={v.quantity} onChange={e => updateVariant(i, 'quantity', e.target.value)} placeholder="10" />
                          </FormField>
                          <FormField label="SKU Registry">
                            <input type="text" value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} placeholder="PRD-50-UD" />
                          </FormField>
                          <FormField label="Low Stock Alert">
                            <input type="number" value={v.lowStockThreshold} onChange={e => updateVariant(i, 'lowStockThreshold', e.target.value)} placeholder="5" />
                          </FormField>
                          <FormField label="Weight (g)">
                            <input type="number" value={v.weightGrams} onChange={e => updateVariant(i, 'weightGrams', e.target.value)} placeholder="150" />
                          </FormField>
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
            display: flex; width: 1100px; max-width: 92vw; height: 100%;
            background: var(--bg-section);
            border-left: 1px solid var(--border-default);
            overflow: hidden;
            box-shadow: var(--sh-xl, -8px 0 30px rgba(0,0,0,.3));
            animation: eliteDrawerSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          }
          @media (prefers-reduced-motion: reduce) {
            .elite-modal { animation-duration: 0.01s; }
          }

          /* ── Sidebar ── */
          .elite-sidebar {
            width: 260px; background: var(--bg-page);
            border-right: 1px solid var(--border-default);
            display: flex; flex-direction: column;
            flex-shrink: 0;
          }
          .elite-sidebar-top { padding: var(--sp-6) var(--sp-5); text-align: center; }
          .elite-emblem {
            width: 80px; height: 80px; margin: 0 auto var(--sp-4);
            border-radius: var(--r); border: 1px solid var(--border-default);
            display: flex; align-items: center; justify-content: center;
            color: var(--y-base); background: var(--bg-elevated);
            overflow: hidden;
          }
          .elite-emblem-img { width: 100%; height: 100%; object-fit: cover; }
          .elite-status-badge {
            display: inline-flex; align-items: center; gap: var(--sp-2);
            padding: 6px var(--sp-3); border-radius: var(--r-pill);
            background: var(--bg-surface); border: 1px solid var(--border-low);
            font-size: .65rem; color: var(--text-muted); letter-spacing: .05em;
          }
          .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border-default); }
          .status-dot.active { background: var(--y-base); box-shadow: 0 0 8px var(--y-glow); }

          .elite-nav { flex: 1; padding: var(--sp-3); display: flex; flex-direction: column; gap: 4px; }
          .elite-nav-item {
            display: flex; align-items: center; gap: var(--sp-3);
            min-height: var(--tap); padding: 0 var(--sp-4); border-radius: var(--r); border-left: 2px solid transparent;
            background: transparent; color: var(--text-muted);
            font-size: .72rem; letter-spacing: .1em; text-transform: uppercase;
            cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease); text-align: left;
          }
          .elite-nav-item:hover { color: var(--text-primary); background: var(--bg-elevated); }
          .elite-nav-item.active { color: var(--y-base); background: linear-gradient(90deg, rgba(var(--y-rgb), .15), transparent 70%); border-left-color: var(--y-base); }

          .elite-sidebar-footer { padding: var(--sp-5); border-top: 1px solid var(--border-low); }
          .elite-id-label { font-size: .5rem; letter-spacing: .2em; color: var(--y-base); opacity: 0.7; margin-bottom: 4px; }
          .elite-id-value { font-family: var(--f-mono); font-size: .7rem; color: var(--text-muted); }

          /* ── Workspace ── */
          .elite-workspace { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; }
          .elite-header {
            padding: var(--sp-5) var(--sp-6);
            border-bottom: 1px solid var(--border-default);
            display: flex; align-items: flex-start; justify-content: space-between;
          }
          .elite-eyebrow { font-size: .58rem; letter-spacing: .25em; text-transform: uppercase; color: var(--y-base); opacity: 0.75; display: block; margin-bottom: 4px; }
          .elite-header-title h2 { font-size: 1.4rem; font-weight: 400; letter-spacing: .08em; color: var(--text-primary); margin: 0; text-transform: uppercase; }
          .elite-close-btn {
            width: var(--tap); height: var(--tap); border-radius: var(--r); background: none;
            border: 1px solid var(--border-default); color: var(--text-secondary);
            display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease);
          }
          .elite-close-btn:hover { border-color: var(--y-base); color: var(--y-base); }

          .form-input.read-only { background: var(--bg-section); cursor: not-allowed; color: var(--text-muted); }

          .alt-supplier-list { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-3); }
          .alt-supplier-row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3); background: var(--bg-surface); border: 1px solid var(--border-low); border-radius: var(--r); font-size: .78rem; color: var(--text-secondary); }
          .alt-supplier-name { color: var(--text-primary); flex-shrink: 0; }
          .alt-supplier-meta { color: var(--text-muted); font-size: .72rem; }
          .alt-supplier-remove { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; }
          .alt-supplier-remove:hover { color: var(--error); }
          .alt-supplier-empty { font-size: .78rem; color: var(--text-muted); font-style: italic; }
          .alt-supplier-add { display: grid; grid-template-columns: 2fr 1fr 90px 90px 40px; gap: var(--sp-2); }
          .alt-supplier-add select, .alt-supplier-add input {
            background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r);
            padding: var(--sp-2) var(--sp-3); color: var(--text-primary); font-size: .78rem;
          }

          .aromatic-notes-section { margin-top: var(--sp-6); display: flex; flex-direction: column; gap: var(--sp-7, 48px); }
          .note-group { display: flex; flex-direction: column; gap: var(--sp-3); }

          .elite-error {
            display: flex; align-items: center; gap: var(--sp-3); margin: var(--sp-6) var(--sp-6) 0;
            padding: var(--sp-3) var(--sp-4); border-radius: var(--r); font-size: .82rem;
            background: rgba(var(--bad-rgb), .09); color: var(--error);
            border: 1px solid rgba(var(--bad-rgb), .4);
          }

          .elite-main-form { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
          .elite-scroll-area { flex: 1; overflow-y: auto; padding: var(--sp-6); scrollbar-width: thin; scrollbar-color: rgba(var(--y-rgb),0.2) transparent; }
          .elite-scroll-area::-webkit-scrollbar { width: 5px; }
          .elite-scroll-area::-webkit-scrollbar-thumb { background: rgba(var(--y-rgb),0.2); }

          .elite-fade-in { animation: eliteFadeSlide 0.4s ease-out; }

          .elite-section-divider {
            display: flex; align-items: center; gap: var(--sp-3);
            margin: var(--sp-6) 0 var(--sp-4); padding: 0 4px;
          }
          .elite-section-divider span {
            font-size: .68rem; font-weight: 400; color: var(--y-base);
            text-transform: uppercase; letter-spacing: .18em;
          }
          .elite-section-divider::after {
            content: ''; flex: 1; height: 1px;
            background: linear-gradient(to right, rgba(var(--y-rgb), 0.25), transparent);
          }

          /* ── Grid & Inputs ── */
          .elite-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-5); }
          .elite-grid .form-field { margin-bottom: 0; }
          .field-group { display: flex; flex-direction: column; gap: var(--sp-2); }
          .field-group.span-full { grid-column: 1 / -1; }

          /* ── Images ── */
          .elite-asset-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-6); }
          .elite-asset-header h3 { font-size: .65rem; letter-spacing: .25em; text-transform: uppercase; color: var(--y-base); margin: 0; }
          .elite-asset-header p { font-size: .72rem; color: var(--text-muted); margin: 4px 0 0; }

          .elite-uploader { padding: 4px; }
          .elite-image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--sp-4); align-items: start; }
          .elite-asset-item { display: flex; flex-direction: column; gap: 6px; }
          .asset-alt-input {
            width: 100%; font-size: .65rem; padding: 5px var(--sp-2); background: var(--bg-surface);
            border: 1px solid var(--border-default); border-radius: var(--r); color: var(--text-primary); outline: none;
          }
          .asset-alt-input:focus { border-color: var(--y-base); }
          .asset-alt-pending { font-size: .6rem; color: var(--text-muted); font-style: italic; text-align: center; }
          .elite-add-asset { align-self: start; }
          .elite-asset-card {
            position: relative; aspect-ratio: 1; border-radius: var(--r); border: 1px solid var(--border-default);
            background: var(--bg-page); overflow: hidden;
          }
          .elite-asset-card img { width: 100%; height: 100%; object-fit: cover; }
          .primary-tag {
            position: absolute; top: 0; left: 0; right: 0; background: var(--y-base); color: var(--text-inverse);
            font-size: .5rem; font-weight: 500; text-align: center; padding: 4px; letter-spacing: .1em; z-index: 2;
          }
          .asset-overlay {
            position: absolute; inset: 0; background: rgba(0,0,0,0.6);
            display: flex; align-items: center; justify-content: center; gap: var(--sp-3);
            opacity: 0; transition: opacity 0.25s;
          }
          .elite-asset-card:hover .asset-overlay { opacity: 1; }
          .drag-trigger { color: #fff; cursor: grab; padding: var(--sp-2); }
          .asset-del { background: rgba(var(--bad-rgb),.8); border: none; color: #fff; padding: var(--sp-2); border-radius: var(--r); cursor: pointer; }

          .elite-add-asset {
            aspect-ratio: 1; border: 1.5px dashed rgba(var(--y-rgb),0.3); background: transparent;
            border-radius: var(--r); display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: var(--sp-3); color: rgba(var(--y-rgb),0.6); cursor: pointer; transition: all 0.3s;
          }
          .elite-add-asset:hover { border-color: var(--y-base); background: rgba(var(--y-rgb),0.05); color: var(--y-base); }
          .elite-add-asset span { font-size: .6rem; letter-spacing: .2em; text-transform: uppercase; }

          /* ── Inventory ── */
          .elite-variant-list { display: flex; flex-direction: column; gap: var(--sp-7, 48px); }
          .elite-variant-item { border: 1px solid var(--border-default); padding: var(--sp-5); border-radius: var(--r); background: var(--bg-surface); }
          .variant-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-4); }
          .variant-label { font-size: .58rem; letter-spacing: .22em; color: var(--y-base); font-weight: 400; opacity: 0.8; }
          .variant-del { background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s; }
          .variant-del:hover { color: var(--error); }
          .variant-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); }
          .variant-grid .field { display: flex; flex-direction: column; gap: var(--sp-2); }
          .variant-grid label { font-size: .58rem; letter-spacing: .14em; text-transform: uppercase; color: var(--text-muted); }
          .variant-grid input, .variant-grid select {
            background: var(--bg-elevated); border: 1px solid var(--border-default);
            padding: 0 var(--sp-3); height: var(--tap); border-radius: var(--r); color: var(--text-primary); font-size: .8rem; outline: none; transition: border-color var(--t-fast, .18s) var(--ease, ease);
          }
          .variant-grid input:focus, .variant-grid select:focus { border-color: var(--y-base); }
          .input-with-icon { position: relative; }
          .input-with-icon input { width: 100%; }

          /* ── Footer ── */
          .elite-actions {
            padding: var(--sp-5) var(--sp-6); background: var(--bg-page); border-top: 1px solid var(--border-low);
            display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-4);
          }
          .elite-btn-cancel { background: transparent; border: none; color: var(--text-muted); font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; transition: color var(--t-fast, .18s) var(--ease, ease); }
          .elite-btn-cancel:hover { color: var(--text-primary); }
          .elite-btn-save {
            background: var(--y-base); color: var(--text-inverse); border: none; padding: 0 var(--sp-6); min-height: var(--tap); border-radius: var(--r);
            font-size: .78rem; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
            cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease); display: flex; align-items: center; gap: var(--sp-3);
            box-shadow: var(--sh-md);
          }
          .elite-btn-save:hover:not(:disabled) { background: var(--y-hover); transform: translateY(-2px); box-shadow: 0 6px 22px rgba(var(--y-rgb),.3); }
          .elite-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

          .elite-nav-item:focus-visible,
          .elite-close-btn:focus-visible,
          .elite-btn-cancel:focus-visible,
          .elite-btn-save:focus-visible,
          .elite-btn-modern-variant:focus-visible,
          .variant-del:focus-visible,
          .asset-del:focus-visible,
          .elite-add-asset:focus-visible,
          .note-chip:focus-within {
            outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus));
          }
          .spin { animation: eliteSpin 1s linear infinite; }

          /* New Search & Note Styling */
          .note-search-wrapper { margin-top: var(--sp-2); }
          .note-search-input {
            width: 100%; background: var(--bg-elevated); border: 1px solid var(--border-default);
            padding: 0 var(--sp-4); height: var(--tap); border-radius: var(--r); color: var(--text-primary); font-size: .8rem; outline: none; transition: all var(--t-fast, .18s) var(--ease, ease);
          }
          .note-search-input:focus { border-color: var(--y-base); }

          .scent-architecture-container {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4);
            margin-top: var(--sp-6); min-height: 400px;
          }
          .architecture-column {
            display: flex; flex-direction: column; gap: var(--sp-3);
            background: var(--bg-surface); border: 1px solid var(--border-default);
            padding: var(--sp-4); border-radius: var(--r);
          }
          .column-head { font-size: .62rem; letter-spacing: .2em; text-transform: uppercase; color: var(--y-base); font-weight: 400; border-bottom: 1px solid var(--border-low); padding-bottom: var(--sp-2); margin-bottom: 4px; }
          .architecture-grid {
            flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
            scrollbar-width: thin; scrollbar-color: var(--y-base) transparent;
            max-height: 350px;
          }
          .note-chip {
            display: flex; align-items: center; gap: var(--sp-2); padding: 6px var(--sp-3);
            font-size: .7rem; color: var(--text-muted); cursor: pointer; border-radius: var(--r); transition: 0.2s;
            border: 1px solid transparent;
          }
          .note-chip:hover { background: var(--bg-elevated); color: var(--text-primary); }
          .note-chip.selected { background: var(--y-base); color: var(--text-inverse); border-color: var(--y-base); }
          .note-chip input { display: none; }

          .elite-btn-modern-variant {
            background: var(--y-base); color: var(--text-inverse); border: none; padding: 0 var(--sp-4); min-height: 36px; border-radius: var(--r);
            font-size: .68rem; font-weight: 500; letter-spacing: .08em; text-transform: uppercase;
            cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease); display: flex; align-items: center; gap: var(--sp-2);
          }
          .elite-btn-modern-variant:hover { background: var(--y-hover); transform: translateY(-1px); }

          @keyframes eliteFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes eliteDrawerSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes eliteFadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes eliteSpin { to { transform: rotate(360deg); } }

          @media (max-width: 1024px) {
            .elite-modal { flex-direction: column; overflow-y: auto; width: 100vw; max-width: 100vw; }
            .elite-sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--border-default); }
            .elite-nav { flex-direction: row; overflow-x: auto; padding: var(--sp-2); }
            .elite-sidebar-top, .elite-sidebar-footer { display: none; }
            .variant-grid { grid-template-columns: 1fr 1fr; }
            .scent-architecture-container { grid-template-columns: 1fr; }
          }

          @media (max-width: 640px) {
            .elite-header { padding: var(--sp-4) var(--sp-5); }
            .elite-eyebrow { display: none; }
            .elite-header-title h2 { font-size: 1.1rem; }
            .elite-close-btn { width: var(--tap); height: var(--tap); }
            .elite-scroll-area { padding: var(--sp-4); }
            .elite-grid { grid-template-columns: 1fr; gap: var(--sp-4); }
            .alt-supplier-add { grid-template-columns: 1fr; }
            .alt-supplier-row { flex-wrap: wrap; row-gap: 6px; }
            .variant-grid { grid-template-columns: 1fr; gap: var(--sp-4); }
            .elite-variant-item { padding: var(--sp-4); }
            .elite-actions { padding: var(--sp-4) var(--sp-5); flex-direction: column-reverse; gap: var(--sp-3); }
            .elite-btn-cancel { width: 100%; padding: var(--sp-3); text-align: center; }
            .elite-btn-save { width: 100%; justify-content: center; padding: var(--sp-4) var(--sp-5); }
            .elite-nav-item { padding: 0 var(--sp-3); font-size: .68rem; white-space: nowrap; }
          }
        `}</style>
      </div>
    </Drawer>
  );
};

export default ProductModal;
