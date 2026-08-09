import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bankingApi, financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { FormField } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import { Landmark, Plus, ArrowLeftRight, Scale, Pencil, Star } from 'lucide-react';

const EMPTY_ACCOUNT_FORM = {
  name: '', bankName: '', accountHolder: '', accountNumber: '', branchCode: '', accountType: '', swift: '', chartAccountCode: '', isDefault: false
};
const EMPTY_TXN_FORM = { date: '', description: '', amount: '', reference: '' };

export function Banking() {
  const navigate = useNavigate();
  const { showMessage } = useMessaging();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartOptions, setChartOptions] = useState([]);

  const [showAccountDrawer, setShowAccountDrawer] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyAccountId, setBusyAccountId] = useState(null);

  const [txnAccount, setTxnAccount] = useState(null);
  const [txnForm, setTxnForm] = useState(EMPTY_TXN_FORM);
  const [txnSubmitting, setTxnSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bankingApi.accounts.list();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Bank accounts fetch failed:', err.message);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    financeApi.chartOfAccounts().then(setChartOptions).catch(() => setChartOptions([]));
  }, [fetchAccounts]);

  const openAccountDrawer = () => {
    setEditingId(null);
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setShowAccountDrawer(true);
  };

  const openEditDrawer = (account) => {
    setEditingId(account.id);
    setAccountForm({
      name: account.name, bankName: account.bankName || '', accountHolder: account.accountHolder || '',
      accountNumber: account.accountNumber || '', branchCode: account.branchCode || '', accountType: account.accountType || '',
      swift: account.swift || '', chartAccountCode: account.chartAccountCode, isDefault: account.isDefault
    });
    setShowAccountDrawer(true);
  };

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!accountForm.name || !accountForm.chartAccountCode) {
      return showMessage('warning', 'Missing Fields', 'Name and linked GL account are required.');
    }
    setAccountSubmitting(true);
    try {
      if (editingId) {
        // isDefault is intentionally not part of this payload — it's only
        // ever changed via the dedicated "Set as Default" action, which
        // enforces exclusivity across all accounts.
        const { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift } = accountForm;
        await bankingApi.accounts.update(editingId, { name, bankName, accountHolder, accountNumber, branchCode, accountType, swift });
      } else {
        await bankingApi.accounts.create(accountForm);
      }
      setShowAccountDrawer(false);
      fetchAccounts();
    } catch (err) {
      showMessage('error', editingId ? 'Update Failed' : 'Create Failed', err.message);
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleSetDefault = async (account) => {
    setBusyAccountId(account.id);
    try {
      await bankingApi.accounts.setDefault(account.id);
      showMessage('success', 'Default Updated', `${account.name} is now the default account shown to EFT customers.`);
      fetchAccounts();
    } catch (err) {
      showMessage('error', 'Failed', err.message);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleToggleActive = async (account) => {
    setBusyAccountId(account.id);
    try {
      await bankingApi.accounts.update(account.id, { isActive: !account.isActive });
      fetchAccounts();
    } catch (err) {
      showMessage('error', 'Failed', err.message);
    } finally {
      setBusyAccountId(null);
    }
  };

  const openTxnDrawer = (account) => {
    setTxnAccount(account);
    setTxnForm(EMPTY_TXN_FORM);
  };

  const handleTxnSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(txnForm.amount);
    if (!txnForm.date || !txnForm.description || !Number.isFinite(amount) || amount === 0) {
      return showMessage('warning', 'Missing Fields', 'Date, description, and a non-zero amount are required.');
    }
    setTxnSubmitting(true);
    try {
      await bankingApi.transactions.create(txnAccount.id, { ...txnForm, amount });
      setTxnAccount(null);
      showMessage('success', 'Transaction Added', 'Statement line recorded — reconcile it from the Reconcile action.');
    } catch (err) {
      showMessage('error', 'Add Failed', err.message);
    } finally {
      setTxnSubmitting(false);
    }
  };

  const assetAccounts = chartOptions.filter(a => a.type === 'ASSET');

  const columns = [
    { key: 'name', label: 'Account', render: (val, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
        <Landmark size={14} color="var(--color-primary)" /> {val}
        {row.isDefault && <StatusBadge tone="info" label="Default" />}
      </div>
    )},
    { key: 'bankName', label: 'Bank', render: (val) => val || '—' },
    { key: 'accountNumber', label: 'Account #', render: (val) => val || '—' },
    { key: 'chartAccountCode', label: 'GL Account' },
    { key: 'isActive', label: 'Status', render: (val, row) => (
      <button
        className="icon-btn banking-status-toggle"
        title={val ? 'Click to deactivate' : 'Click to activate'}
        disabled={busyAccountId === row.id}
        onClick={() => handleToggleActive(row)}
      >
        <StatusBadge tone={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} />
      </button>
    )},
  ];

  return (
    <div className="banking-page">
      <PageHeader
        icon={<Landmark size={22} />}
        title="Banking"
        subtitle="Bank accounts and the statement lines reconciled against the General Ledger."
        actions={(
          <button className="btn btn--primary" onClick={openAccountDrawer}>
            <Plus size={16} /> Add Bank Account
          </button>
        )}
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={accounts}
          loading={loading}
          emptyState={<EmptyState icon={<Landmark size={40} />} title="No bank accounts yet" description="Add one to start recording statement lines and reconciling against the ledger." />}
          actions={(row) => (
            <>
              <button className="icon-btn" title="Edit" onClick={() => openEditDrawer(row)}>
                <Pencil size={14} />
              </button>
              {!row.isDefault && (
                <button className="icon-btn" title="Set as Default" disabled={busyAccountId === row.id} onClick={() => handleSetDefault(row)}>
                  <Star size={14} />
                </button>
              )}
              <button className="icon-btn" title="Add Transaction" onClick={() => openTxnDrawer(row)}>
                <ArrowLeftRight size={14} />
              </button>
              <button className="icon-btn" title="Reconcile" onClick={() => navigate(`/finance/reconciliation/${row.id}`)}>
                <Scale size={14} />
              </button>
            </>
          )}
        />
      </div>

      <Drawer isOpen={showAccountDrawer} onClose={() => setShowAccountDrawer(false)} title={editingId ? 'Edit Bank Account' : 'Add Bank Account'} width={480}>
        <form onSubmit={handleAccountSubmit} className="admin-form">
          <FormField label="Name" required>
            <input type="text" value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} required placeholder="Primary Business Account" />
          </FormField>
          <FormField label="Linked GL Account" required hint="Which chart-of-accounts row this bank account's cash movements post to.">
            <select value={accountForm.chartAccountCode} onChange={e => setAccountForm(f => ({ ...f, chartAccountCode: e.target.value }))} required>
              <option value="">Select account...</option>
              {assetAccounts.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Bank Name">
            <input type="text" value={accountForm.bankName} onChange={e => setAccountForm(f => ({ ...f, bankName: e.target.value }))} />
          </FormField>
          <FormField label="Account Holder">
            <input type="text" value={accountForm.accountHolder} onChange={e => setAccountForm(f => ({ ...f, accountHolder: e.target.value }))} />
          </FormField>
          <FormField label="Account Number">
            <input type="text" value={accountForm.accountNumber} onChange={e => setAccountForm(f => ({ ...f, accountNumber: e.target.value }))} />
          </FormField>
          <FormField label="Branch Code">
            <input type="text" value={accountForm.branchCode} onChange={e => setAccountForm(f => ({ ...f, branchCode: e.target.value }))} />
          </FormField>
          <FormField label="Account Type">
            <input type="text" value={accountForm.accountType} onChange={e => setAccountForm(f => ({ ...f, accountType: e.target.value }))} placeholder="Cheque / Savings" />
          </FormField>
          <FormField label="SWIFT">
            <input type="text" value={accountForm.swift} onChange={e => setAccountForm(f => ({ ...f, swift: e.target.value }))} />
          </FormField>
          {!editingId && (
            <label className="banking-default-check">
              <input type="checkbox" checked={accountForm.isDefault} onChange={e => setAccountForm(f => ({ ...f, isDefault: e.target.checked }))} />
              Use as the default bank account
            </label>
          )}
          <div className="banking-actions">
            <button type="button" className="btn" onClick={() => setShowAccountDrawer(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={accountSubmitting}>
              {accountSubmitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Bank Account'}
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer isOpen={!!txnAccount} onClose={() => setTxnAccount(null)} title={txnAccount ? `Add Transaction — ${txnAccount.name}` : ''} width={440}>
        {txnAccount && (
          <form onSubmit={handleTxnSubmit} className="admin-form">
            <FormField label="Date" required>
              <input type="date" value={txnForm.date} onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))} required />
            </FormField>
            <FormField label="Description" required>
              <input type="text" value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} required placeholder="EFT received — customer name" />
            </FormField>
            <FormField label="Amount (R)" required hint="Positive = money in, negative = money out — same sign as it reads on the statement.">
              <input type="number" step="0.01" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} required placeholder="e.g. 500.00 or -45.00" />
            </FormField>
            <FormField label="Reference (optional)">
              <input type="text" value={txnForm.reference} onChange={e => setTxnForm(f => ({ ...f, reference: e.target.value }))} />
            </FormField>
            <div className="banking-actions">
              <button type="button" className="btn" onClick={() => setTxnAccount(null)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={txnSubmitting}>
                {txnSubmitting ? 'Adding...' : 'Add Transaction'}
              </button>
            </div>
          </form>
        )}
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .banking-default-check { display: flex; align-items: center; gap: var(--sp-2); font-size: 0.82rem; color: var(--text-muted); margin-bottom: var(--sp-5); }
        .banking-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }
        .banking-status-toggle { background: none; border: none; padding: 0; cursor: pointer; }
        .banking-status-toggle:disabled { cursor: default; opacity: 0.6; }

        @media (max-width: 480px) {
          .banking-actions { flex-wrap: wrap; }
          .banking-actions .btn, .banking-actions .btn--primary { flex: 1 1 auto; }
        }
      `}} />
    </div>
  );
}

export default Banking;
