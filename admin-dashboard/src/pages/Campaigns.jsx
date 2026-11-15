import { useState, useEffect, useCallback } from 'react';
import { campaignsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { Megaphone, Plus, Edit2, Trash2, Eye, Upload, X } from 'lucide-react';

const EMPTY_FORM = {
  name: '', eyebrow: '', heading: '', subheading: '',
  ctaLabel: '', ctaHref: '', startsAt: '', endsAt: '',
  isActive: false, priority: '0',
};

function toLocalDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_MAP = {
  live: 'success',
  scheduled: 'info',
  draft: 'default',
  ended: 'warning',
};

export function Campaigns() {
  const { showMessage } = useMessaging();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('campaigns', 'write');
  const canDelete = hasPermission('campaigns', 'delete');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await campaignsApi.list();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch campaigns:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (campaign) => {
    setEditing(campaign);
    setForm({
      name: campaign.name || '',
      eyebrow: campaign.eyebrow || '',
      heading: campaign.heading || '',
      subheading: campaign.subheading || '',
      ctaLabel: campaign.ctaLabel || '',
      ctaHref: campaign.ctaHref || '',
      startsAt: toLocalDatetime(campaign.startsAt),
      endsAt: toLocalDatetime(campaign.endsAt),
      isActive: campaign.isActive ?? false,
      priority: String(campaign.priority ?? 0),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        eyebrow: form.eyebrow,
        heading: form.heading,
        subheading: form.subheading,
        ctaLabel: form.ctaLabel,
        ctaHref: form.ctaHref,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        isActive: form.isActive,
        priority: parseInt(form.priority) || 0,
      };
      if (editing) {
        await campaignsApi.update(editing.id, payload);
        showMessage('success', 'Updated', `Campaign "${form.name}" saved.`);
      } else {
        await campaignsApi.create(payload);
        showMessage('success', 'Created', `Campaign "${form.name}" created.`);
      }
      setShowModal(false);
      fetchCampaigns();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return;
    try {
      await campaignsApi.delete(campaign.id);
      showMessage('success', 'Deleted', `Campaign "${campaign.name}" removed.`);
      fetchCampaigns();
    } catch (err) {
      showMessage('error', 'Delete Failed', err.message);
    }
  };

  const handleImageUpload = async (file, slot) => {
    if (!editing) return;
    try {
      const updated = await campaignsApi.uploadImage(editing.id, file, slot);
      setEditing(updated);
      fetchCampaigns();
      showMessage('success', 'Uploaded', `${slot === 'mobile' ? 'Mobile' : 'Desktop'} image uploaded.`);
    } catch (err) {
      showMessage('error', 'Upload Failed', err.message);
    }
  };

  const handleImageRemove = async (slot) => {
    if (!editing) return;
    try {
      const updated = await campaignsApi.removeImage(editing.id, slot);
      setEditing(updated);
      fetchCampaigns();
    } catch (err) {
      showMessage('error', 'Remove Failed', err.message);
    }
  };

  const previewCampaign = (campaign) => {
    window.open(`/?campaignPreview=${campaign.id}`, '_blank');
  };

  const columns = [
    { key: 'name', label: 'Campaign', render: (val) => <span style={{ fontWeight: 600 }}>{val}</span> },
    {
      key: 'status', label: 'Status',
      render: (val) => <StatusBadge status={val} variant={STATUS_MAP[val] || 'default'} />,
    },
    {
      key: 'startsAt', label: 'Starts',
      render: (val) => val ? new Date(val).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
    },
    {
      key: 'endsAt', label: 'Ends',
      render: (val) => val ? new Date(val).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No end date',
    },
    { key: 'priority', label: 'Priority' },
    {
      key: 'actions', label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-icon" title="Preview on storefront" onClick={() => previewCampaign(row)}>
            <Eye size={15} />
          </button>
          {canWrite && (
            <button className="btn-icon" title="Edit" onClick={() => openEdit(row)}>
              <Edit2 size={15} />
            </button>
          )}
          {canDelete && (
            <button className="btn-icon btn-icon--danger" title="Delete" onClick={() => handleDelete(row)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Image slot component
  const ImageSlot = ({ label, slot, currentUrl }) => (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.85rem' }}>
        {label}
      </label>
      {currentUrl ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={currentUrl}
            alt={label}
            style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, border: '1px solid var(--border)' }}
          />
          {canWrite && (
            <button
              className="btn-icon btn-icon--danger"
              style={{ position: 'absolute', top: 4, right: 4 }}
              title="Remove image"
              onClick={() => handleImageRemove(slot)}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : canWrite ? (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1rem', border: '2px dashed var(--border)',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Upload size={16} />
          Upload {label.toLowerCase()}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file, slot);
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No image</span>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Schedule hero banners for the homepage"
        icon={<Megaphone size={22} />}
        action={canWrite ? { label: 'New Campaign', icon: <Plus size={16} />, onClick: openCreate } : undefined}
      />

      <DataTable columns={columns} data={campaigns} loading={loading} emptyMessage="No campaigns yet" />

      <Drawer open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Campaign' : 'New Campaign'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Campaign Name" required>
            <input
              className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Summer Sale 2027"
              required
            />
          </FormField>

          <FormField label="Eyebrow Text" hint="Small text above the heading">
            <input
              className="input" value={form.eyebrow}
              onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
              placeholder="e.g. Limited Time"
            />
          </FormField>

          <FormField label="Heading" required>
            <input
              className="input" value={form.heading}
              onChange={(e) => setForm({ ...form, heading: e.target.value })}
              placeholder="e.g. The Summer Collection"
              required
            />
          </FormField>

          <FormField label="Subheading">
            <textarea
              className="input" rows={2} value={form.subheading}
              onChange={(e) => setForm({ ...form, subheading: e.target.value })}
              placeholder="e.g. Discover fragrances inspired by warm summer evenings"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="CTA Label">
              <input
                className="input" value={form.ctaLabel}
                onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                placeholder="e.g. Shop Now"
              />
            </FormField>
            <FormField label="CTA Link">
              <input
                className="input" value={form.ctaHref}
                onChange={(e) => setForm({ ...form, ctaHref: e.target.value })}
                placeholder="e.g. shop.html?collection=summer"
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Starts At" required>
              <input
                className="input" type="datetime-local" value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Ends At" hint="Leave empty for no end date">
              <input
                className="input" type="datetime-local" value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Priority" hint="Higher = shown first">
              <input
                className="input" type="number" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </FormField>
            <FormField label="Published">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (visible when within date range)
              </label>
            </FormField>
          </div>

          {editing && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Hero Images</h4>
              <ImageSlot label="Desktop Image" slot="desktop" currentUrl={editing.desktopImage} />
              <ImageSlot label="Mobile Image" slot="mobile" currentUrl={editing.mobileImage} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Campaign'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
