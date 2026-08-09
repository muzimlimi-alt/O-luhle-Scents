import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { settingsApi } from '../services/api';
import {
  FileText,
  Save,
  Loader2,
  ExternalLink,
  Upload,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';

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
  const { showMessage } = useMessaging();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null);

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
      showMessage('error', 'Load Failed', 'Failed to load site content.');
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

    try {
      const payload = Object.keys(settings).map(key => ({
        key,
        value: settings[key].value,
        group: 'content',
      }));

      await settingsApi.update(payload);
      showMessage('success', 'Content Published', 'Site content has been published successfully.');
    } catch (err) {
      showMessage('error', 'Publish Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (key, file) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      const { url } = await settingsApi.uploadImage(file);
      handleChange(key, url);
    } catch (err) {
      showMessage('error', 'Upload Failed', err.message);
    } finally {
      setUploadingKey(null);
    }
  };

  const val = (key) => settings[key]?.value || '';

  const Field = ({ label, k, placeholder, warning }) => (
    <FormField label={label} hint={warning}>
      <input
        type="text"
        value={val(k)}
        placeholder={placeholder}
        onChange={e => handleChange(k, e.target.value)}
      />
    </FormField>
  );

  const CharCountField = ({ label, k, max, warning }) => (
    <FormField
      label={(
        <>
          {label} <span className={`char-count${val(k).length > max ? ' char-count--over' : ''}`}>{val(k).length}/{max}</span>
        </>
      )}
      hint={warning}
    >
      <textarea
        rows="3"
        value={val(k)}
        onChange={e => handleChange(k, e.target.value)}
      />
    </FormField>
  );

  const isVideoUrl = (url) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url || '');

  const MediaField = ({ label, k, hint }) => {
    const isUploading = uploadingKey === k;
    const current = val(k);
    return (
      <FormField label={label} hint={hint}>
        <div>
          {current && (
            <div className="image-preview">
              {isVideoUrl(current) ? (
                <video src={current} muted loop autoPlay playsInline />
              ) : (
                <img src={current} alt="" />
              )}
              <button
                type="button"
                className="image-preview__remove"
                onClick={() => handleChange(k, '')}
                aria-label={`Remove ${label}`}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label className={`image-upload-btn${isUploading ? ' image-upload-btn--busy' : ''}`}>
            {isUploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            {isUploading ? 'Uploading...' : current ? 'Replace Media' : 'Upload Image or Video'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={e => handleImageUpload(k, e.target.files[0])}
              disabled={isUploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </FormField>
    );
  };

  if (loading) return <LoadingState label="Loading site content..." />;

  return (
    <div className="content-mgmt-page">
      <PageHeader
        icon={<FileText size={22} />}
        title="Site Content"
        subtitle="Edit the marketing copy shown on the public storefront."
        actions={(
          <>
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn--outline">
              <ExternalLink size={16} /> Preview Site
            </a>
            <button onClick={handleSave} disabled={saving} className="btn btn--primary">
              {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              {saving ? 'Publishing...' : 'Publish Changes'}
            </button>
          </>
        )}
      />

      <form onSubmit={handleSave} className="content-mgmt-grid">
        {/* Hero */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Hero</h3></div>
          <div className="content-card-body">
            <MediaField
              label="Hero Background Media"
              k="hero_media_url"
              hint="Image or short video (a wide, moody shot works best — 2400×1350px or larger for photos, under ~15s for video). A dark gradient overlay is applied automatically so the hero text stays readable. Video autoplays muted and loops; visitors with reduced-motion enabled see a static frame instead. Leave empty to use the default dark gradient background."
            />
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
          <div className="content-card-header"><h3>Features Strip</h3></div>
          <div className="content-card-body">
            <Field label="Feature 1 Title" k="feature_1_title" />
            <Field label="Feature 1 Text" k="feature_1_text" />
            <Field label="Feature 2 Title" k="feature_2_title" />
            <Field
              label="Feature 2 Text"
              k="feature_2_text"
              warning="Display copy only — changing this text does not change the actual free-shipping threshold. Update that under Settings → Free Shipping Limit."
            />
            <Field label="Feature 3 Title" k="feature_3_title" />
            <Field label="Feature 3 Text" k="feature_3_text" />
            <Field label="Feature 4 Title" k="feature_4_title" />
            <Field label="Feature 4 Text" k="feature_4_text" />
          </div>
        </div>

        {/* Collections */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Collections</h3></div>
          <div className="content-card-body">
            <Field label="Section Label" k="collections_label" />
            <Field label="Section Heading" k="collections_heading" />
            <Field label="Collection 1 Name" k="collection_1_name" />
            <Field
              label="Collection 1 Price Hint"
              k="collection_1_price_hint"
              warning="Marketing copy only — not derived from actual product prices. Keep in sync manually."
            />
            <MediaField
              label="Collection 1 Image"
              k="collection_1_image_url"
              hint="Portrait photo — card is 3:4 on mobile, 2:3 on desktop; 1000×1500px or larger works well. Leave empty to keep the default gradient background."
            />
            <Field label="Collection 2 Name" k="collection_2_name" />
            <Field label="Collection 2 Price Hint" k="collection_2_price_hint" />
            <MediaField
              label="Collection 2 Image"
              k="collection_2_image_url"
              hint="Portrait photo — card is 3:4 on mobile, 2:3 on desktop; 1000×1500px or larger works well. Leave empty to keep the default gradient background."
            />
            <Field label="Collection 3 Name" k="collection_3_name" />
            <Field label="Collection 3 Price Hint" k="collection_3_price_hint" />
            <MediaField
              label="Collection 3 Image"
              k="collection_3_image_url"
              hint="Portrait photo — card is 3:4 on mobile, 2:3 on desktop; 1000×1500px or larger works well. Leave empty to keep the default gradient background."
            />
          </div>
        </div>

        {/* Featured */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Featured</h3></div>
          <div className="content-card-body">
            <Field label="Section Heading" k="featured_heading" />
          </div>
        </div>

        {/* Brand Story */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Brand Story</h3></div>
          <div className="content-card-body">
            <Field label="Section Label" k="story_label" />
            <Field label="Section Heading" k="story_heading" />
            <FormField label="Story Body">
              <div className="quill-wrapper">
                <ReactQuill
                  theme="snow"
                  value={val('story_body')}
                  onChange={value => handleChange('story_body', value)}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                />
              </div>
            </FormField>
            <Field label="CTA 1 Label" k="story_cta_1_label" />
            <Field label="CTA 1 Link" k="story_cta_1_href" />
            <Field label="CTA 2 Label" k="story_cta_2_label" />
            <Field label="CTA 2 Link" k="story_cta_2_href" />
          </div>
        </div>

        {/* Newsletter */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Newsletter</h3></div>
          <div className="content-card-body">
            <Field label="Section Label" k="newsletter_label" />
            <Field label="Section Heading" k="newsletter_heading" />
            <CharCountField label="Text" k="newsletter_text" max={500} />
            <Field label="Button Label" k="newsletter_button" />
          </div>
        </div>

        {/* Announcement Bar */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Announcement Bar</h3></div>
          <div className="content-card-body">
            <label className="announcement-toggle">
              <input
                type="checkbox"
                checked={val('announcement_active') === 'true'}
                onChange={e => handleChange('announcement_active', e.target.checked ? 'true' : 'false')}
              />
              Show announcement bar
            </label>
            <CharCountField label="Message" k="announcement_message" max={120} />
            <Field label="Link (optional)" k="announcement_href" />
          </div>
        </div>

        {/* Contact */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Contact — Side Panel Cards</h3></div>
          <div className="content-card-body">
            <CharCountField label="Quote Text" k="contact_quote_text" max={200} />
            <Field label="Quote Author" k="contact_quote_author" />
            <Field label="“Reach Us” Card Heading" k="contact_reach_heading" />
          </div>
        </div>

        {/* Footer */}
        <div className="card content-card">
          <div className="content-card-header"><h3>Footer</h3></div>
          <div className="content-card-body">
            <CharCountField label="Footer Note" k="footer_note" max={300} />
          </div>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        .content-mgmt-page { padding: var(--sp-7); max-width: 1600px; margin: 0 auto; min-height: 100vh; }

        .content-mgmt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--sp-5); }
        .content-card { padding: 0; overflow: hidden; }
        .content-card-header { padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-default); }
        .content-card-header h3 { font-size: 1rem; font-weight: 400; color: var(--text-primary); margin: 0; }
        .content-card-body { padding: var(--sp-5); display: flex; flex-direction: column; gap: 4px; }

        .char-count { float: right; font-weight: 400; opacity: 0.7; text-transform: none; letter-spacing: normal; }
        .char-count--over { opacity: 1; color: var(--error); font-weight: 500; }

        .image-preview { position: relative; margin-bottom: var(--sp-2); border-radius: var(--r); overflow: hidden; border: 1px solid var(--border-default); background: var(--bg-section); }
        .image-preview img, .image-preview video { width: 100%; height: 160px; object-fit: cover; display: block; }
        .image-preview__remove { position: absolute; top: var(--sp-2); right: var(--sp-2); background: rgba(0,0,0,0.75); color: #fff; border: 2px solid rgba(255,255,255,0.85); box-shadow: var(--sh-sm); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background var(--t-fast, .18s) var(--ease, ease), transform var(--t-fast, .18s) var(--ease, ease); z-index: 2; }
        .image-preview__remove:hover { background: var(--error); border-color: #fff; transform: scale(1.08); }
        .image-preview__remove:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }

        .image-upload-btn { display: inline-flex; align-items: center; gap: var(--sp-2); padding: 10px var(--sp-4); border: 1px dashed var(--border-default); border-radius: var(--r); font-size: 0.8rem; color: var(--text-muted); cursor: pointer; transition: all var(--t-fast, .18s) var(--ease, ease); }
        .image-upload-btn:hover { border-color: var(--y-base); color: var(--y-base); }
        .image-upload-btn--busy { opacity: 0.7; cursor: not-allowed; pointer-events: none; }
        .image-upload-btn:has(input:focus-visible) { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }

        .announcement-toggle { display: flex; align-items: center; gap: var(--sp-2); font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; margin-bottom: var(--sp-4); }
        .announcement-toggle input { width: 16px; height: 16px; accent-color: var(--y-base); cursor: pointer; }

        .quill-wrapper { background: #fff; border-radius: var(--r); overflow: hidden; }
        .ql-editor { min-height: 160px; background: #fff; color: #1a1a1a; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        @media (max-width: 460px) {
          .content-mgmt-page { padding: var(--sp-4); }
          .content-mgmt-grid { grid-template-columns: 1fr; }
          .content-card-header { padding: var(--sp-3) var(--sp-4); }
          .content-card-body { padding: var(--sp-4); }
        }
      `}} />
    </div>
  );
}

export default Content;
