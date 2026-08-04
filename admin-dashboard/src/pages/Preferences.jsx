import React, { useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import {
  Palette, 
  Monitor, 
  Smartphone, 
  EyeOff, 
  Zap, 
  CheckCircle, 
  RotateCcw,
  Layout,
  Table
} from 'lucide-react';

export function Preferences() {
  const { prefs, updatePrefs, resetPrefs } = usePreferences();
  const { theme, toggleTheme } = useTheme();
  const [savedStatus, setSavedStatus] = useState(null);

  const handleUpdate = (updates) => {
    updatePrefs(updates);
    setSavedStatus('Preferences updated successfully');
    setTimeout(() => setSavedStatus(null), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Reset all administrative preferences to default?')) {
      resetPrefs();
      setSavedStatus('Reset to defaults successfully');
      setTimeout(() => setSavedStatus(null), 3000);
    }
  };

  return (
    <div className="preferences-page">
      <div className="content-header" style={{ marginBottom: '32px' }}>
        <h2 className="page-title">Administrative Preferences</h2>
        <p className="page-subtitle">Configure your personal O'luhle Scents management experience</p>
      </div>

      <div className="settings-container" style={{ maxWidth: '800px' }}>
        
        {/* Appearance */}
        <section className="card" style={{ marginBottom: '24px' }}>
          <h4 className="pref-title"><Palette size={18} /> Appearance</h4>
          <p className="pref-desc">Select your preferred visual aesthetic for the dashboard.</p>
          <div className="form-grid-2" style={{ marginTop: '20px' }}>
             <button
               className={`theme-card ${theme === 'dark' ? 'active' : ''}`}
               onClick={() => { if (theme !== 'dark') toggleTheme(); }}
             >
               <div className="theme-preview dark"></div>
               <span>Midnight (Dark)</span>
             </button>
             <button
               className={`theme-card ${theme === 'light' ? 'active' : ''}`}
               onClick={() => { if (theme !== 'light') toggleTheme(); }}
             >
               <div className="theme-preview light"></div>
               <span>Signature (Light)</span>
             </button>
          </div>
        </section>

        {/* Dashboard Behaviors */}
        <section className="card" style={{ marginBottom: '24px' }}>
           <h4 className="pref-title"><Layout size={18} /> Dashboard Configuration</h4>
           <div className="pref-row">
              <div>
                <span className="pref-label">Default Landing Module</span>
                <p className="pref-hint">Which operational sector opens upon administrative authentication</p>
              </div>
              <select 
                className="status-select" 
                value={prefs.defaultSection}
                onChange={e => updatePrefs({ defaultSection: e.target.value })}
              >
                <option value="overview">Overview</option>
                <option value="orders">Orders</option>
                <option value="products">Products</option>
              </select>
           </div>
           <div className="pref-row" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <div>
                <span className="pref-label">Auto-Refresh Interval</span>
                <p className="pref-hint">Automatically synchronize metrics across the global fulfillment engine</p>
              </div>
              <select 
                className="status-select" 
                value={prefs.autoRefresh}
                onChange={e => updatePrefs({ autoRefresh: e.target.value })}
              >
                <option value="off">Deactivated</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 1 minute</option>
                <option value="300">Every 5 minutes</option>
              </select>
           </div>
        </section>

        {/* Display Density */}
        <section className="card" style={{ marginBottom: '24px' }}>
           <h4 className="pref-title"><Table size={18} /> Display & Precision</h4>
           <div className="pref-row">
              <div>
                <span className="pref-label">Compact Administrative Tables</span>
                <p className="pref-hint">Minimize padding for high-density operational views</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={prefs.compactMode} onChange={e => updatePrefs({ compactMode: e.target.checked })} />
                <span className="slider round"></span>
              </label>
           </div>
           <div className="pref-row" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <div>
                <span className="pref-label">In-App Privacy Mode</span>
                <p className="pref-hint">Mask revenue datasets on the overview — hover to reveal sensitive metadata</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={prefs.privacyMode} onChange={e => updatePrefs({ privacyMode: e.target.checked })} />
                <span className="slider round"></span>
              </label>
           </div>
        </section>

        {/* Global Inventory Sync */}
        <section className="card" style={{ marginBottom: '24px' }}>
           <h4 className="pref-title"><Monitor size={18} /> Inventory Thresholds</h4>
           <div className="pref-row">
              <div>
                <span className="pref-label">Low Stock Alert Trigger</span>
                <p className="pref-hint">Trigger replenishment signals when inventory falls below this quantity</p>
              </div>
              <input 
                type="number" 
                className="status-select" 
                style={{ width: '80px', textAlign: 'center' }}
                value={prefs.lowStockThreshold}
                onChange={e => updatePrefs({ lowStockThreshold: parseInt(e.target.value) || 5 })}
              />
           </div>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
           <button className="btn btn--primary" onClick={() => handleUpdate({})}>
             <Zap size={18} /> Synchronize Preferences
           </button>
           <button className="btn btn--outline" onClick={handleReset}>
             <RotateCcw size={18} /> Reset to Defaults
           </button>
           {savedStatus && (
             <p style={{ margin: 0, color: 'var(--color-success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
               <CheckCircle size={14} /> {savedStatus}
             </p>
           )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .pref-title { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-primary); }
        .pref-desc { font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 24px; }
        .pref-row { display: flex; justify-content: space-between; align-items: center; }
        .pref-label { font-size: 0.95rem; font-weight: 500; display: block; margin-bottom: 2px; }
        .pref-hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 0; }
        
        .theme-card { background: var(--color-bg-alt); border: 2px solid var(--color-border); border-radius: 12px; padding: 12px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .theme-card:hover { border-color: var(--color-primary-light); }
        .theme-card.active { border-color: var(--color-primary); background: rgba(212,175,55,0.05); }
        .theme-preview { height: 60px; border-radius: 6px; margin-bottom: 8px; border: 1px solid var(--color-border-light); }
        .theme-preview.dark { background: #0f0e0c; }
        .theme-preview.light { background: #faf8f5; }
        
        /* Switch logic */
        .switch { position: relative; display: inline-block; width: 48px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-border); transition: .4s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--color-primary); }
        input:checked + .slider:before { transform: translateX(24px); }
      `}} />
    </div>
  );
}
