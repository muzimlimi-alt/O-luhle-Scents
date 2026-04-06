import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { Users, Mail, Phone, Calendar, Eye, Send } from 'lucide-react';
import { Modal } from '../components/Modal';

export function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const data = await adminOpsApi.customers.list();
        setCustomers(data);
      } catch (err) {
        console.error('Customers API failed:', err.message);
        setCustomers([
          { id: '1', name: 'Muzi Mlimi', email: 'muzi@example.com', phone: '082 123 4567', createdAt: '2026-03-20' },
          { id: '2', name: 'Sarah Parker', email: 'sarah@example.com', phone: '071 987 6543', createdAt: '2026-04-01' },
          { id: '3', name: 'John Doe', email: 'john@example.com', phone: '011 456 7890', createdAt: '2026-04-03' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const columns = [
    { key: 'name', label: 'Full Name', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Users size={12} color="var(--color-primary)" />
        </div>
        {val || 'Guest'}
      </div>
    )},
    { key: 'email', label: 'Email Address', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        <Mail size={14} /> {val || '—'}
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        <Phone size={14} /> {val || '—'}
      </div>
    )},
    { key: 'createdAt', label: 'Join Date', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        <Calendar size={14} /> {new Date(val).toLocaleDateString()}
      </div>
    )},
  ];

  return (
    <div className="customers-page">
      <div className="content-header">
        <h2 className="page-title">Registered Customers</h2>
        <button className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
          <Send size={18} /> Bulk Email Campaign
        </button>
      </div>

      <div className="card">
        <DataTable 
          columns={columns} 
          data={customers} 
          loading={loading}
          actions={() => (
            <button className="icon-btn" title="View Customer History"><Eye size={16} /></button>
          )}
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Bulk Email Campaign">
        <form className="admin-form" onSubmit={async (e) => { 
           e.preventDefault(); 
           const subject = e.target[0].value;
           const body = e.target[1].value;
           try {
             await adminOpsApi.email.sendBulk(subject, body);
             alert("Campaign Launched Successfully!");
             setIsModalOpen(false);
           } catch (err) {
             alert("Error: " + err.message);
           }
        }}>
           <div className="form-group">
              <label>Campaign Subject *</label>
              <input type="text" placeholder="e.g. Special Offer!" required />
           </div>
           <div className="form-group">
              <label>Email Body (HTML supported)</label>
              <textarea rows="6" style={{ width: '100%', background: 'var(--color-bg-dark)', color: '#fff', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px' }} required></textarea>
           </div>
           <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="submit" className="btn btn--primary" style={{ flexGrow: 1 }}>Send to {customers.length} Customers</button>
              <button type="button" className="btn btn--outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
           </div>
        </form>
      </Modal>

    </div>
  );
}
