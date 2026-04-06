import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { Boxes, AlertCircle, History, Package, TrendingUp, TrendingDown, Clock, Search, Filter, Layers, Database } from 'lucide-react';
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
    <div className="elite-inventory-container animate-fade-in">
      <div className="atelier-header">
        <div className="header-titles">
          <h1 className="couture-text">Reservoir Management</h1>
          <p className="couture-subtext">Real-time monitoring of artisanal fragrance reserves</p>
        </div>
      </div>

      <div className="discovery-matrix">
        <div className="tab-glass-panel">
          <button 
            className={`tab-glass-btn ${activeTab === 'levels' ? 'active' : ''}`}
            onClick={() => setActiveTab('levels')}
          >
            <Layers size={18} /> Reserve Levels
          </button>
          <button 
            className={`tab-glass-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} /> Movement Archive
          </button>
        </div>

        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input"
            placeholder="Discovery via variant or size..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="atelier-stats-grid">
         <div className="elite-glass inventory-kpi">
           <div className="kpi-top">
             <Database size={20} color="var(--color-primary)" />
             <span className="kpi-label">Master Catalog SKUs</span>
           </div>
           <h3 className="kpi-value">{items.length}</h3>
         </div>
         <div className="elite-glass inventory-kpi error">
           <div className="kpi-top">
             <AlertCircle size={20} color="#e74c3c" />
             <span className="kpi-label">Depleted Reserves</span>
           </div>
           <h3 className="kpi-value">{items.filter(i => i.quantity <= i.lowStockThreshold).length}</h3>
         </div>
      </div>

      {activeTab === 'levels' ? (
        <div className="atelier-grid fade-in-blur">
          {filteredItems.map(item => {
            const isLow = item.quantity <= item.lowStockThreshold;
            return (
              <div key={item.id} className="elite-glass inventory-card">
                <div className="inventory-card-top">
                  <div className="variant-info">
                    <span className="variant-name">{item.variant?.product?.name}</span>
                    <span className="variant-size">{item.variant?.size}</span>
                  </div>
                  <span className={`status-indicator ${isLow ? 'error' : 'optimal'}`}>
                    {isLow ? 'CRITICAL' : 'OPTIMAL'}
                  </span>
                </div>

                <div className="inventory-metrics">
                  <div className="metric-glass">
                    <span className="metric-label">Residual Stock</span>
                    <span className="metric-value">{item.quantity} Units</span>
                  </div>
                  <div className="metric-glass">
                    <span className="metric-label">Low Threshold</span>
                    <span className="metric-value">{item.lowStockThreshold} Units</span>
                  </div>
                </div>

                <div className="inventory-footer">
                  <span className="supplier-tag">
                    <Landmark size={12} /> {item.variant?.product?.supplier?.name || 'In-House'}
                  </span>
                  <button className="btn-mini-action">
                    <History size={14} /> Audit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="atelier-grid fade-in-blur">
           {logs.map(log => (
            <div key={log.id} className="elite-glass movement-card">
              <div className="movement-header">
                <div className="movement-type">
                   {log.quantityChanged > 0 ? <TrendingUp size={18} color="#2ecc71" /> : <TrendingDown size={18} color="#e74c3c" />}
                   <span className={log.quantityChanged > 0 ? 'inc' : 'dec'}>
                     {log.quantityChanged > 0 ? '+' : ''}{log.quantityChanged} Units
                   </span>
                </div>
                <span className="movement-date">{DateTime.fromISO(log.createdAt).toFormat('dd LLL, HH:mm')}</span>
              </div>
              
              <div className="movement-variant">
                <span className="variant-name">{log.variant?.product?.name}</span>
                <span className="variant-size">{log.variant?.size}</span>
              </div>

              <div className="movement-reason">
                <span className="reason-label">Reason Code</span>
                <span className="reason-value">{log.reason}</span>
              </div>

              <div className="movement-ref">
                 <span className="ref-label">Treasury Ref</span>
                 <span className="ref-value">{log.referenceId ? `#${log.referenceId.split('-')[0].toUpperCase()}` : 'SYSTEM_ADJ'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-inventory-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }
        .atelier-header { margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }
        
        .discovery-matrix { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 24px; }
        
        .tab-glass-panel { background: rgba(255,255,255,0.03); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 4px; display: flex; gap: 4px; }
        .tab-glass-btn { background: none; border: none; color: var(--color-text-muted); padding: 8px 16px; border-radius: 2px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: var(--transition); }
        .tab-glass-btn.active { background: var(--color-primary); color: #000; }
        .tab-glass-btn:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }

        .search-glass-wrapper { position: relative; background: rgba(255,255,255,0.03); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px 16px; display: flex; align-items: center; flex: 1; max-width: 400px; }
        .search-glass-input { background: none; border: none; color: white; width: 100%; outline: none; margin-left: 12px; font-size: 0.85rem; }

        .atelier-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
        .inventory-kpi { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
        .inventory-kpi.error { border-color: rgba(231, 76, 60, 0.3); }
        .kpi-top { display: flex; align-items: center; gap: 12px; }
        .kpi-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); font-weight: 600; }
        .kpi-value { font-size: 2rem; font-weight: 700; color: white; font-family: var(--font-display); }

        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px; }
        
        .inventory-card { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .inventory-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .variant-info { display: flex; flex-direction: column; }
        .variant-name { font-weight: 700; font-size: 1.1rem; color: white; }
        .variant-size { font-size: 0.75rem; color: var(--color-primary); text-transform: uppercase; font-weight: 600; }
        
        .status-indicator { font-size: 0.6rem; padding: 3px 8px; border-radius: 2px; font-weight: 700; letter-spacing: 1px; }
        .status-indicator.optimal { background: rgba(39, 174, 96, 0.15); color: #2ecc71; }
        .status-indicator.error { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }

        .inventory-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .metric-glass { padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border-alt); border-radius: 4px; }
        .metric-label { display: block; font-size: 0.6rem; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px; }
        .metric-value { font-weight: 700; font-size: 0.95rem; color: white; }

        .inventory-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--color-border); }
        .supplier-tag { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px; }
        .btn-mini-action { background: none; border: none; color: white; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 600; }
        .btn-mini-action:hover { color: var(--color-primary); }

        .movement-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; border-left: 2px solid var(--color-border); }
        .movement-header { display: flex; justify-content: space-between; align-items: center; }
        .movement-type { display: flex; align-items: center; gap: 8px; }
        .movement-type span { font-weight: 800; font-size: 1.1rem; }
        .movement-type span.inc { color: #2ecc71; }
        .movement-type span.dec { color: #e74c3c; }
        .movement-date { font-size: 0.7rem; color: var(--color-text-muted); font-family: monospace; }
        
        .movement-variant { display: flex; flex-direction: column; padding: 10px 0; border-bottom: 1px solid var(--color-border-alt); }
        .movement-reason { display: flex; flex-direction: column; gap: 2px; }
        .reason-label { font-size: 0.6rem; text-transform: uppercase; color: var(--color-text-muted); }
        .reason-value { font-size: 0.85rem; font-weight: 500; }

        .movement-ref { margin-top: auto; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-primary); font-family: monospace; }
        .ref-label { color: var(--color-text-muted); font-family: var(--font-body); }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        .fade-in-blur { animation: eliteFadeIn 0.4s ease-out; }

        @media (max-width: 768px) {
          .discovery-matrix { flex-direction: column; align-items: stretch; }
          .atelier-stats-grid { grid-template-columns: 1fr; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
