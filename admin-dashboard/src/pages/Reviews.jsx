import { useState, useEffect, useCallback } from 'react';
import { Check, X, Trash2, Star, MessageSquare } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { useMessaging } from '../context/MessagingContext';
import { useAuth } from '../context/AuthContext';
import { reviewsApi } from '../services/api';

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'error' };

function Stars({ rating }) {
  return (
    <span style={{ color: '#b89b6a', fontSize: '0.9rem', letterSpacing: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= rating ? 1 : 0.25 }}>&#9733;</span>
      ))}
    </span>
  );
}

export function Reviews() {
  const { showMessage } = useMessaging();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('reviews', 'write');
  const canDelete = hasPermission('reviews', 'delete');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      params.limit = 200;
      const res = await reviewsApi.list(params);
      setItems(res.reviews || []);
      setTotal(res.total || 0);
      if (!statusFilter) {
        setPendingCount((res.reviews || []).filter(r => r.status === 'pending').length);
      } else {
        const allRes = await reviewsApi.list({ limit: 200 });
        setPendingCount((allRes.reviews || []).filter(r => r.status === 'pending').length);
      }
    } catch (err) {
      showMessage('error', 'Load Failed', err.message || 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showMessage]);

  useEffect(() => { load(); }, [load]);

  async function moderate(id, status) {
    try {
      await reviewsApi.moderate(id, status);
      showMessage('success', status === 'approved' ? 'Approved' : 'Rejected');
      load();
    } catch (err) {
      showMessage('error', 'Failed', err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await reviewsApi.remove(deleteTarget.id);
      showMessage('success', 'Deleted', 'Review removed.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showMessage('error', 'Delete Failed', err.message);
    }
  }

  const columns = [
    {
      key: 'rating',
      label: 'Rating',
      render: (row) => <Stars rating={row.rating} />,
    },
    {
      key: 'product',
      label: 'Product',
      render: (row) => row.product?.name || '—',
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => row.customer?.name || row.customer?.email || '—',
    },
    {
      key: 'title',
      label: 'Title',
      render: (row) => row.title || <span style={{ color: 'var(--text-tertiary)' }}>No title</span>,
    },
    {
      key: 'body',
      label: 'Review',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 260, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.body || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} tone={STATUS_TONE[row.status]} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => new Date(row.createdAt).toLocaleDateString('en-ZA'),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {canWrite && row.status !== 'approved' && (
            <button className="btn btn-icon btn-ghost" title="Approve" onClick={() => moderate(row.id, 'approved')}>
              <Check size={15} />
            </button>
          )}
          {canWrite && row.status !== 'rejected' && (
            <button className="btn btn-icon btn-ghost" title="Reject" onClick={() => moderate(row.id, 'rejected')}>
              <X size={15} />
            </button>
          )}
          {canDelete && (
            <button className="btn btn-icon btn-ghost btn-danger" title="Delete" onClick={() => setDeleteTarget(row)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        title="Reviews"
        subtitle={`${total} total${pendingCount ? ` · ${pendingCount} pending` : ''}`}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading...</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={40} />}
          title="No reviews yet"
          description="Customer reviews will appear here once submitted."
        />
      ) : (
        <DataTable columns={columns} data={items} />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Review"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p>Permanently remove this {deleteTarget?.rating}-star review by {deleteTarget?.customer?.name || 'Anonymous'}?</p>
      </Modal>
    </div>
  );
}

export default Reviews;
