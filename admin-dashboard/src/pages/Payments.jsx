import { useState, useEffect, useCallback } from 'react';
import { paymentsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { useMessaging } from '../context/MessagingContext';
import { CreditCard, Clock, Landmark, HandCoins, Wallet, Search, Eye, Check, X, ExternalLink } from 'lucide-react';
import { DateTime } from 'luxon';

const EFT_QUEUE_STATUSES = 'PENDING_PROOF,PROOF_UPLOADED';

const METHOD_LABELS = {
  PayFast: 'PayFast',
  manual_eft: 'Manual EFT',
  manual_cash: 'Cash',
  manual_card: 'Card',
};

const EFT_STATUS_TONE = {
  PENDING_PROOF: 'neutral',
  PROOF_UPLOADED: 'warning',
  VERIFIED: 'success',
  REJECTED: 'error',
};

function statusBadgeFor(payment) {
  if (payment.paymentMethod === 'manual_eft' && payment.eftVerificationStatus) {
    const label = payment.eftVerificationStatus.replace('_', ' ');
    return <StatusBadge tone={EFT_STATUS_TONE[payment.eftVerificationStatus] || 'neutral'} label={label} />;
  }
  return <StatusBadge tone="success" label="Verified" />;
}

export default function Payments() {
  const { showMessage } = useMessaging();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [showQueueOnly, setShowQueueOnly] = useState(false);
  const [proofPayment, setProofPayment] = useState(null);
  const [proofObjectUrl, setProofObjectUrl] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [rejectPayment, setRejectPaymentTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await paymentsApi.list(showQueueOnly ? EFT_QUEUE_STATUSES : undefined);
      setPayments(data);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  }, [showQueueOnly]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const filteredPayments = payments.filter(p =>
    (p.transactionReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.order?.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.order?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!methodFilter || p.paymentMethod === methodFilter)
  );

  const handleViewProof = async (payment) => {
    setProofPayment(payment);
    setProofLoading(true);
    try {
      const token = localStorage.getItem('toca_admin_token');
      const response = await fetch(paymentsApi.proofUrl(payment.id), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to load proof of payment');
      const blob = await response.blob();
      setProofObjectUrl(URL.createObjectURL(blob));
    } catch (err) {
      showMessage('error', 'Load Failed', err.message);
      setProofPayment(null);
    } finally {
      setProofLoading(false);
    }
  };

  const closeProofViewer = () => {
    if (proofObjectUrl) URL.revokeObjectURL(proofObjectUrl);
    setProofObjectUrl(null);
    setProofPayment(null);
  };

  const handleVerify = async (payment) => {
    setSubmitting(true);
    try {
      await paymentsApi.verify(payment.id);
      showMessage('success', 'Payment Verified', `Order ${payment.order?.orderNumber} has been marked as paid.`);
      fetchPayments();
    } catch (err) {
      showMessage('error', 'Verification Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await paymentsApi.reject(rejectPayment.id, rejectReason.trim());
      showMessage('success', 'Payment Rejected', 'The customer has been notified to upload a new proof of payment.');
      setRejectPaymentTarget(null);
      setRejectReason('');
      fetchPayments();
    } catch (err) {
      showMessage('error', 'Rejection Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isPdf = proofPayment?.proofMimeType === 'application/pdf';

  const columns = [
    { key: 'transactionReference', label: 'Reference', render: (val, row) => (
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary-text)' }}>{val || row.order?.orderNumber || '—'}</span>
    )},
    { key: 'order', label: 'Customer', render: (val, row) => (
      <div>
        <p style={{ fontWeight: 600, margin: 0 }}>{val?.customer?.name || 'Private Client'}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: 0 }}>Order #{val?.orderNumber || row.orderId?.split('-')[0]?.toUpperCase()}</p>
      </div>
    )},
    { key: 'amount', label: 'Amount', render: (val) => <span style={{ fontWeight: 700 }}>R{Number(val).toLocaleString()}</span> },
    { key: 'paymentMethod', label: 'Method', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CreditCard size={14} color="var(--color-text-muted)" />{METHOD_LABELS[val] || val}</div>
    )},
    { key: 'paidAt', label: 'Paid At', render: (val) => val ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        <Clock size={12} />{DateTime.fromISO(val).toFormat('dd LLL yyyy, HH:mm')}
      </div>
    ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span> },
    { key: 'status', label: 'Status', render: (_, row) => statusBadgeFor(row) },
  ];

  return (
    <div className="elite-payments-container animate-fade-in">
      <PageHeader
        icon={<Wallet size={22} />}
        title="Transaction Ledger"
        subtitle="Every payment across PayFast and Manual EFT, and the EFT verification queue."
      />

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input
            type="text"
            className="search-glass-input"
            placeholder="Search by reference, order, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-glass-matrix">
           <div className="select-glass-wrapper">
              <Landmark size={14} className="glass-icon" />
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="">All Methods</option>
                <option value="PayFast">PayFast</option>
                <option value="manual_eft">Manual EFT</option>
                <option value="manual_cash">Cash</option>
                <option value="manual_card">Card</option>
              </select>
           </div>
           <button
             type="button"
             className={`btn btn--sm ${showQueueOnly ? 'btn--primary' : 'btn--outline'}`}
             onClick={() => setShowQueueOnly(v => !v)}
           >
             Awaiting Verification
           </button>
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
            actions={(payment) => payment.paymentMethod === 'manual_eft' ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                {payment.proofOfPaymentUrl && (
                  <button className="icon-btn" title="View proof of payment" onClick={() => handleViewProof(payment)}>
                    <Eye size={16} />
                  </button>
                )}
                {['PENDING_PROOF', 'PROOF_UPLOADED'].includes(payment.eftVerificationStatus) && (
                  <>
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={submitting || payment.eftVerificationStatus === 'PENDING_PROOF'}
                      title={payment.eftVerificationStatus === 'PENDING_PROOF' ? 'No proof uploaded yet' : 'Approve'}
                      onClick={() => handleVerify(payment)}
                    >
                      <Check size={14} /> Verify
                    </button>
                    <button
                      className="btn btn--outline btn--sm"
                      disabled={submitting}
                      onClick={() => setRejectPaymentTarget(payment)}
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
              </div>
            ) : null}
          />
        </div>
      )}

      <Modal isOpen={!!proofPayment} onClose={closeProofViewer} title="Proof of Payment" maxWidth={640}>
        {proofLoading ? (
          <LoadingState label="Loading proof of payment..." />
        ) : proofObjectUrl ? (
          isPdf ? (
            <div className="proof-pdf-link">
              <a href={proofObjectUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
                <ExternalLink size={16} /> Open PDF in new tab
              </a>
            </div>
          ) : (
            <img src={proofObjectUrl} alt="Proof of payment" className="proof-image" />
          )
        ) : null}
      </Modal>

      <Modal isOpen={!!rejectPayment} onClose={() => setRejectPaymentTarget(null)} title="Reject Payment" maxWidth={480}>
        <form onSubmit={handleReject} className="admin-form">
          <p className="reject-context">
            Order #{rejectPayment?.order?.orderNumber} — the customer will be emailed to upload a new proof of payment.
          </p>
          <FormField label="Reason" required>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Amount doesn't match the order total" required />
          </FormField>
          <div className="attr-actions">
            <button type="button" className="btn" onClick={() => setRejectPaymentTarget(null)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Rejecting...' : 'Reject Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-payments-container { padding: var(--sp-7); max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-6); gap: var(--sp-6);
        }

        .search-glass-wrapper {
          position: relative; background: var(--bg-elevated); border: 1.5px solid var(--border-default); border-radius: var(--r);
          padding: var(--sp-3) var(--sp-4); display: flex; align-items: center; flex: 1;
        }
        .search-glass-input {
          background: none; border: none; color: var(--text-primary); width: 100%; outline: none; margin-left: var(--sp-3); font-size: 0.9rem; font-family: var(--f-body); font-weight: 300;
        }

        .filter-glass-matrix { display: flex; gap: var(--sp-4); align-items: center; }
        .select-glass-wrapper {
          background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r);
          padding: var(--sp-2) var(--sp-4); display: flex; align-items: center; gap: 10px;
        }
        .select-glass-wrapper select {
          background: none; border: none; color: var(--text-primary); outline: none; cursor: pointer; font-size: 0.85rem; font-family: var(--f-body); font-weight: 300;
        }

        .proof-image { width: 100%; border-radius: var(--r); border: 1px solid var(--border-default); }
        .proof-pdf-link { text-align: center; padding: var(--sp-6) 0; }
        .reject-context { font-size: 0.82rem; color: var(--text-muted); margin: 0 0 var(--sp-4); }
        .attr-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); margin-top: var(--sp-2); }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .elite-payments-container { padding: var(--sp-5); }
          .filter-glass-matrix { flex-wrap: wrap; }
        }

        @media (max-width: 480px) {
          .elite-payments-container { padding: var(--sp-4); }
        }
      `}} />
    </div>
  );
}
