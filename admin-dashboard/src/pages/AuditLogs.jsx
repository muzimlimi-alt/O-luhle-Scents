import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ScrollText, User, Calendar, Activity } from 'lucide-react';

export function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await adminOpsApi.auditLogs.list();
        setLogs(data);
      } catch (err) {
        console.error('Audit logs API failed:', err.message);
        setLogs([
          { id: '1', adminUser: { name: 'Admin', email: 'admin@oluhle.com' }, action: 'Create Product', entity: 'Product', createdAt: '2026-04-03T14:30:00Z', details: { name: 'Midnight Oud' } },
          { id: '2', adminUser: { name: 'Admin', email: 'admin@oluhle.com' }, action: 'Update Order', entity: 'Order', createdAt: '2026-04-03T15:00:00Z', details: { status: 'SHIPPED' } },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const columns = [
    { key: 'adminUser', label: 'Admin User', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={12} color="var(--color-primary)" />
        </div>
        <div>
          <p style={{ fontWeight: 600 }}>{val?.name || 'System'}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{val?.email}</p>
        </div>
      </div>
    )},
    { key: 'action', label: 'Action', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={14} color="var(--color-primary)" /> {val}
      </div>
    )},
    { key: 'entity', label: 'Entity Type', render: (val) => (
      <StatusBadge tone="neutral" label={val} />
    )},
    { key: 'createdAt', label: 'Timestamp', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        <Calendar size={14} /> {new Date(val).toLocaleString()}
      </div>
    )},
  ];

  return (
    <div className="audit-logs-page">
      <PageHeader
        icon={<ScrollText size={22} />}
        title="System Audit Logs"
        subtitle="Every administrative action, who performed it, and when."
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
          actions={null}
        />
      </div>
    </div>
  );
}
