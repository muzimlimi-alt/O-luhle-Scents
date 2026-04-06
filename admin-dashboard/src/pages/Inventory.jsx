import React, { useState, useEffect } from 'react';
import { metricsApi, adminOpsApi } from '../services/api';
import { Boxes, AlertCircle, TrendingDown, Edit3, Mail } from 'lucide-react';

export function Inventory() {
  const [items, setItems] = useState([]);
  const [sendingAlert, setSendingAlert] = useState(null);


  useEffect(() => {
    async function fetchInventory() {
      try {
        const data = await metricsApi.lowStock(20); // threshold
        setItems(data);
      } catch (err) {
        console.warn('Inventory API failed:', err.message);
      }
    }

    fetchInventory();
  }, []);

  const handleRestockAlert = async (variantId) => {
    setSendingAlert(variantId);
    try {
      const res = await adminOpsApi.suppliers.sendRestockAlert(variantId);
      alert(`Restock alert successfully sent to ${res.supplier}`);
    } catch (err) {
      alert(`Failed to send alert: ${err.message}`);
    } finally {
      setSendingAlert(null);
    }
  };

  return (
    <div className="inventory-page">
      <div className="content-header">
        <h2 className="page-title">Luxury Reservoir Management</h2>
        <p className="page-subtitle">Track and replenish fragrance formulations across global distribution centers</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderColor: 'var(--color-error)' }}>
           <p className="kpi-label">Critically Low</p>
           <h3 className="kpi-value" style={{ color: 'var(--color-error-text)' }}>{items.filter(i => i.quantity < (i.lowStockThreshold || 5)).length} Variants</h3>
        </div>
        <div className="kpi-card">
           <p className="kpi-label">Primary Partners</p>
           <h3 className="kpi-value">Global Grasse, Ltd.</h3>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Fragrance Variant</th>
                <th>Supplier Partner</th>
                <th>Current Level</th>
                <th>Threshold</th>
                <th>Fulfillment Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const threshold = item.lowStockThreshold || 5;
                const isLow = item.quantity < threshold;
                const supplier = item.variant?.product?.supplier;

                return (
                  <tr key={item.variantId}>
                    <td>
                      <p style={{ fontWeight: 600 }}>{item.variant?.product?.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Size: {item.variant?.size}</p>
                    </td>
                    <td>
                      {supplier ? (
                        <div>
                          <p style={{ fontWeight: 500, fontSize: '0.85rem' }}>{supplier.name}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{supplier.contactEmail}</p>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-error-text)' }}>No Supplier Linked</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: isLow ? 'var(--color-error-text)' : 'inherit' }}>
                      {item.quantity} UNITS
                    </td>
                    <td>{threshold}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="icon-btn" title="Quick Adjust Stock" style={{ color: 'var(--color-primary)' }}><Edit3 size={16} /></button>
                        {isLow && supplier && (
                          <button 
                            className="btn btn--secondary btn--sm" 
                            disabled={sendingAlert === item.variantId}
                            onClick={() => handleRestockAlert(item.variantId)}
                            style={{ padding: '6px 12px', fontSize: '0.7rem' }}
                          >
                            <Mail size={12} /> {sendingAlert === item.variantId ? 'Signaling...' : 'Signal Restock'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

