import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Plus, Ticket, Calendar, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';

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
      <div className="content-header">
        <h2 className="page-title">Coupons & Discounts</h2>
        <button className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Create Coupon
        </button>
      </div>

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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Coupon">
        <form className="admin-form">
          <div className="form-group">
            <label>Coupon Code *</label>
            <input type="text" placeholder="e.g. SUMMER2026" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Type</label>
              <select>
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (R)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Value</label>
              <input type="number" placeholder="20" required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Expiry Date</label>
              <input type="date" />
            </div>
            <div className="form-group">
              <label>Usage Limit</label>
              <input type="number" placeholder="100" />
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn btn--primary" style={{ flexGrow: 1 }}>Save Coupon</button>
            <button type="button" className="btn btn--outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-form .form-group { margin-bottom: 16px; }
        .admin-form label { display: block; font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 6px; }
        .admin-form input, .admin-form select { 
          width: 100%; padding: 10px; background: var(--color-surface); border: 1px solid var(--color-border); 
          border-radius: 8px; color: var(--color-text); outline: none; 
        }
        .admin-form input:focus { border-color: var(--color-primary); }
      `}} />
    </div>
  );
}
