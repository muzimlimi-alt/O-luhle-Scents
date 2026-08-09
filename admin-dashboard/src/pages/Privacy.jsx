import { useState, useEffect, useCallback } from 'react';
import { adminPrivacyApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { LoadingState } from '../components/LoadingState';
import { Lock, Inbox, ShieldAlert, UserX, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STATUS_TONE = {
  submitted: 'warning',
  in_review: 'info',
  approved: 'success',
  rejected: 'error',
  completed: 'neutral',
};

const TYPE_LABEL = { access: 'Access', correction: 'Correction', deletion: 'Deletion', objection: 'Objection', portability: 'Portability' };

const PURPOSE_LABEL = {
  marketing_email: 'Marketing email',
  cookie_analytics: 'Analytics cookies',
  cookie_marketing: 'Marketing cookies',
  cookie_preferences: 'Preference cookies',
  testimonial_display: 'Testimonial display',
};

export function Privacy() {
  const { user } = useAuth();
  const isAdminRole = user?.role?.toLowerCase() === 'admin';

  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [consentStats, setConsentStats] = useState(null);
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveStatus, setResolveStatus] = useState('in_review');
  const [resolveNotes, setResolveNotes] = useState('');
  const [editPolicy, setEditPolicy] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [summaryData, requestsData, statsData, policiesData] = await Promise.all([
        adminPrivacyApi.summary(),
        adminPrivacyApi.requests.list(statusFilter ? { status: statusFilter } : {}),
        adminPrivacyApi.consentStats(),
        adminPrivacyApi.retentionPolicies.list(),
      ]);
      setSummary(summaryData);
      setRequests(requestsData);
      setConsentStats(statsData);
      setRetentionPolicies(policiesData);
    } catch (err) {
      console.error('Privacy module failed to load:', err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function openResolve(request) {
    setResolveTarget(request);
    setResolveStatus(request.status === 'submitted' ? 'in_review' : request.status);
    setResolveNotes(request.resolutionNotes || '');
  }

  async function submitResolve() {
    try {
      await adminPrivacyApi.requests.resolve(resolveTarget.id, { status: resolveStatus, resolutionNotes: resolveNotes });
      setResolveTarget(null);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveRetentionPolicy(policy, retentionDays, autoDelete) {
    try {
      await adminPrivacyApi.retentionPolicies.update(policy.category, { retentionDays, autoDelete });
      setEditPolicy(null);
      loadAll();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <LoadingState label="Loading Privacy & POPIA module..." />;

  const requestColumns = [
    { key: 'customer', label: 'Customer', render: (val) => (
      <div><p style={{ fontWeight: 600 }}>{val?.name || 'Unknown'}</p><p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{val?.email}</p></div>
    ) },
    { key: 'type', label: 'Request Type', render: (val) => TYPE_LABEL[val] || val },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge tone={STATUS_TONE[val] || 'neutral'} label={val.replace('_', ' ')} /> },
    { key: 'requestedAt', label: 'Submitted', render: (val) => new Date(val).toLocaleDateString() },
    { key: 'details', label: 'Details', render: (val) => <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{val ? (val.length > 60 ? val.slice(0, 60) + '…' : val) : '—'}</span> },
  ];

  return (
    <div className="privacy-page">
      <PageHeader
        icon={<Lock size={22} />}
        title="Privacy & POPIA Management"
        subtitle="Data subject requests, consent records, and retention policy — the compliance module for South Africa's Protection of Personal Information Act."
      />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Open Requests</span>
            <div className="kpi-icon-wrap icon--revenue"><Inbox size={20} /></div>
          </div>
          <h3 className="kpi-value">{summary?.openRequests ?? 0}</h3>
          <p className="kpi-subtext">Submitted or in review</p>
        </div>
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Deletion Requests Pending</span>
            <div className="kpi-icon-wrap icon--revenue"><UserX size={20} /></div>
          </div>
          <h3 className="kpi-value">{summary?.openRequestsByType?.find(r => r.type === 'deletion')?.count ?? 0}</h3>
          <p className="kpi-subtext">Awaiting Administrator approval</p>
        </div>
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Marketing Opt-Outs (30d)</span>
            <div className="kpi-icon-wrap icon--revenue"><ShieldAlert size={20} /></div>
          </div>
          <h3 className="kpi-value">{summary?.recentConsentRevocations ?? 0}</h3>
          <p className="kpi-subtext">Consent revocations, any purpose</p>
        </div>
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Retention Policies</span>
            <div className="kpi-icon-wrap icon--revenue"><Clock size={20} /></div>
          </div>
          <h3 className="kpi-value">{retentionPolicies.length}</h3>
          <p className="kpi-subtext">{retentionPolicies.filter(p => p.autoDelete).length} on auto-purge</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>Data Subject Requests</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <DataTable
          columns={requestColumns}
          data={requests}
          actions={(row) => (
            <button className="btn-sm" onClick={() => openResolve(row)}>Review</button>
          )}
        />
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Consent by Purpose</h3>
        <div className="table-wrapper">
          <div className="table-scroll">
            <table className="modern-table">
              <thead><tr><th>Purpose</th><th>Subjects with a decision on file</th><th>Currently granted</th></tr></thead>
              <tbody>
                {Object.entries(consentStats || {}).map(([purpose, stat]) => (
                  <tr key={purpose}>
                    <td>{PURPOSE_LABEL[purpose] || purpose}</td>
                    <td>{stat.totalSubjects}</td>
                    <td>{stat.currentlyGranted} ({stat.totalSubjects ? Math.round((stat.currentlyGranted / stat.totalSubjects) * 100) : 0}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '6px' }}>Retention Policy</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          How long each category of data is kept. "Auto-purge" categories are cleared by a scheduled job once past their window; the rest are flagged for manual review only.
        </p>
        <div className="table-wrapper">
          <div className="table-scroll">
            <table className="modern-table">
              <thead><tr><th>Category</th><th>Retention</th><th>Auto-purge</th>{isAdminRole && <th>Actions</th>}</tr></thead>
              <tbody>
                {retentionPolicies.map((policy) => (
                  <tr key={policy.id}>
                    <td><p style={{ fontWeight: 600 }}>{policy.label}</p><p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{policy.description}</p></td>
                    <td>{policy.retentionDays} days</td>
                    <td><StatusBadge tone={policy.autoDelete ? 'success' : 'neutral'} label={policy.autoDelete ? 'On' : 'Off'} /></td>
                    {isAdminRole && <td><button className="btn-sm" onClick={() => setEditPolicy(policy)}>Edit</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={!!resolveTarget} onClose={() => setResolveTarget(null)} title={`Review ${resolveTarget ? TYPE_LABEL[resolveTarget.type] : ''} Request`}>
        {resolveTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {resolveTarget.customer?.name} ({resolveTarget.customer?.email}) — submitted {new Date(resolveTarget.requestedAt).toLocaleString()}
            </p>
            {resolveTarget.details && <p style={{ fontSize: '0.85rem', background: 'var(--color-surface)', padding: '10px 12px', borderRadius: '8px' }}>{resolveTarget.details}</p>}
            {resolveTarget.type === 'deletion' && (
              <p style={{ fontSize: '0.8rem', color: '#c0392b' }}>
                Approving this anonymises the customer's name, email, and phone. Orders/payments are kept for financial record-keeping.
                {!isAdminRole && ' Only an Administrator account can approve a deletion.'}
              </p>
            )}
            <label>Status
              <select value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '6px' }}>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>Resolution Notes
              <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={3} style={{ display: 'block', width: '100%', marginTop: '6px' }} />
            </label>
            <button className="btn-primary" onClick={submitResolve}>Save</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!editPolicy} onClose={() => setEditPolicy(null)} title={`Edit Retention: ${editPolicy?.label || ''}`}>
        {editPolicy && (
          <RetentionEditForm policy={editPolicy} onSave={saveRetentionPolicy} />
        )}
      </Modal>
    </div>
  );
}

function RetentionEditForm({ policy, onSave }) {
  const [days, setDays] = useState(policy.retentionDays);
  const [autoDelete, setAutoDelete] = useState(policy.autoDelete);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <label>Retention (days)
        <input type="number" min="1" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: '6px' }} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" checked={autoDelete} onChange={(e) => setAutoDelete(e.target.checked)} />
        Auto-purge once past retention window
      </label>
      <button className="btn-primary" onClick={() => onSave(policy, days, autoDelete)}>Save</button>
    </div>
  );
}

export default Privacy;
