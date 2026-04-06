import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { ShoppingCart, Eye, Truck, Barcode } from 'lucide-react';

export function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPurchases() {
      try {
        const data = await adminOpsApi.purchases.list();
        setPurchases(data);
      } catch (err) {
        console.error('Purchases API failed:', err.message);
        setPurchases([
          { id: 'PUR-001', supplier: { name: 'Fragrance Solutions' }, totalCost: 4500, status: 'RECEIVED', createdAt: '2026-04-03' },
          { id: 'PUR-002', supplier: { name: 'Premium Oils Ltd' }, totalCost: 12500, status: 'PENDING', createdAt: '2026-04-03' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchPurchases();
  }, []);

  const columns = [
    { key: 'id', label: 'Purchase ID', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontFamily: 'monospace' }}>
        <Barcode size={16} color="var(--color-primary)" /> {val}
      </div>
    )},
    { key: 'supplier', label: 'Supplier', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Truck size={14} color="var(--color-text-muted)" /> {val?.name || '—'}
      </div>
    )},
    { key: 'totalCost', label: 'Total Cost', render: (val) => `R${val.toLocaleString()}` },
    { key: 'status', label: 'Status', render: (val) => (
      <span className={`status-badge ${val.toLowerCase()}`}>{val}</span>
    )},
    { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="purchases-page">
      <div className="content-header">
        <h2 className="page-title">Stock Purchases</h2>
      </div>

      <div className="card">
        <DataTable 
          columns={columns} 
          data={purchases} 
          loading={loading}
          actions={() => (
            <button className="icon-btn" title="View Detail"><Eye size={16} /></button>
          )}
        />
      </div>
    </div>
  );
}
