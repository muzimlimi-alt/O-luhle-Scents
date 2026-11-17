import { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { useMessaging } from '../context/MessagingContext';
import { FileText, Download, User, ShoppingBag, Archive } from 'lucide-react';

export function Invoices() {
  const { showMessage } = useMessaging();
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
      a.download = `TOCA_Invoices_Archive.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMessage('error', 'Bulk Download Failed', err.message);
    }
  };

  const handleDownload = async (invoiceId, invNum) => {
    try {
      const token = localStorage.getItem('toca_admin_token');
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
      showMessage('error', 'Download Failed', err.message);
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
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={10} color="var(--color-primary)" />
        </div>
        {row.order?.customer?.name || 'Guest'}
      </div>
    )},
    { key: 'issuedDate', label: 'Issued Date', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="invoices-page">
      <PageHeader
        icon={<FileText size={22} />}
        title="Invoices"
        subtitle="Generated invoices for every order, ready to download individually or in bulk."
        actions={selectedIds.length > 0 && (
          <button className="btn btn--primary btn--sm" onClick={handleBulkDownload}>
            <Archive size={16} /> Download Selected ({selectedIds.length})
          </button>
        )}
      />

      <div className="card">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          caption="Invoices"
          actions={(invoice) => (
            <button className="icon-btn" onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)} title="Download PDF">
               <Download size={16} />
            </button>
          )}
          mobileCardRenderer={(row, _cols, actions) => (
            <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(row.id)}
                onChange={() => handleSelection(row.id)}
                style={{ cursor: 'pointer', marginTop: '3px', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--y-base)', fontFamily: 'var(--f-mono)', fontSize: '.86rem' }}>
                    <FileText size={14} /> {row.invoiceNumber}
                  </div>
                  {actions && actions(row)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem', color: 'var(--text-secondary)' }}>
                  <span>{row.order?.customer?.name || 'Guest'}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>
                    {row.issuedDate ? new Date(row.issuedDate).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
