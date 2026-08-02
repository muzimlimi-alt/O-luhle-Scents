import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { settingsApi } from '../services/api';
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

// react-quill@2 still calls the legacy ReactDOM.findDOMNode, which React 19
// removed outright — it hard-crashes on mount without this. It's only ever
// called on a host <div> ref (we never pass react-quill custom children),
// where the ref callback already receives the raw DOM node, so returning it
// unchanged reproduces exactly what the real API did for host elements.
if (!ReactDOM.findDOMNode) {
  ReactDOM.findDOMNode = (node) => node;
}

// Paragraph is Quill's implicit default block format and needs no toolbar
// button of its own — restricting the toolbar to these three entries is what
// keeps editors from breaking the site's typography (no headings/fonts/colors).
const QUILL_MODULES = {
  toolbar: [['bold', 'italic'], ['link']],
};
const QUILL_FORMATS = ['bold', 'italic', 'link'];

export function Content() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.list();
      // Flatten the grouped response, keeping only marketing-copy settings.
      const flat = {};
      Object.keys(data).forEach(group => {
        if (group !== 'content') return;
        data[group].forEach(s => {
          flat[s.key] = { value: s.value, group: s.group };
        });
      });
      setSettings(flat);
    } catch (err) {
      console.error('[Content Fetch]', err);
      setMessage({ type: 'error', text: 'Failed to load site content.' });
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
      [key]: { value, group: 'content' },
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
        group: 'content',
      }));

      await settingsApi.update(payload);
      setMessage({ type: 'success', text: 'Site content published successfully.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const val = (key) => settings[key]?.value || '';

  const Field = ({ label, k, placeholder, warning }) => (
    <div className="input-group">
      <label className="input-label">{label}</label>
      <input
        type="text"
        className="input-field"
        value={val(k)}
        placeholder={placeholder}
        onChange={e => handleChange(k, e.target.value)}
      />
      {warning && <div className="content-warning">{warning}</div>}
    </div>
  );

  const CharCountField = ({ label, k, max, warning }) => (
    <div className="input-group">
      <label className="input-label">
        {label} <span className={`char-count${val(k).length > max ? ' char-count--over' : ''}`}>{val(k).length}/{max}</span>
      </label>
      <textarea
        className="input-field"
        rows="3"
        value={val(k)}
        onChange={e => handleChange(k, e.target.value)}
      />
      {warning && <div className="content-warning">{warning}</div>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex-center h-full">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="mt-4 text-muted">Loading site content...</p>
      </div>
    );
  }

  return (
    <div className="content-mgmt-container animate-fade-in">
      <div className="content-header">
        <div>
          <h2 className="page-title">Site Content</h2>
          <p className="page-subtext">Edit the marketing copy shown on the public storefront.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn--outline">
            <ExternalLink size={16} className="mr-2" /> Preview site
          </a>
          <button onClick={handleSave} disabled={saving} className="btn btn--primary">
            {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
            Publish Changes
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert--${message.type === 'error' ? 'danger' : 'success'} mb-6`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="content-mgmt-grid">
        {/* Hero */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Hero</h3></div>
          <div className="card-body">
            <Field label="Tagline" k="hero_tagline" />
            <Field label="Title" k="hero_title" />
            <Field label="Title (emphasis)" k="hero_title_em" />
            <CharCountField label="Subtitle" k="hero_subtitle" max={160} />
            <Field label="Primary CTA Label" k="hero_cta_primary_label" />
            <Field label="Primary CTA Link" k="hero_cta_primary_href" />
            <Field label="Secondary CTA Label" k="hero_cta_secondary_label" />
            <Field label="Secondary CTA Link" k="hero_cta_secondary_href" />
          </div>
        </div>

        {/* Features */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Features Strip</h3></div>
          <div className="card-body">
            <Field label="Feature 1 Title" k="feature_1_title" />
            <Field label="Feature 1 Text" k="feature_1_text" />
            <Field label="Feature 2 Title" k="feature_2_title" />
            <Field
              label="Feature 2 Text"
              k="feature_2_text"
              warning="Display copy only — changing this text does not change the actual free-shipping threshold. Update that under System Config → Free Shipping Limit."
            />
            <Field label="Feature 3 Title" k="feature_3_title" />
            <Field label="Feature 3 Text" k="feature_3_text" />
            <Field label="Feature 4 Title" k="feature_4_title" />
            <Field label="Feature 4 Text" k="feature_4_text" />
          </div>
        </div>

        {/* Collections */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Collections</h3></div>
          <div className="card-body">
            <Field label="Section Label" k="collections_label" />
            <Field label="Section Heading" k="collections_heading" />
            <Field label="Collection 1 Name" k="collection_1_name" />
            <Field
              label="Collection 1 Price Hint"
              k="collection_1_price_hint"
              warning="Marketing copy only — not derived from actual product prices. Keep in sync manually."
            />
            <Field label="Collection 2 Name" k="collection_2_name" />
            <Field label="Collection 2 Price Hint" k="collection_2_price_hint" />
            <Field label="Collection 3 Name" k="collection_3_name" />
            <Field label="Collection 3 Price Hint" k="collection_3_price_hint" />
          </div>
        </div>

        {/* Featured */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Featured</h3></div>
          <div className="card-body">
            <Field label="Section Heading" k="featured_heading" />
          </div>
        </div>

        {/* Brand Story */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Brand Story</h3></div>
          <div className="card-body">
            <Field label="Section Label" k="story_label" />
            <Field label="Section Heading" k="story_heading" />
            <div className="input-group">
              <label className="input-label">Story Body</label>
              <ReactQuill
                theme="snow"
                value={val('story_body')}
                onChange={value => handleChange('story_body', value)}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
              />
            </div>
            <Field label="CTA 1 Label" k="story_cta_1_label" />
            <Field label="CTA 1 Link" k="story_cta_1_href" />
            <Field label="CTA 2 Label" k="story_cta_2_label" />
            <Field label="CTA 2 Link" k="story_cta_2_href" />
          </div>
        </div>

        {/* Newsletter */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Newsletter</h3></div>
          <div className="card-body">
            <Field label="Section Label" k="newsletter_label" />
            <Field label="Section Heading" k="newsletter_heading" />
            <CharCountField label="Text" k="newsletter_text" max={500} />
            <Field label="Button Label" k="newsletter_button" />
          </div>
        </div>

        {/* Announcement Bar */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Announcement Bar</h3></div>
          <div className="card-body">
            <div className="input-group">
              <label className="input-label">
                <input
                  type="checkbox"
                  checked={val('announcement_active') === 'true'}
                  onChange={e => handleChange('announcement_active', e.target.checked ? 'true' : 'false')}
                  style={{ marginRight: '8px' }}
                />
                Show announcement bar
              </label>
            </div>
            <CharCountField label="Message" k="announcement_message" max={120} />
            <Field label="Link (optional)" k="announcement_href" />
          </div>
        </div>

        {/* Footer */}
        <div className="card content-card">
          <div className="card-header"><h3 className="card-title">Footer</h3></div>
          <div className="card-body">
            <CharCountField label="Footer Note" k="footer_note" max={300} />
          </div>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        .content-mgmt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; padding-bottom: 40px; }
        @media (max-width: 460px) {
          .content-mgmt-grid { grid-template-columns: 1fr; }
        }
        .content-card { border: 1px solid var(--color-border); background: var(--color-bg-card); }
        .card-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
        .card-title { font-size: 1.1rem; font-weight: 600; color: white; }
        .card-body { padding: 20px; }
        .char-count { float: right; font-weight: 400; opacity: 0.6; }
        .char-count--over { opacity: 1; color: #e0554f; font-weight: 600; }
        .content-warning { display: flex; align-items: center; background: rgba(212,175,55,0.05); border: 1px solid rgba(212,175,55,0.15); padding: 8px 12px; border-radius: 6px; font-size: 0.75rem; color: var(--color-text-muted); margin: 4px 0 12px; }
        .ql-editor { min-height: 160px; background: #fff; color: #1a1a1a; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}

export default Content;
