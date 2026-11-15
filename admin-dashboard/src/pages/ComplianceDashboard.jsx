import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { sarsApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import {
  FileCheck, Wallet, ArrowLeftRight, Users, Truck, Landmark, Calendar,
  CheckCircle2, XCircle, Plus, Trash2, ExternalLink
} from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ComplianceDashboard() {
  const { showMessage } = useMessaging();
  const { user } = useAuth();
  const isAdminRole = user?.role?.toLowerCase() === 'admin';

  const [summary, setSummary] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newDate, setNewDate] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([sarsApi.complianceSummary(), sarsApi.deadlines.list()]);
      setSummary(s);
      setDeadlines(d);
    } catch (err) {
      console.error('Compliance dashboard fetch failed:', err.message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddDeadline = async (e) => {
    e.preventDefault();
    if (!newLabel.trim() || !newDate) return;
    setAdding(true);
    try {
      await sarsApi.deadlines.add(newLabel.trim(), newDate);
      setNewLabel(''); setNewDate('');
      fetchAll();
    } catch (err) {
      showMessage('error', 'Could Not Add Deadline', err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDeadline = async (id) => {
    try {
      await sarsApi.deadlines.remove(id);
      fetchAll();
    } catch (err) {
      showMessage('error', 'Could Not Remove Deadline', err.message);
    }
  };

  if (loading) return <LoadingState label="Loading compliance dashboard..." />;
  if (!summary) return <p style={{ padding: '24px', color: 'var(--color-text-muted)' }}>Could not load the compliance dashboard — check the server connection.</p>;

  const daysUntil = (dateStr) => Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div className="compliance-dashboard-page">
      <PageHeader
        icon={<FileCheck size={22} />}
        title="SARS Compliance"
        subtitle="A live rollup of what Finance already tracks — not a separate system of record, and not a VAT201 submission itself."
      />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">VAT Vendor Status</span>
            <div className="kpi-icon-wrap icon--revenue"><Landmark size={20} /></div>
          </div>
          <h3 className="kpi-value" style={{ fontSize: '1.1rem' }}>{summary.vatRegistered ? 'Registered' : 'Not Registered'}</h3>
          <p className="kpi-subtext">{summary.vatRegistered ? 'Charging VAT at checkout' : 'Checkout charges no VAT'}</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Current Period Net VAT</span>
            <div className="kpi-icon-wrap icon--revenue"><ArrowLeftRight size={20} /></div>
          </div>
          <h3 className="kpi-value">{fmt(Math.abs(summary.vatSummary.netVatPosition))}</h3>
          <p className="kpi-subtext">{summary.vatSummary.netVatPosition >= 0 ? 'Payable to SARS' : 'Refund position'}{summary.currentPeriod ? ` — ${summary.currentPeriod.label}` : ''}</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Outstanding Receivables</span>
            <div className="kpi-icon-wrap icon--revenue"><Users size={20} /></div>
          </div>
          <h3 className="kpi-value">{fmt(summary.receivablesTotal)}</h3>
          <p className="kpi-subtext"><Link to="/finance/aged">View aged report →</Link></p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Outstanding Payables</span>
            <div className="kpi-icon-wrap icon--revenue"><Truck size={20} /></div>
          </div>
          <h3 className="kpi-value">{fmt(summary.payablesTotal)}</h3>
          <p className="kpi-subtext"><Link to="/finance/aged">View aged report →</Link></p>
        </div>

        <div className="kpi-card" style={{ borderColor: summary.totalUnreconciled > 0 ? 'rgba(192, 57, 43, 0.4)' : '' }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Unreconciled Bank Items</span>
            <div className="kpi-icon-wrap icon--revenue"><Wallet size={20} /></div>
          </div>
          <h3 className="kpi-value">{summary.totalUnreconciled}</h3>
          <p className="kpi-subtext"><Link to="/finance/banking">View banking →</Link></p>
        </div>

        <div className="kpi-card" style={{ borderColor: summary.staleOpenPeriodCount > 0 ? 'rgba(192, 57, 43, 0.4)' : '' }}>
          <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span className="kpi-label">Periods Awaiting Close</span>
            <div className="kpi-icon-wrap icon--revenue"><Calendar size={20} /></div>
          </div>
          <h3 className="kpi-value">{summary.staleOpenPeriodCount}</h3>
          <p className="kpi-subtext">{summary.staleOpenPeriods.length ? summary.staleOpenPeriods.join(', ') : 'All caught up'} — <Link to="/finance/statements">Fiscal Periods →</Link></p>
        </div>
      </div>

      <div className="compliance-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Compliance Readiness</h3>
          <div className="readiness-list">
            <ReadinessRow ok={summary.readiness.businessIdentityComplete} label="Business tax identity complete" hint={!summary.readiness.businessIdentityComplete ? `Missing: ${summary.businessTaxIdentity.missingFields.join(', ')}` : null} link="/settings" />
            <ReadinessRow
              ok={summary.readiness.bankFullyReconciled}
              label="Bank accounts fully reconciled"
              hint={!summary.readiness.bankFullyReconciled ? (summary.bankReconciliation.length === 0 ? 'No bank account configured yet' : `${summary.totalUnreconciled} unmatched item(s)`) : null}
              link="/finance/banking"
            />
            <ReadinessRow ok={summary.readiness.noStalePeriods} label="No fiscal periods overdue for closing" link="/finance/statements" />
          </div>
          <div className="settings-info-box" style={{ marginTop: '16px' }}>
            <span>This reflects data already in Finance — it's a starting point for your own or your accountant's review, not a substitute for it.</span>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Reporting Deadlines</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '-8px', marginBottom: '14px' }}>
            Entered by you or your accountant — this system doesn't know your VAT filing frequency well enough to calculate SARS due dates on its own.
          </p>
          {deadlines.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No deadlines added yet.</p>
          ) : (
            <div className="deadline-list">
              {deadlines.map(d => {
                const days = daysUntil(d.dueDate);
                return (
                  <div key={d.id} className="deadline-row">
                    <div>
                      <strong>{d.label}</strong>
                      <span className="deadline-date">{new Date(d.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {Number.isNaN(days) ? (
                        <StatusBadge tone="error" label="Invalid date" />
                      ) : (
                        <StatusBadge tone={days < 0 ? 'error' : days <= 7 ? 'warning' : 'neutral'} label={days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`} />
                      )}
                      {isAdminRole && (
                        <button className="icon-btn danger" title="Remove" onClick={() => handleRemoveDeadline(d.id)}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {isAdminRole && (
            <form onSubmit={handleAddDeadline} className="deadline-form">
              <input type="text" placeholder="e.g. VAT201 submission" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="admin-input" />
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="admin-input" />
              <button type="submit" className="btn-sm" disabled={adding}><Plus size={13} /> Add</button>
            </form>
          )}
        </div>
      </div>

      <div className="card compliance-links">
        <h3 style={{ marginTop: 0 }}>Related</h3>
        <div className="compliance-links-grid">
          <Link to="/sars/vat" className="compliance-link"><FileCheck size={16} /> VAT Reports <ExternalLink size={12} /></Link>
          <Link to="/finance/statements" className="compliance-link"><Landmark size={16} /> Financial Statements <ExternalLink size={12} /></Link>
          <Link to="/finance/aged" className="compliance-link"><Users size={16} /> Aged Reports <ExternalLink size={12} /></Link>
          <Link to="/settings" className="compliance-link"><Wallet size={16} /> Tax Settings <ExternalLink size={12} /></Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .compliance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--sp-6); margin-top: var(--sp-6); }
        .readiness-list { display: flex; flex-direction: column; gap: 10px; }
        .compliance-links { margin-top: var(--sp-6); }
        .compliance-links-grid { display: flex; flex-wrap: wrap; gap: var(--sp-3); }
        .compliance-link {
          display: flex; align-items: center; gap: var(--sp-2); padding: 10px var(--sp-4);
          background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-secondary); font-size: 0.85rem; text-decoration: none; transition: all var(--t-fast, .18s) var(--ease, ease);
        }
        .compliance-link:hover { color: var(--y-base); border-color: var(--y-base); }
        .settings-info-box {
          display: flex; align-items: center; gap: var(--sp-2);
          background: rgba(var(--y-rgb),0.08); border: 1px solid rgba(var(--y-rgb),0.2);
          padding: var(--sp-3); border-radius: var(--r); font-size: 0.8rem; color: var(--text-muted);
        }
        .deadline-list { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
        .deadline-row { display: flex; justify-content: space-between; align-items: center; padding: 10px var(--sp-3); background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); }
        .deadline-date { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
        .deadline-form { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
        .deadline-form .admin-input { flex: 1; min-width: 140px; }

        @media (max-width: 480px) {
          .compliance-grid { grid-template-columns: 1fr; gap: var(--sp-4); }
          .deadline-row { flex-wrap: wrap; gap: var(--sp-2); }
        }
      `}} />
    </div>
  );
}

function ReadinessRow({ ok, label, hint, link }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.88rem' }}>
      {ok ? <CheckCircle2 size={18} color="#2ecc71" style={{ flexShrink: 0, marginTop: '1px' }} /> : <XCircle size={18} color="var(--color-error-text)" style={{ flexShrink: 0, marginTop: '1px' }} />}
      <div>
        <span>{label}</span>
        {!ok && hint && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{hint} — <Link to={link}>fix →</Link></div>}
        {!ok && !hint && link && <div style={{ fontSize: '0.78rem' }}><Link to={link}>fix →</Link></div>}
      </div>
    </div>
  );
}

export default ComplianceDashboard;
