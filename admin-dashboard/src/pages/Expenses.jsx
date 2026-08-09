import { useState, useEffect, useCallback } from 'react';
import { expensesApi, financeApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import { Receipt, Plus } from 'lucide-react';

const EMPTY_FORM = { accountCode: '', amount: '', description: '', date: '', paymentMethod: '' };

export function Expenses() {
  const { showMessage } = useMessaging();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartOptions, setChartOptions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await expensesApi.list();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Expenses fetch failed:', err.message);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
    financeApi.chartOfAccounts().then(setChartOptions).catch(() => setChartOptions([]));
  }, [fetchExpenses]);

  const expenseAccounts = chartOptions.filter(a => a.type === 'EXPENSE');

  const openModal = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.accountCode || !form.description || !Number.isFinite(amount) || amount <= 0) {
      return showMessage('warning', 'Missing Fields', 'Account, description, and a positive amount are required.');
    }
    setSubmitting(true);
    try {
      await expensesApi.create({ ...form, amount });
      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      showMessage('error', 'Create Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'date', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'accountCode', label: 'Account', render: (v) => {
      const account = chartOptions.find(a => a.code === v);
      return account ? `${v} — ${account.name}` : v;
    }},
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: (v) => `R${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { key: 'paymentMethod', label: 'Method', render: (v) => v || '—' },
  ];

  return (
    <div className="expenses-page">
      <PageHeader
        icon={<Receipt size={22} />}
        title="Expenses"
        subtitle="Business expenses posted to the General Ledger — Debit the expense account, Credit Bank."
        actions={(
          <button className="btn btn--primary" onClick={openModal}>
            <Plus size={16} /> Add Expense
          </button>
        )}
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={expenses}
          loading={loading}
          emptyState={<EmptyState icon={<Receipt size={40} />} title="No expenses recorded yet" description="Record courier, marketing, packaging, or other business spend here." />}
        />
      </div>

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title="Add Expense" width={440}>
        <form onSubmit={handleSubmit} className="admin-form">
          <FormField label="Account" required>
            <select value={form.accountCode} onChange={e => setForm(f => ({ ...f, accountCode: e.target.value }))} required>
              <option value="">Select account...</option>
              {expenseAccounts.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Amount (R)" required>
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
          </FormField>
          <FormField label="Description" required>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="e.g. Courier run — bulk delivery" />
          </FormField>
          <FormField label="Date" hint="Defaults to today if left blank.">
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </FormField>
          <FormField label="Payment Method">
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="">Select...</option>
              <option value="eft">EFT</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </FormField>
          <div className="expenses-actions">
            <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .expenses-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }

        @media (max-width: 480px) {
          .expenses-actions { flex-direction: column-reverse; gap: var(--sp-2); }
          .expenses-actions .btn { width: 100%; justify-content: center; }
        }
      `}} />
    </div>
  );
}

export default Expenses;
