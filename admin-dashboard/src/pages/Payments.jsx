import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { CreditCard, CheckCircle, Clock, ExternalLink, Search, Filter, Landmark, TrendingUp, HandCoins } from 'lucide-react';
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

  return (
    <div className="elite-payments-container animate-fade-in">
      <div className="atelier-header">
        <div className="header-titles">
          <h1 className="couture-text">Transaction Ledger</h1>
          <p className="couture-subtext">Historical record of all successful luxury fragrance acquisitions</p>
        </div>
      </div>

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input" 
            placeholder="Discovery via reference or patron name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-glass-matrix">
           <div className="select-glass-wrapper">
              <Landmark size={14} className="glass-icon" />
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                <option value="">Methods: All Tenders</option>
                <option value="PAYFAST">PayFast Secure</option>
                <option value="CARD">Credit Portfolio</option>
                <option value="EFT">Direct Transfer</option>
              </select>
           </div>
        </div>
      </div>

      <div className="atelier-grid">
        {loading ? (
          <div className="elite-loading">
            <div className="loader-gold"></div>
            <p>Syncing with treasury...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="elite-empty-state">
             <HandCoins size={48} />
             <p>No treasury movements discovered in this cycle.</p>
          </div>
        ) : (
          filteredPayments.map((payment) => (
            <div key={payment.id} className="elite-glass payment-card fade-in-blur">
              <div className="payment-card-header">
                <div className="payment-ref">
                  <span className="ref-label">Reference</span>
                  <span className="ref-value">{payment.transactionReference}</span>
                </div>
                <div className={`status-indicator paid`}>
                   VERIFIED
                </div>
              </div>

              <div className="payment-acquisition">
                <span className="acquisition-label">Patron Attribution</span>
                <span className="acquisition-name">{payment.order?.customer?.name || 'Private Client'}</span>
                <span className="acquisition-order">Portfolio #{payment.orderId.split('-')[0].toUpperCase()}</span>
              </div>

              <div className="payment-valuation">
                <div className="valuation-block">
                  <span className="block-label">Quantum</span>
                  <span className="block-value">R{Number(payment.amount).toLocaleString()}</span>
                </div>
                <div className="method-block">
                  <CreditCard size={14} />
                  <span>{payment.paymentMethod}</span>
                </div>
              </div>

              <div className="payment-footer">
                <div className="footer-time">
                  <Clock size={12} />
                  {DateTime.fromISO(payment.paidAt).toFormat('dd LLL yyyy, HH:mm')}
                </div>
                <button className="btn-mini-action">
                  <ExternalLink size={14} /> Audit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-payments-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }
        .atelier-header { margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }
        
        .atelier-discovery {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; gap: 24px;
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

        .atelier-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px;
        }

        .payment-card { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .payment-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        
        .payment-ref { display: flex; flex-direction: column; }
        .ref-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); }
        .ref-value { font-family: monospace; font-size: 0.8rem; color: var(--color-primary); font-weight: 700; }

        .status-indicator.paid { background: rgba(39, 174, 96, 0.15); color: #2ecc71; font-size: 0.6rem; padding: 3px 8px; border-radius: 2px; font-weight: 700; }

        .payment-acquisition { padding: 16px; background: var(--color-surface); border-radius: 4px; border: 1px solid var(--color-border-alt); }
        .acquisition-label { display: block; font-size: 0.6rem; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px; }
        .acquisition-name { display: block; font-weight: 600; font-size: 1rem; color: var(--color-text-header); }
        .acquisition-order { display: block; font-size: 0.75rem; color: var(--color-primary); font-family: var(--font-display); }

        .payment-valuation { display: flex; justify-content: space-between; align-items: flex-end; padding: 10px 0; border-bottom: 1px solid var(--color-border); }
        .block-label { display: block; font-size: 0.6rem; text-transform: uppercase; color: var(--color-text-muted); }
        .block-value { font-size: 1.4rem; font-weight: 700; font-family: var(--font-display); color: var(--color-text-header); }
        
        .method-block { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }

        .payment-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
        .footer-time { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px; }
        
        .btn-mini-action { background: none; border: none; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--color-primary); }

        .elite-loading { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 100px 0; color: var(--color-text-muted); }
        .elite-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 100px 0; color: var(--color-text-muted); opacity: 0.5; }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
