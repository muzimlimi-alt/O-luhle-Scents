import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Eye, Edit2, ChevronDown, ChevronUp, History, ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { policiesApi } from '../services/api';

const STATUS_FLOW = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['APPROVED', 'DRAFT', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const STATUS_COLORS = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  APPROVED: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
};

const POLICY_DEFAULTS = {
  title: '',
  slug: '',
  content: '',
  summary: '',
  effectiveDate: '',
  metaTitle: '',
  metaDescription: '',
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ── Policy List ────────────────────────────────────────────────────────────────
function PolicyList({ onSelect, onNew, refreshKey }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    policiesApi.list()
      .then(setPolicies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <LoadingState message="Loading policies…" />;
  if (!policies.length) {
    return (
      <EmptyState
        icon={<FileText size={40} />}
        title="No policies yet"
        description="Create your first legal policy to display on the website."
        action={<button className="btn btn--primary" onClick={onNew}>Create Policy</button>}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button className="btn btn--primary btn--sm" onClick={onNew}>
          <Plus size={15} style={{ marginRight: 6 }} />New Policy
        </button>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Version</th>
              <th>Last Updated</th>
              <th>Versions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.title}</td>
                <td><code style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>/{p.slug}</code></td>
                <td><StatusBadge status={p.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} /></td>
                <td>v{p.version}</td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  {new Date(p.updatedAt).toLocaleDateString('en-ZA')}
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  {p._count?.versions ?? '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {p.status === 'PUBLISHED' && (
                      <a
                        href={`/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--ghost btn--sm"
                        title="View live"
                      >
                        <Eye size={14} />
                      </a>
                    )}
                    <button className="btn btn--ghost btn--sm" onClick={() => onSelect(p.id)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Version History ────────────────────────────────────────────────────────────
function VersionHistory({ policyId, currentVersion, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!open) return;
    setLoading(true);
    policiesApi.getVersions(policyId)
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [policyId, open]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <button
        className="btn btn--ghost"
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} /> Version History
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading…</p>
          ) : versions.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No versions recorded.</p>
          ) : (
            <table className="data-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Title</th>
                  <th>Status at time</th>
                  <th>Notes</th>
                  <th>Saved</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} style={v.version === currentVersion ? { background: 'var(--color-bg-alt)' } : {}}>
                    <td>v{v.version}{v.version === currentVersion ? ' (current)' : ''}</td>
                    <td>{v.title}</td>
                    <td><StatusBadge status={v.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} /></td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{v.changeNotes || '—'}</td>
                    <td>{new Date(v.createdAt).toLocaleDateString('en-ZA')}</td>
                    <td>
                      {v.version !== currentVersion && (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => onRestore(v.id, v.version)}
                          title={`Restore to v${v.version}`}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Policy Editor ──────────────────────────────────────────────────────────────
function PolicyEditor({ policyId, onBack, onSaved }) {
  const isNew = !policyId;
  const [form, setForm] = useState(POLICY_DEFAULTS);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [statusTarget, setStatusTarget] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    policiesApi.get(policyId)
      .then((p) => {
        setPolicy(p);
        setForm({
          title: p.title,
          slug: p.slug,
          content: p.content,
          summary: p.summary || '',
          effectiveDate: p.effectiveDate ? p.effectiveDate.substring(0, 10) : '',
          metaTitle: p.metaTitle || '',
          metaDescription: p.metaDescription || '',
        });
      })
      .catch(() => setError('Could not load policy.'))
      .finally(() => setLoading(false));
  }, [policyId, isNew]);

  const set = (field) => (e) => {
    setForm((prev) => {
      const next = { ...prev, [field]: e.target.value };
      if (field === 'title' && isNew) next.slug = slugify(e.target.value);
      return next;
    });
  };

  const handleSave = async () => {
    setError('');
    if (!form.title || !form.slug || !form.content) {
      setError('Title, slug and content are required.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await policiesApi.create({ ...form });
      } else {
        await policiesApi.update(policyId, { ...form, changeNotes });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    try {
      await policiesApi.updateStatus(policyId, statusTarget);
      onSaved();
    } catch (err) {
      setError(err.message || 'Status change failed.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleRestore = async (versionId, version) => {
    if (!window.confirm(`Restore content from version ${version}? This will create a new version entry.`)) return;
    try {
      await policiesApi.restoreVersion(policyId, versionId);
      onSaved();
    } catch (err) {
      setError(err.message || 'Restore failed.');
    }
  };

  if (loading) return <LoadingState message="Loading policy…" />;

  const nextStatuses = policy ? STATUS_FLOW[policy.status] || [] : [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          <ArrowLeft size={15} style={{ marginRight: 6 }} />Back
        </button>
        <h2 className="page-title" style={{ margin: 0 }}>
          {isNew ? 'New Policy' : (policy?.title || 'Edit Policy')}
        </h2>
        {policy && (
          <StatusBadge status={policy.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} />
        )}
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} style={{ marginRight: 8 }} />{error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Main form */}
        <div className="card">
          <div className="form-field">
            <label className="form-label">Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input className="form-input" value={form.title} onChange={set('title')} placeholder="e.g. Privacy Policy" />
          </div>
          <div className="form-field">
            <label className="form-label">Slug <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>toca.co.za/</span>
              <input
                className="form-input"
                value={form.slug}
                onChange={set('slug')}
                placeholder="privacy"
                disabled={!isNew}
                style={{ flex: 1 }}
              />
            </div>
            {!isNew && <p className="form-hint">Slug cannot be changed after creation.</p>}
          </div>
          <div className="form-field">
            <label className="form-label">Summary <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional — shown below the title)</span></label>
            <textarea
              className="form-input"
              rows={3}
              value={form.summary}
              onChange={set('summary')}
              placeholder="A short plain-language overview of this policy."
              maxLength={500}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Content <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <p className="form-hint" style={{ marginBottom: 8 }}>
              Enter HTML content. Use &lt;h2&gt; for sections (they build the table of contents), &lt;h3&gt; for subsections, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;.
              Wrap placeholders needing admin approval in: <code>&lt;span class="policy-placeholder"&gt;[PLACEHOLDER]&lt;/span&gt;</code>
            </p>
            <textarea
              className="form-input"
              rows={28}
              value={form.content}
              onChange={set('content')}
              placeholder="<h2>Section One</h2><p>Content here…</p>"
              style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
            />
          </div>
          {!isNew && (
            <div className="form-field">
              <label className="form-label">Change Notes <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional — recorded in version history)</span></label>
              <input className="form-input" value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} placeholder="e.g. Updated returns window to 30 days" />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              <Save size={15} style={{ marginRight: 6 }} />
              {saving ? 'Saving…' : (isNew ? 'Create Policy' : 'Save Changes')}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Status management */}
          {!isNew && policy && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>Status</h3>
              <div style={{ marginBottom: 12 }}>
                <StatusBadge status={policy.status} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} />
              </div>
              {nextStatuses.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <select
                    className="form-input form-input--sm"
                    value={statusTarget}
                    onChange={(e) => setStatusTarget(e.target.value)}
                  >
                    <option value="">Change status to…</option>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={handleStatusChange}
                    disabled={!statusTarget || statusSaving}
                  >
                    {statusSaving ? 'Updating…' : 'Apply Status'}
                  </button>
                </div>
              )}
              {policy.status === 'PUBLISHED' && (
                <p className="form-hint" style={{ marginTop: 8 }}>
                  <AlertTriangle size={12} style={{ marginRight: 4 }} />
                  Archiving will remove this policy from the live website.
                </p>
              )}
            </div>
          )}

          {/* SEO */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>SEO</h3>
            <div className="form-field">
              <label className="form-label">Meta Title <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(max 70 chars)</span></label>
              <input className="form-input form-input--sm" value={form.metaTitle} onChange={set('metaTitle')} maxLength={70} placeholder="Defaults to policy title" />
              <p className="form-hint">{form.metaTitle.length}/70</p>
            </div>
            <div className="form-field">
              <label className="form-label">Meta Description <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(max 180 chars)</span></label>
              <textarea className="form-input form-input--sm" rows={3} value={form.metaDescription} onChange={set('metaDescription')} maxLength={180} />
              <p className="form-hint">{form.metaDescription.length}/180</p>
            </div>
          </div>

          {/* Publishing details */}
          <div className="card">
            <h3 style={{ fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>Publishing</h3>
            <div className="form-field">
              <label className="form-label">Effective Date</label>
              <input className="form-input form-input--sm" type="date" value={form.effectiveDate} onChange={set('effectiveDate')} />
            </div>
            {policy && (
              <>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '8px 0 4px' }}>
                  Version: <strong>v{policy.version}</strong>
                </p>
                {policy.publishedAt && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Published: {new Date(policy.publishedAt).toLocaleDateString('en-ZA')}
                  </p>
                )}
                {policy.status === 'PUBLISHED' && (
                  <a
                    href={`/${policy.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--ghost btn--sm"
                    style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                  >
                    <Eye size={14} style={{ marginRight: 6 }} />View Live Policy
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Version history */}
      {!isNew && policy && (
        <VersionHistory
          policyId={policyId}
          currentVersion={policy.version}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function LegalPolicies() {
  const [view, setView] = useState('list'); // 'list' | 'new' | 'edit'
  const [selectedId, setSelectedId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const goList = () => { setView('list'); setSelectedId(null); setRefreshKey((k) => k + 1); };

  return (
    <div>
      <PageHeader
        title="Legal Policies"
        subtitle="Manage TOCA's published customer-facing legal policies with version history and approval workflow."
        icon={<FileText size={22} />}
      />

      {view === 'list' && (
        <PolicyList
          onSelect={(id) => { setSelectedId(id); setView('edit'); }}
          onNew={() => setView('new')}
          refreshKey={refreshKey}
        />
      )}

      {view === 'new' && (
        <PolicyEditor policyId={null} onBack={goList} onSaved={goList} />
      )}

      {view === 'edit' && selectedId && (
        <PolicyEditor policyId={selectedId} onBack={goList} onSaved={goList} />
      )}
    </div>
  );
}
