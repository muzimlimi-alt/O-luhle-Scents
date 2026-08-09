import { useState } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { AppearancePanel } from '../components/AppearancePanel';
import {
  Palette,
  Monitor,
  Zap,
  CheckCircle,
  RotateCcw,
  Layout,
  Table
} from 'lucide-react';

export function Preferences() {
  const { prefs, updatePrefs, resetPrefs } = usePreferences();
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
        <p className="page-subtitle">Configure your personal TOCA management experience</p>
      </div>

      <div className="settings-container" style={{ maxWidth: '800px' }}>
        
        {/* Appearance */}
        <section className="card" style={{ marginBottom: '24px' }}>
          <h4 className="pref-title"><Palette size={18} /> Appearance</h4>
          <p className="pref-desc">Finish, house accent, and layout density — applies instantly and is remembered per administrator.</p>
          <AppearancePanel />
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
           <div className="pref-row" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <div>
                <span className="pref-label">Reduce Motion</span>
                <p className="pref-hint">Disable chart and panel animations, independent of your OS setting</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={prefs.reduceMotion} onChange={e => updatePrefs({ reduceMotion: e.target.checked })} />
                <span className="slider round"></span>
              </label>
           </div>
        </section>

        {/* Global Inventory Sync */}
        <section className="card" style={{ marginBottom: '24px' }}>
           <h4 className="pref-title"><Monitor size={18} /> Inventory Thresholds</h4>
           <div className="pref-row">
              <div>
                <span className="pref-label">Low-Stock Alerts</span>
                <p className="pref-hint">Show low-stock notifications on the Notifications page</p>
              </div>
              <label className="switch">
                <input type="checkbox" checked={prefs.lowStockAlertsEnabled} onChange={e => updatePrefs({ lowStockAlertsEnabled: e.target.checked })} />
                <span className="slider round"></span>
              </label>
           </div>
           <div className="pref-row" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
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
        .pref-title { display: flex; align-items: center; gap: var(--sp-2); margin: 0 0 var(--sp-2); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--y-base); font-weight: 400; }
        .pref-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: var(--sp-5); }
        .pref-row { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
        .pref-label { font-size: 0.95rem; font-weight: 500; display: block; margin-bottom: 2px; }
        .pref-hint { font-size: 0.75rem; color: var(--text-muted); margin: 0; }

        /* Switch logic */
        .switch { position: relative; display: inline-block; width: 48px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border-default); transition: all var(--t, .35s) var(--ease, ease); border-radius: var(--r-pill); }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: all var(--t, .35s) var(--ease, ease); border-radius: 50%; }
        input:checked + .slider { background-color: var(--y-base); }
        input:checked + .slider:before { transform: translateX(24px); }

        @media (max-width: 480px) {
          .pref-row { align-items: flex-start; }
        }
      `}} />
    </div>
  );
}
