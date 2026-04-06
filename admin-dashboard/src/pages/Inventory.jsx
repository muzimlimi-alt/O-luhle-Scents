import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { Boxes, AlertCircle, History, Package, TrendingUp, TrendingDown, Clock, Search } from 'lucide-react';
import { DateTime } from 'luxon';

export function Inventory() {
  const [activeTab, setActiveTab] = useState('levels');
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [invData, logData] = await Promise.all([
          adminOpsApi.inventory.list(),
          adminOpsApi.inventory.logs()
        ]);
        setItems(invData);
        setLogs(logData);
      } catch (err) {
        console.error('Failed to fetch inventory data:', err);
      }
    }
    fetchData();
  }, []);

  const filteredItems = items.filter(item => 
    item.variant?.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.variant?.size?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="inventory-page">
      <div className="content-header">
        <h2 className="page-title">Luxury Reservoir Management</h2>
        <p className="page-subtitle">Real-time stock monitoring and historical movement tracking</p>
      </div>

      <div className="tab-container cards-stack" style={{ marginBottom: '24px' }}>
        <button 
          className={`tab-btn ${activeTab === 'levels' ? 'active' : ''}`}
          onClick={() => setActiveTab('levels')}
        >
          <Package size={18} /> Current Levels
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} /> Movement History
        </button>
      </div>

      {activeTab === 'levels' ? (
        <div className="inventory-levels-view animate-fade-in">
          <div className="inventory-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
             <div className="kpi-card">
               <p className="kpi-label">Total SKUs</p>
               <h3 className="kpi-value">{items.length}</h3>
             </div>
             <div className="kpi-card" style={{ borderColor: 'var(--color-error)' }}>
               <p className="kpi-label">Low Stock</p>
               <h3 className="kpi-value" style={{ color: 'var(--color-error-text)' }}>
                 {items.filter(i => i.quantity <= i.lowStockThreshold).length}
               </h3>
             </div>
          </div>

          <div className="card">
            <div className="search-bar" style={{ padding: '16px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Search size={18} color="var(--color-text-muted)" />
              <input 
                type="text" 
                placeholder="Search variants..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none' }}
              />
            </div>
            <div className="table-responsive">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Supplier</th>
                    <th>Current Level</th>
                    <th>Threshold</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const isLow = item.quantity <= item.lowStockThreshold;
                    return (
                      <tr key={item.id}>
                        <td>
                          <p style={{ fontWeight: 600 }}>{item.variant?.product?.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.variant?.size}</p>
                        </td>
                        <td>{item.variant?.product?.supplier?.name || '-'}</td>
                        <td style={{ fontWeight: 700 }}>{item.quantity} units</td>
                        <td>{item.lowStockThreshold}</td>
                        <td>
                          <span className={`status-badge ${isLow ? 'status--error' : 'status--paid'}`}>
                            {isLow ? <AlertCircle size={12} /> : null}
                            {isLow ? 'REPLENISH' : 'OPTIMAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="inventory-history-view animate-fade-in">
          <div className="card">
            <div className="table-responsive">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Variant</th>
                    <th>Movement</th>
                    <th>Reason</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.85rem' }}>
                        {DateTime.fromISO(log.createdAt).toFormat('dd LLL, HH:mm')}
                      </td>
                      <td>
                        <p style={{ fontWeight: 600 }}>{log.variant?.product?.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{log.variant?.size}</p>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: log.quantityChanged > 0 ? 'var(--color-success-text)' : 'var(--color-error-text)' }}>
                          {log.quantityChanged > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {log.quantityChanged > 0 ? '+' : ''}{log.quantityChanged} units
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{log.reason}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                         {log.referenceId ? `#${log.referenceId.split('-')[0].toUpperCase()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .tab-container {
          display: flex;
          background: #fff;
          padding: 4px;
          border-radius: 12px;
          box-shadow: var(--shadow-sm);
          width: fit-content;
          border: 1px solid var(--color-border-light);
        }
        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          border-radius: 8px;
          border: none;
          background: transparent;
          font-weight: 600;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          color: var(--color-primary);
        }
        .tab-btn.active {
          background: var(--color-primary);
          color: #000;
          box-shadow: var(--shadow-sm);
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
