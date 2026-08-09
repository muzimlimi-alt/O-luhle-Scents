import { useEffect, useState } from 'react';
import { quotesApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import {
  FileText,
  CheckCircle,
  Clock,
  ArrowRight,
  Search,
  Download,
} from 'lucide-react';

const STATUS_TONE = {
  approved: 'success',
  converted: 'success',
  rejected: 'error',
  expired: 'warning',
  sent: 'info',
  draft: 'neutral',
};

export function Quotes() {
  const { showMessage } = useMessaging();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    try {
      const data = await quotesApi.list();
      setQuotes(data);
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleStatusUpdate = async (id, status) => {
     setSubmitting(true);
     try {
       await quotesApi.updateStatus(id, status);
       fetchQuotes();
     } catch (err) {
       showMessage('error', 'Status Update Failed', err.message);
     } finally {
       setSubmitting(false);
     }
  };

  const handleConvert = async (id) => {
     if (!window.confirm('Convert this approved quote into a paid order? This will sync inventory and generate fulfillment signals.')) return;
     setSubmitting(true);
     try {
       await quotesApi.convert(id);
       showMessage('success', 'Quote Converted', 'The quote is now a paid order.');
       fetchQuotes();
     } catch (err) {
       showMessage('error', 'Conversion Failed', err.message);
     } finally {
       setSubmitting(false);
     }
  };

  const columns = [
    { key: 'quoteNumber', label: 'Quote #', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileText size={14} color="var(--color-primary)" />
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{val}</span>
      </div>
    )},
    { key: 'customer', label: 'Customer', render: (val) => (
      <div>
        <p style={{ fontWeight: 500, margin: 0 }}>{val?.name || 'Valued Partner'}</p>
        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>{val?.email}</p>
      </div>
    )},
    { key: 'totalAmount', label: 'Value', render: (val) => <span style={{ fontWeight: 700 }}>R{Number(val).toLocaleString()}</span> },
    { key: 'expiryDate', label: 'Expires', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: new Date(val) < new Date() ? 'var(--color-error-text)' : 'inherit' }}>
        <Clock size={12} />
        {new Date(val).toLocaleDateString()}
      </div>
    )},
    { key: 'status', label: 'Status', render: (val) => (
      <StatusBadge tone={STATUS_TONE[val] || 'neutral'} label={val.charAt(0).toUpperCase() + val.slice(1)} />
    )},
  ];

  return (
    <div className="quotes-page">
      <PageHeader
        icon={<FileText size={22} />}
        title="Professional Quotes"
        subtitle="Manage B2B fragrance negotiations and professional fulfillment pipelines."
      />

      <div className="card" style={{ marginBottom: '24px' }}>
         <div style={{ display: 'flex', gap: '16px', alignItems: 'center', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
            <input type="text" placeholder="Filter by quote number or customer..." className="form-input" style={{ paddingLeft: '40px' }} />
         </div>
      </div>

      {loading ? (
        <LoadingState label="Loading quotes..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={quotes}
            emptyState={<EmptyState icon={<FileText size={40} />} title="No professional quotes yet" description="B2B fragrance negotiations will appear here." />}
            actions={(q) => (
              <div style={{ display: 'flex', gap: '8px' }}>
                {q.status === 'draft' && (
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => handleStatusUpdate(q.id, 'approved')}
                    disabled={submitting}
                  >
                    <CheckCircle size={12} /> Approve
                  </button>
                )}
                {q.status === 'approved' && (
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => handleConvert(q.id)}
                    disabled={submitting}
                  >
                    <ArrowRight size={12} /> Convert
                  </button>
                )}
                {q.pdfUrl && (
                  <a
                    href={`/quotes/${q.pdfUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="icon-btn"
                    title="Download PDF"
                  >
                    <Download size={16} />
                  </a>
                )}
                {q.status !== 'converted' && q.status !== 'rejected' && (
                   <button
                     className="icon-btn danger"
                     title="Reject quote"
                     onClick={() => handleStatusUpdate(q.id, 'rejected')}
                     disabled={submitting}
                   >
                     <CheckCircle size={16} />
                   </button>
                )}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
