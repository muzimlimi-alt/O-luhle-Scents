import { useState, useEffect, useCallback } from 'react';
import { Heart, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { useMessaging } from '../context/MessagingContext';
import { wishlistsApi } from '../services/api';

export function Wishlists() {
  const { showMessage } = useMessaging();
  const [wishlists, setWishlists] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wishlistsApi.list({ page, limit });
      setWishlists(res.data.wishlists || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      showMessage('error', 'Load Failed', err.message || 'Unable to load wishlists.');
    } finally {
      setLoading(false);
    }
  }, [page, showMessage]);

  useEffect(() => { load(); }, [load]);

  const viewCustomer = async (customerId) => {
    try {
      const res = await wishlistsApi.getByCustomer(customerId);
      setDetail(res.data);
    } catch (err) {
      showMessage('error', 'Load Failed', err.message || 'Unable to load customer wishlist.');
    }
  };

  const columns = [
    {
      key: 'customer',
      label: 'Customer',
      render: (row) => (
        <span style={{ fontWeight: 500 }}>
          {row.customer?.name || row.customer?.email || 'Unknown'}
        </span>
      ),
    },
    { key: 'name', label: 'List Name' },
    {
      key: 'itemCount',
      label: 'Items',
      render: (row) => row._count?.items ?? row.items?.length ?? 0,
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      render: (row) => new Date(row.updatedAt).toLocaleDateString('en-ZA', {
        year: 'numeric', month: 'short', day: 'numeric',
      }),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => viewCustomer(row.customerId)}
          title="View wishlist"
        >
          <ChevronRight size={16} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Wishlists"
        subtitle={total > 0 ? `${total} wishlist${total !== 1 ? 's' : ''}` : ''}
        icon={<Heart size={20} />}
      />

      {!loading && wishlists.length === 0 ? (
        <EmptyState
          icon={<Heart size={40} style={{ opacity: 0.4 }} />}
          title="No wishlists yet"
          description="Customer wishlists will appear here once customers start saving products."
        />
      ) : (
        <DataTable
          columns={columns}
          data={wishlists}
          loading={loading}
          page={page}
          totalPages={Math.ceil(total / limit)}
          onPageChange={setPage}
        />
      )}

      {detail && (
        <Modal
          title={`${detail.customer?.name || 'Customer'}'s Wishlist`}
          onClose={() => setDetail(null)}
        >
          {detail.wishlists?.length > 0 ? (
            detail.wishlists.map((wl) => (
              <div key={wl.id} style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12, color: 'var(--color-gold)' }}>{wl.name}</h4>
                {wl.items?.length > 0 ? (
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wl.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product?.name || item.productId}</td>
                          <td>{new Date(item.addedAt).toLocaleDateString('en-ZA')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>No items in this list.</p>
                )}
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>No wishlists found.</p>
          )}
        </Modal>
      )}
    </>
  );
}
