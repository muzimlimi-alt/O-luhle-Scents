import React, { useState, useEffect } from 'react';
import { settingsApi } from '../services/api';
import { 
  Save, 
  RefreshCw, 
  Phone, 
  Mail, 
  MapPin, 
  Server, 
  CreditCard, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Loader2
} from 'lucide-react';

export function Config() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.list();
      // Flatten the grouped data for the form
      const flat = {};
      Object.keys(data).forEach(group => {
        data[group].forEach(s => {
          flat[s.key] = { value: s.value, group: s.group };
        });
      });
      setSettings(flat);
    } catch (err) {
      console.error('[Config Fetch]', err);
      setMessage({ type: 'error', text: 'Failed to synchronize system configuration.' });
    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = Object.keys(settings).map(key => ({
        key,
        value: settings[key].value,
        group: settings[key].group
      }));
      
      await settingsApi.update(payload);
      setMessage({ type: 'success', text: 'Global configuration synchronized successfully.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-center h-full">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="mt-4 text-muted">Refreshing system state...</p>
      </div>
    );
  }

  return (
    <div className="config-container animate-fade-in">
      <div className="content-header">
        <div>
          <h2 className="page-title">System Orchestration</h2>
          <p className="page-subtext">Configure critical business logic and fulfillment parameters.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn btn--primary"
        >
          {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
          Commit Changes
        </button>
      </div>

      {message && (
        <div className={`alert alert--${message.type === 'error' ? 'danger' : 'success'} mb-6`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="config-grid">
        {/* Business Identity */}
        <div className="card config-card">
          <div className="card-header">
            <ShieldCheck className="text-primary" size={20} />
            <h3 className="card-title">Business Identity</h3>
          </div>
          <div className="card-body">
            <div className="input-group">
              <label className="input-label"><Phone size={14} className="mr-2" /> WhatsApp Number</label>
              <input 
                type="text" 
                className="input-field" 
                value={settings['business_whatsapp']?.value || ''} 
                onChange={e => handleChange('business_whatsapp', e.target.value)}
                placeholder="+27..."
              />
            </div>
            <div className="input-group">
              <label className="input-label"><Mail size={14} className="mr-2" /> Support Email</label>
              <input 
                type="email" 
                className="input-field" 
                value={settings['business_email']?.value || ''} 
                onChange={e => handleChange('business_email', e.target.value)}
                placeholder="info@oluhlescents.co.za"
              />
            </div>
            <div className="input-group">
              <label className="input-label"><MapPin size={14} className="mr-2" /> Physical Address</label>
              <textarea 
                className="input-field" 
                rows="3"
                value={settings['business_address']?.value || ''} 
                onChange={e => handleChange('business_address', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Transactional Engine (SMTP) */}
        <div className="card config-card">
          <div className="card-header">
            <Server className="text-primary" size={20} />
            <h3 className="card-title">Email Fulfillment (SMTP)</h3>
          </div>
          <div className="card-body">
            <div className="input-row">
              <div className="input-group flex-2">
                <label className="input-label">SMTP Host</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={settings['smtp_host']?.value || ''} 
                  onChange={e => handleChange('smtp_host', e.target.value)}
                />
              </div>
              <div className="input-group flex-1">
                <label className="input-label">Port</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={settings['smtp_port']?.value || '587'} 
                  onChange={e => handleChange('smtp_port', e.target.value)}
                />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input 
                type="text" 
                className="input-field" 
                value={settings['smtp_user']?.value || ''} 
                onChange={e => handleChange('smtp_user', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={settings['smtp_pass']?.value || ''} 
                onChange={e => handleChange('smtp_pass', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Financial Orchestration */}
        <div className="card config-card">
          <div className="card-header">
            <CreditCard className="text-primary" size={20} />
            <h3 className="card-title">Banking & Settlement</h3>
          </div>
          <div className="card-body">
            <div className="input-group">
              <label className="input-label">Bank Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={settings['bank_name']?.value || ''} 
                onChange={e => handleChange('bank_name', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Account Holder</label>
              <input 
                type="text" 
                className="input-field" 
                value={settings['bank_holder']?.value || ''} 
                onChange={e => handleChange('bank_holder', e.target.value)}
              />
            </div>
            <div className="input-row">
              <div className="input-group flex-2">
                <label className="input-label">Account Number</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={settings['bank_account']?.value || ''} 
                  onChange={e => handleChange('bank_account', e.target.value)}
                />
              </div>
              <div className="input-group flex-1">
                <label className="input-label">Branch Code</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={settings['bank_branch']?.value || ''} 
                  onChange={e => handleChange('bank_branch', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Parameters */}
        <div className="card config-card">
          <div className="card-header">
            <RefreshCw className="text-primary" size={20} />
            <h3 className="card-title">Thresholds & Limits</h3>
          </div>
          <div className="card-body">
            <div className="input-group">
              <label className="input-label">Low Stock Threshold</label>
              <input 
                type="number" 
                className="input-field" 
                value={settings['low_stock_limit']?.value || '5'} 
                onChange={e => handleChange('low_stock_limit', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Free Shipping Limit (R)</label>
              <input 
                type="number" 
                className="input-field" 
                value={settings['free_shipping_min']?.value || '1500'} 
                onChange={e => handleChange('free_shipping_min', e.target.value)}
              />
            </div>
            <div className="info-box mt-4">
              <AlertCircle size={14} className="mr-2" />
              <span>These parameters affect the storefront globally.</span>
            </div>
          </div>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; padding-bottom: 40px; }
        .config-card { border: 1px solid var(--color-border); background: var(--color-bg-card); transition: transform 0.2s; }
        .config-card:hover { transform: translateY(-2px); border-color: var(--color-primary); }
        .card-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
        .card-title { font-size: 1.1rem; font-weight: 600; color: white; }
        .card-body { padding: 20px; }
        
        .input-row { display: flex; gap: 16px; }
        .flex-1 { flex: 1; }
        .flex-2 { flex: 2; }
        
        .info-box { display: flex; align-items: center; background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.1); padding: 12px; border-radius: 8px; font-size: 0.8rem; color: var(--color-text-muted); }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}

export default Config;
