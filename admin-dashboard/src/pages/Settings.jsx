import React, { useState, useEffect } from 'react';
import { settingsApi } from '../services/api';
import {
  Settings as SettingsIcon,
  Save,
  Phone,
  Mail,
  MapPin,
  Server,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  Truck,
  RefreshCw
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';

export function Settings() {
  const { showMessage } = useMessaging();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.list();
      // Flatten the server's group-keyed response into a flat key -> {value, group} map —
      // the merged page defines its own logical grouping for display, independent of
      // whatever "group" string each key happens to be stored under.
      const flat = {};
      Object.keys(data).forEach(group => {
        data[group].forEach(s => {
          flat[s.key] = { value: s.value, group: s.group };
        });
      });
      setSettings(flat);
    } catch (err) {
      showMessage('error', 'Load Failed', 'Failed to load system configuration.');
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
    try {
      const payload = Object.keys(settings).map(key => ({
        key,
        value: settings[key].value,
        group: settings[key].group
      }));

      await settingsApi.update(payload);
      showMessage('success', 'Settings Saved', 'System configuration has been synchronized.');
    } catch (err) {
      showMessage('error', 'Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const val = (key) => settings[key]?.value || '';

  if (loading) return <LoadingState label="Loading settings..." />;

  return (
    <div className="settings-page">
      <PageHeader
        icon={<SettingsIcon size={22} />}
        title="Settings"
        subtitle="Business identity, integrations, and fulfillment parameters."
        actions={(
          <button onClick={handleSave} disabled={saving} className="btn btn--primary">
            <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      />

      <form onSubmit={handleSave} className="settings-grid">
        <div className="card settings-card">
          <div className="settings-card-header">
            <ShieldCheck size={20} color="var(--color-primary)" />
            <h3>Business Identity</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="WhatsApp Number">
              <input type="text" value={val('business_whatsapp')} onChange={e => handleChange('business_whatsapp', e.target.value)} placeholder="+27..." />
            </FormField>
            <FormField label="Support Email">
              <input type="email" value={val('business_email')} onChange={e => handleChange('business_email', e.target.value)} placeholder="info@oluhlescents.co.za" />
            </FormField>
            <FormField label="Physical Address">
              <textarea rows={3} value={val('business_address')} onChange={e => handleChange('business_address', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Server size={20} color="var(--color-primary)" />
            <h3>Email Fulfillment (SMTP)</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <FormField label="SMTP Host">
                <input type="text" value={val('EMAIL_HOST')} onChange={e => handleChange('EMAIL_HOST', e.target.value)} placeholder="smtp.gmail.com (leave blank to use Gmail service)" />
              </FormField>
              <FormField label="Port">
                <input type="text" value={val('EMAIL_PORT') || '587'} onChange={e => handleChange('EMAIL_PORT', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Username">
              <input type="text" value={val('EMAIL_USER')} onChange={e => handleChange('EMAIL_USER', e.target.value)} />
            </FormField>
            <FormField label="Password">
              <input type="password" value={val('EMAIL_PASS')} onChange={e => handleChange('EMAIL_PASS', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Phone size={20} color="var(--color-primary)" />
            <h3>WhatsApp Fulfillment (Twilio)</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="Account SID">
              <input type="text" value={val('TWILIO_ACCOUNT_SID')} onChange={e => handleChange('TWILIO_ACCOUNT_SID', e.target.value)} />
            </FormField>
            <FormField label="Auth Token">
              <input type="password" value={val('TWILIO_AUTH_TOKEN')} onChange={e => handleChange('TWILIO_AUTH_TOKEN', e.target.value)} />
            </FormField>
            <FormField label="WhatsApp From" hint="e.g. whatsapp:+14155238886">
              <input type="text" value={val('TWILIO_WHATSAPP_FROM')} onChange={e => handleChange('TWILIO_WHATSAPP_FROM', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <CreditCard size={20} color="var(--color-primary)" />
            <h3>Banking & Settlement</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="Bank Name">
              <input type="text" value={val('bank_name')} onChange={e => handleChange('bank_name', e.target.value)} />
            </FormField>
            <FormField label="Account Holder">
              <input type="text" value={val('bank_holder')} onChange={e => handleChange('bank_holder', e.target.value)} />
            </FormField>
            <div className="settings-row">
              <FormField label="Account Number">
                <input type="text" value={val('bank_account')} onChange={e => handleChange('bank_account', e.target.value)} />
              </FormField>
              <FormField label="Branch Code">
                <input type="text" value={val('bank_branch')} onChange={e => handleChange('bank_branch', e.target.value)} />
              </FormField>
            </div>
            <div className="settings-row">
              <FormField label="Account Type">
                <input type="text" value={val('bank_account_type')} onChange={e => handleChange('bank_account_type', e.target.value)} placeholder="Cheque / Savings" />
              </FormField>
              <FormField label="SWIFT Code (optional)">
                <input type="text" value={val('bank_swift')} onChange={e => handleChange('bank_swift', e.target.value)} />
              </FormField>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <CreditCard size={20} color="var(--color-primary)" />
            <h3>Manual EFT</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <FormField label="Order Number Prefix" hint="Used for both order references and EFT payment references, e.g. OSC-100548.">
                <input type="text" value={val('order_number_prefix')} onChange={e => handleChange('order_number_prefix', e.target.value)} placeholder="OSC" />
              </FormField>
              <FormField label="Stock Reservation Hold (hours)" hint="How long stock is held for an unpaid EFT order before it's auto-cancelled.">
                <input type="number" min="1" value={val('eft_reservation_hours')} onChange={e => handleChange('eft_reservation_hours', e.target.value)} placeholder="72" />
              </FormField>
            </div>
            <FormField label="Max Proof-of-Payment File Size (MB)">
              <input type="number" min="1" value={val('eft_proof_max_size_mb')} onChange={e => handleChange('eft_proof_max_size_mb', e.target.value)} placeholder="10" />
            </FormField>
            <FormField label="Verification Notification Emails" hint="Comma-separated — notified whenever a customer uploads proof of payment.">
              <input type="text" value={val('eft_verification_notify_emails')} onChange={e => handleChange('eft_verification_notify_emails', e.target.value)} placeholder="orders@oluhle.co.za, finance@oluhle.co.za" />
            </FormField>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Truck size={20} color="var(--color-primary)" />
            <h3>Logistics</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="Fulfillment Center Address">
              <textarea rows={2} value={val('WAREHOUSE_ADDRESS')} onChange={e => handleChange('WAREHOUSE_ADDRESS', e.target.value)} />
            </FormField>
            <FormField label="Default Courier API Key">
              <input type="password" value={val('COURIER_API_KEY')} onChange={e => handleChange('COURIER_API_KEY', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <RefreshCw size={20} color="var(--color-primary)" />
            <h3>Thresholds & Limits</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="Low Stock Threshold">
              <input type="number" value={val('low_stock_limit') || '5'} onChange={e => handleChange('low_stock_limit', e.target.value)} />
            </FormField>
            <FormField label="Free Shipping Limit (R)">
              <input type="number" value={val('free_shipping_min') || '1500'} onChange={e => handleChange('free_shipping_min', e.target.value)} />
            </FormField>
            <div className="settings-info-box">
              <AlertCircle size={14} />
              <span>These parameters affect the storefront globally.</span>
            </div>
          </div>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-page { padding: 40px; max-width: 1600px; margin: 0 auto; min-height: 100vh; }

        .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; }
        .settings-card { padding: 0; overflow: hidden; }
        .settings-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
        .settings-card-header h3 { font-size: 1rem; font-weight: 600; color: var(--color-text-header); margin: 0; }
        .settings-card-body { padding: 20px; display: flex; flex-direction: column; gap: 4px; }

        .settings-row { display: flex; gap: 16px; }
        .settings-row .form-field { flex: 1; }

        .settings-info-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(184,155,106,0.08); border: 1px solid rgba(184,155,106,0.2);
          padding: 12px; border-radius: 4px; font-size: 0.8rem; color: var(--color-text-muted);
          margin-top: 8px;
        }

        @media (max-width: 460px) {
          .settings-page { padding: 20px; }
          .settings-grid { grid-template-columns: 1fr; }
          .settings-row { flex-direction: column; gap: 0; }
        }
      `}} />
    </div>
  );
}

export default Settings;
