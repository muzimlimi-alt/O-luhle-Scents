import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bankingApi, financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { FormField } from '../components/FormField';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import { Scale, ArrowLeft, Link2, Wand2 } from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Reconciliation() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { showMessage } = useMessaging();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartOptions, setChartOptions] = useState([]);

  const [matchingTxn, setMatchingTxn] = useState(null);
  const [adjustingTxn, setAdjustingTxn] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ offsetAccountCode: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      setData(await bankingApi.reconciliation(accountId, params));
    } catch (err) {
      console.error('Reconciliation fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { financeApi.chartOfAccounts().then(setChartOptions).catch(() => setChartOptions([])); }, []);

  const handleMatch = async (journalLineId) => {
    setSubmitting(true);
    try {
      await bankingApi.transactions.match(matchingTxn.id, journalLineId);
      setMatchingTxn(null);
      showMessage('success', 'Matched', 'Statement line matched to the ledger entry.');
      fetchData();
    } catch (err) {
      showMessage('error', 'Match Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAdjust = (txn) => {
    setAdjustingTxn(txn);
    setAdjustForm({ offsetAccountCode: '', description: txn.description });
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustForm.offsetAccountCode) return showMessage('warning', 'Missing Account', 'Select which account this offsets.');
    setSubmitting(true);
    try {
      await bankingApi.transactions.adjust(adjustingTxn.id, adjustForm);
      setAdjustingTxn(null);
      showMessage('success', 'Adjustment Posted', 'A balancing journal was posted and matched.');
      fetchData();
    } catch (err) {
      showMessage('error', 'Adjustment Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const txnColumns = [
    { key: 'date', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: (v) => <span style={{ color: v >= 0 ? '#2ecc71' : 'var(--color-error-text)' }}>{fmt(v)}</span> },
    { key: 'reference', label: 'Reference', render: (v) => v || '—' },
  ];

  const lineColumns = [
    { key: 'journalNumber', label: 'Journal', render: (_, row) => row.journal.journalNumber },
    { key: 'journalDate', label: 'Date', render: (_, row) => new Date(row.journal.date).toLocaleDateString() },
    { key: 'journalDescription', label: 'Description', render: (_, row) => row.journal.description },
    { key: 'debit', label: 'Debit', render: fmt },
    { key: 'credit', label: 'Credit', render: fmt },
  ];

  return (
    <div className="reconciliation-page">
      <PageHeader
        icon={<Scale size={22} />}
        title={data?.bankAccount ? `Reconcile — ${data.bankAccount.name}` : 'Reconcile'}
        subtitle="Match statement lines against General Ledger postings. Match what you can; explain the rest with an adjustment."
        actions={(
          <>
            <button className="btn btn--outline" onClick={() => navigate('/finance/banking')}>
              <ArrowLeft size={16} /> Back to Banking
            </button>
            <input type="date" className="admin-input" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
            <input type="date" className="admin-input" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
          </>
        )}
      />

      {loading ? (
        <LoadingState label="Loading reconciliation..." />
      ) : !data ? (
        <EmptyState title="Could not load reconciliation" description="Check the server connection and try again." />
      ) : (
        <div className="reconciliation-grid">
          <div className="card">
            <h3>Unmatched Bank Transactions ({data.unmatchedTransactions.length})</h3>
            <DataTable
              columns={txnColumns}
              data={data.unmatchedTransactions}
              emptyState={<EmptyState title="All caught up" description="Every statement line has been matched." />}
              actions={(row) => (
                <>
                  <button className="icon-btn" title="Match to a ledger entry" onClick={() => setMatchingTxn(row)}>
                    <Link2 size={14} />
                  </button>
                  <button className="icon-btn" title="Record adjustment (bank-only item)" onClick={() => openAdjust(row)}>
                    <Wand2 size={14} />
                  </button>
                </>
              )}
            />
          </div>

          <div className="card">
            <h3>Unmatched Ledger Postings ({data.unmatchedJournalLines.length})</h3>
            <DataTable
              columns={lineColumns}
              data={data.unmatchedJournalLines}
              emptyState={<EmptyState title="All caught up" description="Every posted line has a matching statement entry." />}
            />
          </div>
        </div>
      )}

      <Drawer isOpen={!!matchingTxn} onClose={() => setMatchingTxn(null)} title={matchingTxn ? `Match "${matchingTxn.description}" (${fmt(matchingTxn.amount)})` : ''} width={560}>
        {matchingTxn && (
          <DataTable
            columns={lineColumns}
            data={data?.unmatchedJournalLines || []}
            emptyState={<EmptyState title="No unmatched ledger postings" description="Nothing to match this against yet." />}
            actions={(row) => (
              <button className="btn btn--sm btn--primary" disabled={submitting} onClick={() => handleMatch(row.id)}>
                Select
              </button>
            )}
          />
        )}
      </Drawer>

      <Drawer isOpen={!!adjustingTxn} onClose={() => setAdjustingTxn(null)} title="Record Adjustment" width={440}>
        {adjustingTxn && (
          <form onSubmit={handleAdjustSubmit} className="admin-form">
            <p className="reconciliation-adjust-summary">
              {adjustingTxn.description} — <strong>{fmt(adjustingTxn.amount)}</strong>
              <br />
              Posts a balancing journal against this bank account and matches it automatically.
            </p>
            <FormField label="Offsets Which Account" required>
              <select value={adjustForm.offsetAccountCode} onChange={e => setAdjustForm(f => ({ ...f, offsetAccountCode: e.target.value }))} required>
                <option value="">Select account...</option>
                {chartOptions.filter(a => a.type !== 'ASSET' || a.code !== data?.bankAccount?.chartAccountCode).map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Description">
              <input type="text" value={adjustForm.description} onChange={e => setAdjustForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>
            <div className="banking-actions">
              <button type="button" className="btn" onClick={() => setAdjustingTxn(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Posting...' : 'Post & Match'}
              </button>
            </div>
          </form>
        )}
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .reconciliation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; align-items: start; }
        .reconciliation-grid h3 { margin: 0 0 12px; font-size: 1rem; }
        .reconciliation-adjust-summary { font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: 20px; line-height: 1.6; }
        .banking-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
        .page-header__actions .admin-input { width: auto; }
      `}} />
    </div>
  );
}

export default Reconciliation;
