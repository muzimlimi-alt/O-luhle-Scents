import React, { useState, useEffect } from 'react';
import { settingsApi } from '../services/api';
import { 
  Settings as SettingsIcon, 
  Save, 
  Mail, 
  MessageCircle, 
  Truck, 
  CreditCard, 
  ShieldCheck, 
  Loader2,
  AlertCircle,
  Smartphone,
  Globe
} from 'lucide-react';

const CONFIG_TABS = [
  { id: 'communication', label: 'Communication', icon: <MessageCircle size={18} /> },
  { id: 'logistics', label: 'Logistics', icon: <Truck size={18} /> },
  { id: 'finance', label: 'Finance', icon: <CreditCard size={18} /> },
  { id: 'system', label: 'System', icon: <Globe size={18} /> }
];

export function Settings() {
  const [activeTab, setActiveTab] = useState('communication');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const data = await settingsApi.list();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (group, key, value) => {
    setSettings(prev => ({
      ...prev,
      [group]: prev[group].map(s => s.key === key ? { ...s, value } : s)
    }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setSuccess(false);
    try {
      // Flatten all groups back into a single array for the API
      const flattened = Object.values(settings).flat();
      await settingsApi.update(flattened);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Failed to synchronize global configuration: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderTabContent = () => {
    const groupItems = settings[activeTab] || [];
    
    if (groupItems.length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: '12px' }}>
          <AlertCircle size={32} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No configuration keys registered for this module.</p>
          <button 
            className="btn btn--secondary btn--sm" 
            style={{ marginTop: '12px' }}
            onClick={() => handleSeedDefaults(activeTab)}
          >
            Deploy Operational Defaults
          </button>
        </div>
      );
    }

    const getLabel = (key) => {
      const labels = {
        'TWILIO_ACCOUNT_SID': 'Twilio Account SID',
        'TWILIO_AUTH_TOKEN': 'Twilio Auth Token',
        'TWILIO_WHATSAPP_FROM': 'WhatsApp Outbound Number',
        'WHATSAPP_PHONE': 'Direct Support WhatsApp',
        'EMAIL_HOST': 'SMTP Host Address',
        'EMAIL_PORT': 'SMTP Port',
        'EMAIL_USER': 'SMTP Outbound Email',
        'EMAIL_PASS': 'SMTP Secure Password',
        'BANK_ACCOUNT_NAME': 'Bank Account Holder',
        'BANK_ACCOUNT_NUMBER': 'Account Number',
        'BANK_BRANCH_CODE': 'Branch Code',
        'WAREHOUSE_ADDRESS': 'Fulfillment Center Address',
        'COURIER_API_KEY': 'Default Courier API Key',
        'FRONTEND_URL': 'Public Storefront URL'
      };
      return labels[key] || key.replace(/_/g, ' ');
    };

    return (
      <div className="settings-grid">
        {groupItems.map(s => (
          <div key={s.id} className="form-group" style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
              {getLabel(s.key)}
            </label>
            <input 
              type={s.key.toLowerCase().includes('pass') || s.key.toLowerCase().includes('token') ? 'password' : 'text'}
              className="settings-input"
              value={s.value}
              onChange={e => handleChange(activeTab, s.key, e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'white' }}
            />
          </div>
        ))}
      </div>
    );
  };


  const handleSeedDefaults = (group) => {
    const defaults = {
      communication: [
        { key: 'TWILIO_ACCOUNT_SID', value: '', group: 'communication' },
        { key: 'TWILIO_AUTH_TOKEN', value: '', group: 'communication' },
        { key: 'TWILIO_WHATSAPP_FROM', value: '', group: 'communication' },
        { key: 'WHATSAPP_PHONE', value: '', group: 'communication' }
      ],
      logistics: [
        { key: 'WAREHOUSE_ADDRESS', value: '123 Luxury Avenue, Sandton, JHB', group: 'logistics' },
        { key: 'COURIER_API_KEY', value: '', group: 'logistics' }
      ],
      finance: [
        { key: 'BANK_ACCOUNT_NAME', value: "O'Luhle Scents (Pty) Ltd", group: 'finance' },
        { key: 'BANK_ACCOUNT_NUMBER', value: '', group: 'finance' },
        { key: 'BANK_BRANCH_CODE', value: '', group: 'finance' }
      ],
      system: [
        { key: 'EMAIL_HOST', value: 'smtp.gmail.com', group: 'system' },
        { key: 'EMAIL_PORT', value: '465', group: 'system' },
        { key: 'EMAIL_USER', value: '', group: 'system' },
        { key: 'EMAIL_PASS', value: '', group: 'system' },
        { key: 'FRONTEND_URL', value: 'http://localhost:5173', group: 'system' }
      ]
    };
    
    setSettings(prev => ({
      ...prev,
      [group]: defaults[group]
    }));
  };

  return (
    <div className="settings-page">
      <div className="content-header" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="page-title">Global Configuration Suite</h2>
            <p className="page-subtitle">Orchestrate O'luhle Scents operational metadata across global fulfillment networks</p>
          </div>
          <button 
            className={`btn btn--primary ${success ? 'btn--success' : ''}`} 
            onClick={handleSave}
            disabled={submitting}
            style={{ minWidth: '160px' }}
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : success ? <ShieldCheck size={18} /> : <Save size={18} />}
            <span style={{ marginLeft: '8px' }}>{submitting ? 'Saving...' : success ? 'Synchronized' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      <div className="settings-container" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px' }}>
        <aside className="settings-tabs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {CONFIG_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', background: activeTab === tab.id ? 'rgba(212,175,55,0.1)' : 'transparent', color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </aside>

        <main className="card" style={{ padding: '32px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <Loader2 className="animate-spin" size={32} color="#d4af37" />
            </div>
          ) : renderTabContent()}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-input:focus { border-color: var(--color-primary) !important; outline: none; box-shadow: 0 0 0 2px rgba(212,175,55,0.2); }
        .btn--success { background-color: #22c55e !important; border-color: #22c55e !important; }
      `}} />
    </div>
  );
}
