import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Users, Mail, Search, ShoppingBag } from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const data = await adminOpsApi.customers.list();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'name', label: 'Customer', render: (val, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="patron-avatar">{val?.charAt(0) || 'C'}</div>
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>{val}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <Mail size={11} />{row.email}
          </div>
        </div>
      </div>
    )},
    { key: '_count', label: 'Orders', render: (val) => `${val?.orders || 0} orders` },
    { key: 'createdAt', label: 'Customer Since', render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
  ];

  return (
    <div className="elite-customers-container animate-fade-in">
      <PageHeader
        icon={<Users size={22} />}
        title="Customers"
        subtitle="Directory of registered storefront accounts."
      />

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input
            type="text"
            className="search-glass-input"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading customers..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={filteredCustomers}
            emptyState={<EmptyState icon={<ShoppingBag size={40} />} title="No customers found" description="Registered storefront accounts will appear here." />}
          />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-customers-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 24px;
        }

        .search-glass-wrapper {
          position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px;
          padding: 10px 16px; display: flex; align-items: center; flex: 1; max-width: 500px;
        }
        .search-glass-input {
          background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem;
        }

        .patron-avatar { width: 36px; height: 36px; flex-shrink: 0; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark)); color: #1a1611; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; font-family: var(--font-display); }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
        }
      `}} />
    </div>
  );
}
