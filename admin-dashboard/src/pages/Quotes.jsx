import React, { useEffect, useState } from 'react';
import { quotesApi } from '../services/api';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowRight,
  Search,
  Download,
  AlertCircle,
  Loader2
} from 'lucide-react';

export function Quotes() {
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
       alert('Failed to update status: ' + err.message);
     } finally {
       setSubmitting(false);
     }
  };

  const handleConvert = async (id) => {
     if (!window.confirm('Convert this approved quote into a paid order? This will sync inventory and generate fulfillment signals.')) return;
     setSubmitting(true);
     try {
       await quotesApi.convert(id);
       alert('Successfully converted to order!');
       fetchQuotes();
     } catch (err) {
       alert('Conversion failed: ' + err.message);
     } finally {
       setSubmitting(false);
     }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'approved': return <span className="status-badge success">Approved</span>;
      case 'converted': return <span className="status-badge" style={{ background: 'var(--color-primary)', color: 'white' }}>Converted</span>;
      case 'rejected': return <span className="status-badge error">Rejected</span>;
      case 'expired': return <span className="status-badge" style={{ backgroundColor: '#666' }}>Expired</span>;
      case 'sent': return <span className="status-badge" style={{ backgroundColor: '#2563eb' }}>Sent</span>;
      default: return <span className="status-badge" style={{ backgroundColor: '#94a3b8' }}>Draft</span>;
    }
  };

  return (
    <div className="quotes-page">
      <div className="content-header">
        <h2 className="page-title">Professional Quote Orchestration</h2>
        <p className="page-subtitle">Manage B2B fragrance negotiations and professional fulfillment pipelines</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
         <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flexGrow: 1, position: 'relative' }}>
               <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--color-text-muted)' }} />
               <input type="text" placeholder="Filter by quote number or customer..." style={{ width: '100%', padding: '10px 12px 10px 40px', background: 'var(--color-bg-dark)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'white' }} />
            </div>
         </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <Loader2 className="animate-spin" size={48} color="#d4af37" />
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Value</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={14} color="var(--color-primary)" />
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{q.quoteNumber}</span>
                      </div>
                    </td>
                    <td>
                      <p style={{ fontWeight: 500, margin: 0 }}>{q.customer?.name || 'Valued Partner'}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>{q.customer?.email}</p>
                    </td>
                    <td style={{ fontWeight: 700 }}>R{Number(q.totalAmount).toLocaleString()}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: new Date(q.expiryDate) < new Date() ? 'var(--color-error-text)' : 'inherit' }}>
                        <Clock size={12} />
                        {new Date(q.expiryDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td>{getStatusBadge(q.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {q.status === 'draft' && (
                          <button 
                            className="btn btn--primary btn--sm" 
                            style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                            onClick={() => handleStatusUpdate(q.id, 'approved')}
                            disabled={submitting}
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                        )}
                        {q.status === 'approved' && (
                          <button 
                            className="btn btn--success btn--sm" 
                            style={{ padding: '4px 8px', fontSize: '0.65rem', backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
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
                            style={{ color: 'var(--color-gold)' }}
                          >
                            <Download size={16} />
                          </a>
                        )}
                        {q.status !== 'converted' && q.status !== 'rejected' && (
                           <button 
                             className="icon-btn" 
                             style={{ color: 'var(--color-error-text)' }}
                             onClick={() => handleStatusUpdate(q.id, 'rejected')}
                             disabled={submitting}
                           >
                             <CheckCircle size={16} />
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {quotes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <AlertCircle size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 16px' }} />
                <h3>No professional quotes Found</h3>
                <p style={{ color: 'var(--color-text-muted)' }}>B2B fragrance negotiations will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

       <style dangerouslySetInnerHTML={{ __html: `
        .status-badge.sent { background: rgba(37,99,235,0.1); color: #2563eb; }
      `}} />
    </div>
  );
}
