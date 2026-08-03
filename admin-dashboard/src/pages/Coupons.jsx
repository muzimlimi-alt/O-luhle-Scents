import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Plus, Ticket, Calendar, Trash2 } from 'lucide-react';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';

export function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchCoupons() {
      try {
        const data = await adminOpsApi.coupons.list();
        setCoupons(data);
      } catch (err) {
        console.error('Failed to fetch coupons:', err);
        // Mock data
        setCoupons([
          { id: '1', code: 'WELCOME20', discountType: 'PERCENT', value: 20, expiryDate: '2026-12-31', usedCount: 52, usageLimit: 100 },
          { id: '2', code: 'SAVE100', discountType: 'FIXED', value: 100, expiryDate: '2026-06-30', usedCount: 12, usageLimit: 50 },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchCoupons();
  }, []);

  const columns = [
    { key: 'code', label: 'Coupon Code', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--color-primary)' }}>
        <Ticket size={16} /> {val}
      </div>
    )},
    { key: 'discountType', label: 'Type' },
    { key: 'value', label: 'Discount', render: (val, row) => row.discountType === 'PERCENT' ? `${val}%` : `R${val}` },
    { key: 'expiryDate', label: 'Expiry', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
        <Calendar size={14} /> {val ? new Date(val).toLocaleDateString() : 'Never'}
      </div>
    )},
    { key: 'usedCount', label: 'Usage', render: (val, row) => `${val} / ${row.usageLimit || '∞'}` },
  ];

  return (
    <div className="coupons-page">
      <PageHeader
        icon={<Ticket size={22} />}
        title="Coupons & Discounts"
        subtitle="Promotional codes available at checkout."
        actions={(
          <button className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Create Coupon
          </button>
        )}
      />

      <div className="card">
        <DataTable 
          columns={columns} 
          data={coupons} 
          loading={loading}
          actions={() => (
            <button className="icon-btn danger"><Trash2 size={16} /></button>
          )}
        />

      </div>

      <Drawer isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Coupon" width={480}>
        <form className="admin-form">
          <FormField label="Coupon Code" required>
            <input type="text" placeholder="e.g. SUMMER2026" required />
          </FormField>
          <div className="form-grid-2">
            <FormField label="Type">
              <select>
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (R)</option>
              </select>
            </FormField>
            <FormField label="Value">
              <input type="number" placeholder="20" required />
            </FormField>
          </div>
          <div className="form-grid-2">
            <FormField label="Expiry Date">
              <input type="date" />
            </FormField>
            <FormField label="Usage Limit">
              <input type="number" placeholder="100" />
            </FormField>
          </div>
          <div className="form-actions" style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn btn--primary" style={{ flexGrow: 1 }}>Save Coupon</button>
            <button type="button" className="btn btn--outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
