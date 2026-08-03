import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { CreditCard, Clock, Landmark, HandCoins, Wallet, Search } from 'lucide-react';
import { DateTime } from 'luxon';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  useEffect(() => {
    async function fetchPayments() {
      try {
        const data = await adminOpsApi.payments.list();
        setPayments(data);
      } catch (err) {
        console.error('Failed to fetch payments:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter(p =>
    p.transactionReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.order?.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'transactionReference', label: 'Reference', render: (val) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-text)' }}>{val}</span>
    )},
    { key: 'order', label: 'Customer', render: (val, row) => (
      <div>
        <p style={{ fontWeight: 600, margin: 0 }}>{val?.customer?.name || 'Private Client'}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: 0 }}>Order #{row.orderId?.split('-')[0]?.toUpperCase()}</p>
      </div>
    )},
    { key: 'amount', label: 'Amount', render: (val) => <span style={{ fontWeight: 700 }}>R{Number(val).toLocaleString()}</span> },
    { key: 'paymentMethod', label: 'Method', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={14} color="var(--color-text-muted)" />{val}</div>
    )},
    { key: 'paidAt', label: 'Paid At', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        <Clock size={12} />{DateTime.fromISO(val).toFormat('dd LLL yyyy, HH:mm')}
      </div>
    )},
    { key: 'status', label: 'Status', render: () => <StatusBadge tone="success" label="Verified" /> },
  ];

  return (
    <div className="elite-payments-container animate-fade-in">
      <PageHeader
        icon={<Wallet size={22} />}
        title="Transaction Ledger"
        subtitle="Historical record of every successful payment."
      />

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input
            type="text"
            className="search-glass-input"
            placeholder="Search by reference or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-glass-matrix">
           <div className="select-glass-wrapper">
              <Landmark size={14} className="glass-icon" />
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="">All Methods</option>
                <option value="PAYFAST">PayFast</option>
                <option value="CARD">Card</option>
                <option value="EFT">EFT</option>
              </select>
           </div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading payments..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={filteredPayments}
            emptyState={<EmptyState icon={<HandCoins size={40} />} title="No payments found" description="Successful transactions will appear here." />}
          />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-payments-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 24px;
        }

        .search-glass-wrapper {
          position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px;
          padding: 10px 16px; display: flex; align-items: center; flex: 1;
        }
        .search-glass-input {
          background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem;
        }

        .filter-glass-matrix { display: flex; gap: 16px; }
        .select-glass-wrapper {
          background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 4px;
          padding: 8px 16px; display: flex; align-items: center; gap: 10px;
        }
        .select-glass-wrapper select {
          background: none; border: none; color: var(--color-text); outline: none; cursor: pointer; font-size: 0.85rem;
        }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
        }
      `}} />
    </div>
  );
}
