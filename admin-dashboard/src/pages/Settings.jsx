import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { settingsApi } from '../services/api';
import {
  Settings as SettingsIcon,
  Save,
  Phone,
  Server,
  CreditCard,
  AlertCircle,
  Truck,
  RefreshCw,
  Bell,
  Percent,
  Store
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

  // `group` is only needed the first time a key is ever set — once it's been
  // saved and re-fetched, prev[key].group is already correct and this param
  // is ignored. Without it, a brand-new key (never saved before) would fall
  // through to handleSave's `s.group || 'general'` default regardless of
  // which settings card it's actually shown in.
  const handleChange = (key, value, group) => {
    setSettings(prev => ({
      ...prev,
      [key]: { group: prev[key]?.group || group, value }
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
            <Store size={20} color="var(--y-base)" />
            <h3>Business Identity</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="Trading Name">
              <input type="text" value={val('company_trading_name')} onChange={e => handleChange('company_trading_name', e.target.value, 'tax')} placeholder="TOCA" />
            </FormField>
            <FormField label="VAT Number" hint="10-digit SARS VAT number — only enter once registration is confirmed.">
              <input type="text" value={val('vat_registration_number')} onChange={e => handleChange('vat_registration_number', e.target.value, 'tax')} placeholder="e.g. 4123456789" />
            </FormField>
            <FormField label="Currency" hint="TOCA prices in South African rand only — multi-currency isn't supported yet, so this isn't editable.">
              <select disabled value="ZAR" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                <option value="ZAR">ZAR — South African rand</option>
              </select>
            </FormField>
            <FormField label="Registered Address" hint="Shown on invoices, packing slips and customs documents.">
              <textarea rows={3} value={val('business_address')} onChange={e => handleChange('business_address', e.target.value)} />
            </FormField>
            <div className="settings-row">
              <FormField label="WhatsApp Number">
                <input type="text" value={val('business_whatsapp')} onChange={e => handleChange('business_whatsapp', e.target.value)} placeholder="+27..." />
              </FormField>
              <FormField label="Support Email">
                <input type="email" value={val('business_email')} onChange={e => handleChange('business_email', e.target.value)} placeholder="info@toca.co.za" />
              </FormField>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Percent size={20} color="var(--y-base)" />
            <h3>Tax &amp; SARS Compliance</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="VAT Vendor Status" hint="Only a business actually registered with SARS as a VAT vendor may legally charge VAT. Leave off until registration is confirmed — checkout charges zero VAT while off, regardless of what rate is configured on the Tax Rates page.">
              <select value={val('vat_registered') || 'false'} onChange={e => handleChange('vat_registered', e.target.value, 'tax')}>
                <option value="false">Not registered — charge no VAT</option>
                <option value="true">Registered — apply configured VAT rate</option>
              </select>
            </FormField>
            <div className={`settings-info-box${val('vat_registered') === 'true' ? ' settings-info-box--warn' : ''}`}>
              <AlertCircle size={14} />
              <span>
                {val('vat_registered') === 'true'
                  ? 'VAT is being charged at checkout using the active rate on the Tax Rates page.'
                  : 'Checkout is currently charging no VAT, regardless of the Tax Rates page.'}
              </span>
            </div>

            <FormField label="Registered Company Name" hint="Legal entity name as registered with CIPC — used on tax invoices once compliant invoicing is enabled. Trading name and VAT number are set on the Store Details card above.">
              <input type="text" value={val('company_legal_name')} onChange={e => handleChange('company_legal_name', e.target.value, 'tax')} placeholder="e.g. TOCA (Pty) Ltd" />
            </FormField>
            <FormField label="Company Registration Number" hint="CIPC registration number.">
              <input type="text" value={val('company_registration_number')} onChange={e => handleChange('company_registration_number', e.target.value, 'tax')} placeholder="e.g. 2024/123456/07" />
            </FormField>
            <FormField label="Income Tax Reference Number">
              <input type="text" value={val('income_tax_reference_number')} onChange={e => handleChange('income_tax_reference_number', e.target.value, 'tax')} placeholder="SARS income tax reference number" />
            </FormField>
            <div className="settings-row">
              <FormField label="PAYE Number" hint="Only relevant once a payroll module exists — safe to leave blank.">
                <input type="text" value={val('paye_number')} onChange={e => handleChange('paye_number', e.target.value, 'tax')} />
              </FormField>
              <FormField label="SDL Number" hint="Skills Development Levy — leave blank if not applicable.">
                <input type="text" value={val('sdl_number')} onChange={e => handleChange('sdl_number', e.target.value, 'tax')} />
              </FormField>
              <FormField label="UIF Number">
                <input type="text" value={val('uif_number')} onChange={e => handleChange('uif_number', e.target.value, 'tax')} />
              </FormField>
            </div>
            <div className="settings-row">
              <FormField label="Financial Year Start" hint="SARS default for most businesses is March; a registered company may elect a different year-end.">
                <select value={val('financial_year_start_month') || ''} onChange={e => handleChange('financial_year_start_month', e.target.value, 'tax')}>
                  <option value="">Not set</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Financial Year End">
                <select value={val('financial_year_end_month') || ''} onChange={e => handleChange('financial_year_end_month', e.target.value, 'tax')}>
                  <option value="">Not set</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Server size={20} color="var(--y-base)" />
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
            <Phone size={20} color="var(--y-base)" />
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
            <CreditCard size={20} color="var(--y-base)" />
            <h3>Manual EFT</h3>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <FormField label="Order Number Prefix" hint="Used for both order references and EFT payment references, e.g. TCA-100548.">
                <input type="text" value={val('order_number_prefix')} onChange={e => handleChange('order_number_prefix', e.target.value)} placeholder="TCA" />
              </FormField>
              <FormField label="Stock Reservation Hold (hours)" hint="How long stock is held for an unpaid EFT order before it's auto-cancelled.">
                <input type="number" min="1" value={val('eft_reservation_hours')} onChange={e => handleChange('eft_reservation_hours', e.target.value)} placeholder="72" />
              </FormField>
            </div>
            <FormField label="Max Proof-of-Payment File Size (MB)">
              <input type="number" min="1" value={val('eft_proof_max_size_mb')} onChange={e => handleChange('eft_proof_max_size_mb', e.target.value)} placeholder="10" />
            </FormField>
            <FormField label="Verification Notification Emails" hint="Comma-separated — notified whenever a customer uploads proof of payment.">
              <input type="text" value={val('eft_verification_notify_emails')} onChange={e => handleChange('eft_verification_notify_emails', e.target.value)} placeholder="orders@toca.co.za, finance@toca.co.za" />
            </FormField>
            <div className="settings-info-box">
              Bank account details shown to EFT customers are managed on the <Link to="/finance/banking">Banking</Link> page — add an account there and mark it default.
            </div>
            <FormField label="Deposit Payments" hint="Let customers pay a deposit now and the balance later via a second proof-of-payment upload.">
              <select value={val('eft_deposit_enabled') || 'false'} onChange={e => handleChange('eft_deposit_enabled', e.target.value)}>
                <option value="false">Disabled — full payment only</option>
                <option value="true">Enabled</option>
              </select>
            </FormField>
            <div className="settings-row">
              <FormField label="Deposit Percentage" hint="Portion of the order total due upfront.">
                <input type="number" min="1" max="99" value={val('eft_deposit_percentage')} onChange={e => handleChange('eft_deposit_percentage', e.target.value)} placeholder="50" />
              </FormField>
              <FormField label="Balance Payment Window (hours)" hint="How long stock stays held after the deposit is verified, for the balance to be paid.">
                <input type="number" min="1" value={val('eft_balance_payment_hours')} onChange={e => handleChange('eft_balance_payment_hours', e.target.value)} placeholder="48" />
              </FormField>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Bell size={20} color="var(--y-base)" />
            <h3>Payment Reminders</h3>
          </div>
          <div className="settings-card-body">
            <FormField label="Automatic Reminders" hint="Off by default — nudges customers whose orders are still unpaid or awaiting a deposit balance, by email and/or WhatsApp.">
              <select value={val('payment_reminder_enabled') || 'false'} onChange={e => handleChange('payment_reminder_enabled', e.target.value)}>
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </FormField>
            <div className="settings-row">
              <FormField label="First Reminder After (hours)" hint="How long an order can sit unpaid before the first reminder.">
                <input type="number" min="1" value={val('payment_reminder_threshold_hours')} onChange={e => handleChange('payment_reminder_threshold_hours', e.target.value)} placeholder="24" />
              </FormField>
              <FormField label="Repeat Every (hours)" hint="Gap between subsequent reminders.">
                <input type="number" min="1" value={val('payment_reminder_interval_hours')} onChange={e => handleChange('payment_reminder_interval_hours', e.target.value)} placeholder="24" />
              </FormField>
            </div>
            <div className="settings-row">
              <FormField label="Maximum Reminders" hint="Stop after this many — the order is auto-cancelled anyway once its stock hold expires.">
                <input type="number" min="1" value={val('payment_reminder_max_count')} onChange={e => handleChange('payment_reminder_max_count', e.target.value)} placeholder="3" />
              </FormField>
              <FormField label="Channel">
                <select value={val('payment_reminder_channel') || 'email'} onChange={e => handleChange('payment_reminder_channel', e.target.value)}>
                  <option value="email">Email only</option>
                  <option value="whatsapp">WhatsApp only</option>
                  <option value="both">Email + WhatsApp</option>
                </select>
              </FormField>
            </div>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-card-header">
            <Truck size={20} color="var(--y-base)" />
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
            <RefreshCw size={20} color="var(--y-base)" />
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
        .settings-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border-default); }
        .settings-card-header h3 { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0; }
        .settings-card-body { padding: 20px; display: flex; flex-direction: column; gap: 4px; }

        .settings-row { display: flex; gap: 16px; }
        .settings-row .form-field { flex: 1; }

        .settings-info-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(var(--y-rgb),0.08); border: 1px solid rgba(var(--y-rgb),0.2);
          padding: 12px; border-radius: var(--r); font-size: 0.8rem; color: var(--text-muted);
          margin-top: 8px;
        }
        .settings-info-box--warn {
          background: rgba(192,57,43,0.08); border-color: rgba(192,57,43,0.25); color: var(--error-text, #c0392b);
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
