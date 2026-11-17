import { useState, useEffect, useCallback, useRef } from 'react';
import { financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { ExportButtons } from '../components/ExportButtons';
import { BookOpen, Eye } from 'lucide-react';

const TYPE_SECTIONS = [
  { type: 'ASSET', label: 'Assets' },
  { type: 'LIABILITY', label: 'Liabilities' },
  { type: 'EQUITY', label: 'Equity' },
  { type: 'REVENUE', label: 'Revenue' },
  { type: 'EXPENSE', label: 'Expenses' },
];

const fmt = (n) => `R${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Account' },
  { key: 'debit', label: 'Debit', render: fmt },
  { key: 'credit', label: 'Credit', render: fmt },
  { key: 'balance', label: 'Balance', render: (v) => <strong>{fmt(v)}</strong> },
];

export function GeneralLedger() {
  const [asOf, setAsOf] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    try {
      const result = await financeApi.trialBalance(asOf || undefined);
      setData(result);
    } catch (err) {
      console.error('Trial balance fetch failed:', err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { fetchTrialBalance(); }, [fetchTrialBalance]);

  // Guards against an out-of-order response: click Account A, then quickly
  // click Account B before A's fetch resolves — without this, a slow A
  // response arriving after B's fast one would silently overwrite B's
  // correctly-loaded rows while the drawer title still reads B.
  const requestIdRef = useRef(0);

  const openLedger = async (account) => {
    const requestId = ++requestIdRef.current;
    setSelectedAccount(account);
    setLedgerLoading(true);
    try {
      const result = await financeApi.ledger(account.code, asOf ? { to: asOf } : {});
      if (requestIdRef.current !== requestId) return; // a newer request has since started
      setLedgerEntries(result);
    } catch (err) {
      console.error('Ledger fetch failed:', err.message);
      if (requestIdRef.current === requestId) setLedgerEntries(null);
    } finally {
      if (requestIdRef.current === requestId) setLedgerLoading(false);
    }
  };

  return (
    <div className="ledger-page">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="General Ledger"
        subtitle="Every account's cumulative balance, computed live from the posted journals — never a separately stored copy."
        actions={(
          <>
            <label className="ledger-asof">
              As of
              <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="admin-input" />
            </label>
            <ExportButtons path="/admin/finance/trial-balance" params={asOf ? { asOf } : {}} filename={`trial-balance${asOf ? '-' + asOf : ''}`} />
          </>
        )}
      />

      {loading ? (
        <LoadingState label="Loading trial balance..." />
      ) : !data ? (
        <EmptyState title="Trial balance unavailable" description="Could not load the general ledger — check the server connection." />
      ) : (
        <>
          <div className="ledger-totals card">
            <span>Total Debits: <strong>{fmt(data.totalDebit)}</strong></span>
            <span>Total Credits: <strong>{fmt(data.totalCredit)}</strong></span>
          </div>

          {TYPE_SECTIONS.map(section => {
            const rows = data.accounts.filter(a => a.type === section.type);
            if (rows.length === 0) return null;
            return (
              <div className="card ledger-section" key={section.type}>
                <h3>{section.label}</h3>
                <DataTable
                  columns={COLUMNS}
                  data={rows}
                  caption={`${section.label} accounts`}
                  actions={(row) => (
                    <button className="icon-btn" title="View entries" onClick={() => openLedger(row)}>
                      <Eye size={14} />
                    </button>
                  )}
                  mobileCardRenderer={(row, _cols, actions) => (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
                        <div>
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: '.8rem', color: 'var(--y-base)' }}>{row.code}</span>
                          <p style={{ fontWeight: 600, margin: '2px 0 0' }}>{row.name}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                          <strong style={{ fontFamily: 'var(--f-mono)', fontSize: '.9rem' }}>{fmt(row.balance)}</strong>
                          {actions && actions(row)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--sp-5)', fontSize: '.8rem', color: 'var(--text-muted)', fontFamily: 'var(--f-mono)' }}>
                        <span>Dr {fmt(row.debit)}</span>
                        <span>Cr {fmt(row.credit)}</span>
                      </div>
                    </div>
                  )}
                />
              </div>
            );
          })}
        </>
      )}

      <Drawer
        isOpen={!!selectedAccount}
        onClose={() => { setSelectedAccount(null); setLedgerEntries(null); }}
        title={selectedAccount ? `${selectedAccount.code} — ${selectedAccount.name}` : ''}
        width={560}
      >
        {ledgerLoading ? (
          <LoadingState label="Loading entries..." />
        ) : ledgerEntries?.entries?.length ? (
          <>
          <div style={{ marginBottom: '12px' }}>
            <ExportButtons path={`/admin/finance/ledger/${selectedAccount?.code}`} params={asOf ? { to: asOf } : {}} filename={`ledger-${selectedAccount?.code}`} />
          </div>
          <DataTable
            columns={[
              { key: 'journalNumber', label: 'Journal' },
              { key: 'date', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit', render: fmt },
              { key: 'credit', label: 'Credit', render: fmt },
              { key: 'runningBalance', label: 'Balance', render: fmt },
            ]}
            data={ledgerEntries.entries}
          />
          </>
        ) : (
          <EmptyState title="No entries" description="No journal lines have posted to this account yet." />
        )}
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .ledger-asof { display: flex; align-items: center; gap: var(--sp-2); font-size: 0.8rem; color: var(--text-muted); }
        .ledger-totals { display: flex; gap: var(--sp-6); margin-bottom: var(--sp-6); font-size: 0.85rem; flex-wrap: wrap; }
        .ledger-section { margin-bottom: var(--sp-6); }
        .ledger-section h3 { margin: 0 0 var(--sp-3); font-size: 1rem; font-weight: 400; }

        @media (max-width: 480px) {
          .ledger-totals { gap: var(--sp-4); }
          .ledger-asof { width: 100%; flex-wrap: wrap; }
        }
      `}} />
    </div>
  );
}

export default GeneralLedger;
