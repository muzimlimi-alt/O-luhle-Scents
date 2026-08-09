import { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Plus, Ticket, Calendar, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';

export function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENT',
    value: '',
    expiryDate: '',
    usageLimit: '',
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await adminOpsApi.coupons.list();
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      setError('Could not load coupons. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.code.trim()) {
      setError('Coupon code is required.');
      return;
    }
    if (!formData.value || parseFloat(formData.value) <= 0) {
      setError('Please provide a valid discount value.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        value: parseFloat(formData.value),
        expiryDate: formData.expiryDate ? formData.expiryDate : null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
      };

      const newCoupon = await adminOpsApi.coupons.create(payload);
      setCoupons(prev => [newCoupon, ...prev]);
      setIsModalOpen(false);
      setFormData({
        code: '',
        discountType: 'PERCENT',
        value: '',
        expiryDate: '',
        usageLimit: '',
      });
      setSuccessMsg(`Coupon "${newCoupon.code}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to create coupon:', err);
      setError(err.message || 'Failed to create coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${code}"?`)) return;
    try {
      await adminOpsApi.coupons.delete(id);
      setCoupons(prev => prev.filter(c => c.id !== id));
      setSuccessMsg(`Coupon "${code}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to delete coupon:', err);
      setError(err.message || 'Failed to delete coupon.');
    }
  };

  const columns = [
    { key: 'code', label: 'Coupon Code', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-primary)' }}>
        <Ticket size={16} /> {val}
      </div>
    )},
    { key: 'discountType', label: 'Type', render: (val) => val === 'PERCENT' || val === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount' },
    { key: 'value', label: 'Discount', render: (val, row) => (row.discountType === 'PERCENT' || row.discountType === 'PERCENTAGE') ? `${val}%` : `R${val}` },
    { key: 'expiryDate', label: 'Expiry', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
        <Calendar size={14} /> {val ? new Date(val).toLocaleDateString() : 'Never'}
      </div>
    )},
    { key: 'usedCount', label: 'Usage', render: (val, row) => `${val || 0} / ${row.usageLimit || '∞'}` },
  ];

  return (
    <div className="coupons-page">
      <PageHeader
        icon={<Ticket size={22} />}
        title="Coupons & Discounts"
        subtitle="Promotional codes available at checkout."
        actions={(
          <button className="btn btn--primary" onClick={() => { setError(null); setIsModalOpen(true); }}>
            <Plus size={18} /> Create Coupon
          </button>
        )}
      />

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid var(--color-primary, #D4AF37)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} color="var(--color-primary, #D4AF37)" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && !isModalOpen && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <DataTable 
          columns={columns} 
          data={coupons} 
          loading={loading}
          actions={(row) => (
            <button 
              className="icon-btn danger" 
              onClick={() => handleDeleteCoupon(row.id, row.code)}
              title="Delete Coupon"
            >
              <Trash2 size={16} />
            </button>
          )}
        />
      </div>

      <Drawer isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Coupon" width={480}>
        {error && (
          <div style={{
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form className="admin-form" onSubmit={handleSubmit}>
          <FormField label="Coupon Code" required>
            <input 
              type="text" 
              placeholder="e.g. SUMMER2026" 
              value={formData.code} 
              onChange={(e) => handleChange('code', e.target.value)}
              required 
            />
          </FormField>
          <div className="form-grid-2">
            <FormField label="Type">
              <select 
                value={formData.discountType}
                onChange={(e) => handleChange('discountType', e.target.value)}
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (R)</option>
              </select>
            </FormField>
            <FormField label="Value" required>
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                placeholder="20" 
                value={formData.value} 
                onChange={(e) => handleChange('value', e.target.value)}
                required 
              />
            </FormField>
          </div>
          <div className="form-grid-2">
            <FormField label="Expiry Date">
              <input 
                type="date" 
                value={formData.expiryDate} 
                onChange={(e) => handleChange('expiryDate', e.target.value)}
              />
            </FormField>
            <FormField label="Usage Limit">
              <input 
                type="number" 
                min="1" 
                placeholder="100" 
                value={formData.usageLimit} 
                onChange={(e) => handleChange('usageLimit', e.target.value)}
              />
            </FormField>
          </div>
          <div className="form-actions" style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn btn--primary" style={{ flexGrow: 1 }} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Coupon'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
