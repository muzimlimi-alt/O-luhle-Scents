import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bankingApi, financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { FormField } from '../components/FormField';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { useMessaging } from '../context/MessagingContext';
import { Scale, ArrowLeft, Link2, Wand2, Upload } from 'lucide-react';

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY_MAPPING = {
  dateColumn: '', descriptionColumn: '', referenceColumn: '',
  amountMode: 'single', amountColumn: '', debitColumn: '', creditColumn: '',
  dateFormat: 'dd/MM/yyyy',
};

// Header-row-only preview split — handles simple quoted fields well enough
// to populate the column-mapping dropdowns. The real import re-parses the
// full file server-side with csv-parse, which is what actually matters for
// correctness; this is just so the admin sees real header names to map from.
function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
    current += ch;
  }
  cells.push(current);
  return cells.map(c => c.trim());
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importMapping, setImportMapping] = useState(EMPTY_MAPPING);
  const [importSubmitting, setImportSubmitting] = useState(false);

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

  const openImportDrawer = () => {
    setImportFile(null);
    setImportHeaders([]);
    setImportMapping(EMPTY_MAPPING);
    setShowImportDrawer(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const firstLine = String(reader.result).split(/\r?\n/)[0] || '';
      setImportHeaders(splitCsvLine(firstLine));
    };
    reader.readAsText(file.slice(0, 4096)); // header row only — plenty of room even for wide statements
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return showMessage('warning', 'No File', 'Choose a CSV file to import.');
    if (importMapping.dateColumn === '' || importMapping.descriptionColumn === '') {
      return showMessage('warning', 'Missing Mapping', 'Date and Description columns are required.');
    }
    if (importMapping.amountMode === 'single' && importMapping.amountColumn === '') {
      return showMessage('warning', 'Missing Mapping', 'Select the Amount column.');
    }
    if (importMapping.amountMode === 'separate' && (importMapping.debitColumn === '' || importMapping.creditColumn === '')) {
      return showMessage('warning', 'Missing Mapping', 'Select both the Debit and Credit columns.');
    }

    setImportSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('statement', importFile);
      formData.append('mapping', JSON.stringify(importMapping));
      const result = await bankingApi.transactions.import(accountId, formData);
      setShowImportDrawer(false);
      showMessage('success', 'Statement Imported',
        `${result.imported} line${result.imported === 1 ? '' : 's'} imported, ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'} skipped` +
        (result.skippedInvalidRows ? `, ${result.skippedInvalidRows} row(s) could not be read.` : '.'));
      fetchData();
    } catch (err) {
      showMessage('error', 'Import Failed', err.message);
    } finally {
      setImportSubmitting(false);
    }
  };

  // Sort/badge only — the admin still explicitly clicks "Select" to confirm
  // a match. Amount within 1 cent and journal date within 7 days of the
  // statement line's date.
  const sortedLinesForMatch = matchingTxn
    ? [...(data?.unmatchedJournalLines || [])]
        .map(line => {
          const lineAmount = Number(line.debit) || Number(line.credit) || 0;
          const amountMatches = Math.abs(lineAmount - Math.abs(matchingTxn.amount)) < 0.01;
          const daysApart = Math.abs(new Date(line.journal.date) - new Date(matchingTxn.date)) / DAY_MS;
          return { ...line, __likelyMatch: amountMatches && daysApart <= 7 };
        })
        .sort((a, b) => (b.__likelyMatch === a.__likelyMatch ? 0 : b.__likelyMatch ? 1 : -1))
    : [];

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

  const matchLineColumns = [
    { key: '__likelyMatch', label: '', render: (v) => v ? <StatusBadge tone="success" label="Likely match" /> : null },
    ...lineColumns,
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
            <button className="btn btn--primary" onClick={openImportDrawer}>
              <Upload size={16} /> Import Statement
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
            columns={matchLineColumns}
            data={sortedLinesForMatch}
            emptyState={<EmptyState title="No unmatched ledger postings" description="Nothing to match this against yet." />}
            actions={(row) => (
              <button className="btn btn--sm btn--primary" disabled={submitting} onClick={() => handleMatch(row.id)}>
                Select
              </button>
            )}
          />
        )}
      </Drawer>

      <Drawer isOpen={showImportDrawer} onClose={() => setShowImportDrawer(false)} title="Import Bank Statement" width={480}>
        <form onSubmit={handleImportSubmit} className="admin-form">
          <FormField label="Statement File (CSV)" required hint="Export a CSV statement from your bank's online portal.">
            <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} required />
          </FormField>

          {importHeaders.length > 0 && (
            <>
              <FormField label="Date Column" required>
                <select value={importMapping.dateColumn} onChange={e => setImportMapping(m => ({ ...m, dateColumn: e.target.value }))} required>
                  <option value="">Select column...</option>
                  {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </FormField>
              <FormField label="Date Format">
                <select value={importMapping.dateFormat} onChange={e => setImportMapping(m => ({ ...m, dateFormat: e.target.value }))}>
                  <option value="dd/MM/yyyy">DD/MM/YYYY (South Africa)</option>
                  <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                  <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                </select>
              </FormField>
              <FormField label="Description Column" required>
                <select value={importMapping.descriptionColumn} onChange={e => setImportMapping(m => ({ ...m, descriptionColumn: e.target.value }))} required>
                  <option value="">Select column...</option>
                  {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </FormField>
              <FormField label="Amount Layout">
                <select value={importMapping.amountMode} onChange={e => setImportMapping(m => ({ ...m, amountMode: e.target.value }))}>
                  <option value="single">Single signed amount column</option>
                  <option value="separate">Separate Debit / Credit columns</option>
                </select>
              </FormField>
              {importMapping.amountMode === 'single' ? (
                <FormField label="Amount Column" required hint="Positive = money in, negative = money out.">
                  <select value={importMapping.amountColumn} onChange={e => setImportMapping(m => ({ ...m, amountColumn: e.target.value }))} required>
                    <option value="">Select column...</option>
                    {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </FormField>
              ) : (
                <div className="reconciliation-import-row">
                  <FormField label="Debit Column (money out)" required>
                    <select value={importMapping.debitColumn} onChange={e => setImportMapping(m => ({ ...m, debitColumn: e.target.value }))} required>
                      <option value="">Select column...</option>
                      {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Credit Column (money in)" required>
                    <select value={importMapping.creditColumn} onChange={e => setImportMapping(m => ({ ...m, creditColumn: e.target.value }))} required>
                      <option value="">Select column...</option>
                      {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </FormField>
                </div>
              )}
              <FormField label="Reference Column (optional)">
                <select value={importMapping.referenceColumn} onChange={e => setImportMapping(m => ({ ...m, referenceColumn: e.target.value }))}>
                  <option value="">None</option>
                  {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </FormField>
            </>
          )}

          <div className="banking-actions">
            <button type="button" className="btn" onClick={() => setShowImportDrawer(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={importSubmitting || !importFile}>
              {importSubmitting ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
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
        .reconciliation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--sp-5); align-items: start; }
        .reconciliation-grid h3 { margin: 0 0 var(--sp-3); font-size: 1rem; font-weight: 400; }
        .reconciliation-adjust-summary { font-size: 0.82rem; color: var(--text-muted); margin-bottom: var(--sp-5); line-height: 1.6; }
        .reconciliation-import-row { display: flex; gap: var(--sp-4); }
        .reconciliation-import-row .form-field { flex: 1; }
        .banking-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }
        .page-header__actions .admin-input { width: auto; }

        @media (max-width: 760px) {
          .reconciliation-grid { grid-template-columns: 1fr; }
          .reconciliation-import-row { flex-direction: column; gap: var(--sp-2); }
        }
      `}} />
    </div>
  );
}

export default Reconciliation;
