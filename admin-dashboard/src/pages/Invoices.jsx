import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { FileText, Download, User, ShoppingBag, Archive } from 'lucide-react';

export function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const data = await adminOpsApi.invoices.list();
        setInvoices(data);
      } catch (err) {
        console.error('Invoices API failed:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const handleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDownload = async () => {
    if (!selectedIds.length) return;
    try {
      const blob = await adminOpsApi.invoices.bulkDownload(selectedIds);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `O_luhle_Invoices_Archive.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Bulk Download Failed: ' + err.message);
    }
  };

  const handleDownload = async (invoiceId, invNum) => {
    try {
      const token = localStorage.getItem('oluhle_admin_token');
      const response = await fetch(`http://localhost:3000/api/admin/ops/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const columns = [
    { 
      key: 'select', 
      label: '', 
      render: (_, row) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(row.id)} 
          onChange={() => handleSelection(row.id)}
          style={{ cursor: 'pointer' }}
        />
      )
    },
    { key: 'invoiceNumber', label: 'Invoice No.', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--color-primary)' }}>
        <FileText size={16} /> {val}
      </div>
    )},
    { key: 'order', label: 'Order ID', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
        <ShoppingBag size={14} color="var(--color-text-muted)" /> {val?.id}
      </div>
    )},
    { key: 'orderCustomer', label: 'Customer', render: (_, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={10} />
        </div>
        {row.order?.customer?.name || 'Guest'}
      </div>
    )},
    { key: 'issuedDate', label: 'Issued Date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="invoices-page">
      <div className="content-header">
        <h2 className="page-title">Digital Documentation</h2>
        <div className="actions">
           {selectedIds.length > 0 && (
             <button className="btn btn--primary btn--sm" onClick={handleBulkDownload}>
                <Archive size={16} /> Download Selected ({selectedIds.length})
             </button>
           )}
        </div>
      </div>

      <div className="card">
        <DataTable 
          columns={columns} 
          data={invoices} 
          loading={loading}
          actions={(invoice) => (
            <button className="icon-btn" onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)} title="Download PDF">
               <Download size={16} />
            </button>
          )}
        />
      </div>
    </div>
  );
}
