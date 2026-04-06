import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { CreditCard, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { DateTime } from 'luxon';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="payments-page">
      <div className="content-header">
        <h2 className="page-title">Transaction Ledger</h2>
        <p className="page-subtitle">Historical record of all successful luxury fragrance acquisitions</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Syncing with treasury...</div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                      No transactions recorded in the current cycle.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{payment.transactionReference}</td>
                      <td>
                        <span className="badge badge--outline">
                          #{payment.orderId.split('-')[0].toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <p style={{ fontWeight: 600 }}>{payment.order?.customer?.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{payment.order?.customer?.email}</p>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        R{Number(payment.amount).toLocaleString()}
                      </td>
                      <td>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                           <CreditCard size={14} /> {payment.paymentMethod}
                         </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {DateTime.fromISO(payment.paidAt).toFormat('dd LLL yyyy, HH:mm')}
                      </td>
                      <td>
                        <span className="status-badge status--paid">
                          <CheckCircle size={12} /> {payment.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
