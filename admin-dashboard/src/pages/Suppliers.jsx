import React, { useEffect, useState } from 'react';
import { adminOpsApi } from '../services/api';
import { 
  Truck, 
  Plus, 
  Mail, 
  Phone, 
  ExternalLink,
  Search,
  Loader2,
  AlertCircle
} from 'lucide-react';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', contactEmail: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      const data = await adminOpsApi.suppliers.list();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminOpsApi.suppliers.create(newSupplier);
      setShowModal(false);
      setNewSupplier({ name: '', contactEmail: '', phone: '' });
      fetchSuppliers();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="suppliers-page">
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 className="page-title">Supply Chain Partners</h2>
          <p className="page-subtitle">Manage global fragrance distribution and fulfillment partners</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add New Partner
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <Loader2 className="animate-spin" size={48} color="#d4af37" />
        </div>
      ) : (
        <div className="suppliers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
          {suppliers.map(s => (
            <div key={s.id} className="card supplier-card" style={{ transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Truck size={24} color="#d4af37" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{s.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fragrance Distribution</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                  <Mail size={16} color="var(--color-text-muted)" />
                  <a href={`mailto:${s.contactEmail}`} style={{ color: 'inherit', textDecoration: 'none' }}>{s.contactEmail}</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                  <Phone size={16} color="var(--color-text-muted)" />
                  <span>{s.phone || 'No phone recorded'}</span>
                </div>
              </div>

              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border-alt)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Partner since: {new Date(s.createdAt).toLocaleDateString()}
                </div>
                <button className="btn btn--outline-dark btn--sm">
                  View Performance
                </button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px' }}>
              <AlertCircle size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 16px' }} />
              <h3>No suppliers found</h3>
              <p style={{ color: 'var(--color-text-muted)' }}>Start by adding your first luxury distribution partner.</p>
            </div>
          )}
        </div>
      )}

      {/* --- ADD MODAL --- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Register New Partner</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Company Name</label>
                <input 
                  type="text" 
                  value={newSupplier.name} 
                  onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                  required 
                  placeholder="e.g. Grasse Essence Co."
                />
              </div>
              <div className="form-group">
                <label>Contact Email (for Restock Alerts)</label>
                <input 
                  type="email" 
                  value={newSupplier.contactEmail} 
                  onChange={e => setNewSupplier({...newSupplier, contactEmail: e.target.value})}
                  required 
                  placeholder="fulfillment@grasse.com"
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  value={newSupplier.phone} 
                  onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                  placeholder="+33 4 00 00 00 00"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Register Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
