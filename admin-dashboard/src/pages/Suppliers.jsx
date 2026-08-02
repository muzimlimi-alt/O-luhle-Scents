import React, { useEffect, useState } from 'react';
import { adminOpsApi } from '../services/api';
import { Modal } from '../components/Modal';
import {
  Truck,
  Plus,
  Mail,
  Phone,
  ExternalLink,
  Search,
  Loader2,
  AlertCircle,
  Globe,
  Star
} from 'lucide-react';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', contactEmail: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="elite-suppliers-container animate-fade-in">
      <div className="atelier-header">
        <div className="header-titles">
          <h1 className="couture-text">Supply Chain Partners</h1>
          <p className="couture-subtext">Global distribution and raw material fulfillment curators</p>
        </div>
        <button className="elite-btn-plus" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Register Partner
        </button>
      </div>

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input" 
            placeholder="Discovery via partner name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="elite-loading">
          <div className="loader-gold"></div>
          <p>Gathering supplier intelligence...</p>
        </div>
      ) : (
        <div className="atelier-grid">
          {filteredSuppliers.map(s => (
            <div key={s.id} className="elite-glass partner-card fade-in-blur">
              <div className="partner-card-header">
                <div className="partner-avatar">
                   <Truck size={24} color="var(--color-primary)" />
                </div>
                <div className="partner-status">
                   <Star size={12} fill="var(--color-primary)" />
                   <span>VERIFIED PARTNER</span>
                </div>
              </div>

              <div className="partner-info">
                <h3 className="supplier-identity-fixed">{s.name}</h3>
                <span className="partner-domain">FRAGRANCE DISTRIBUTION</span>
              </div>

              <div className="partner-contacts">
                <div className="contact-glass">
                  <Mail size={14} />
                  <a href={`mailto:${s.contactEmail}`} style={{ color: '#1a1611' }}>{s.contactEmail}</a>
                </div>
                <div className="contact-glass">
                  <Phone size={14} />
                  <span style={{ color: '#1a1611' }}>{s.phone || 'No direct dial'}</span>
                </div>
              </div>

              <div className="partner-footer">
                <div className="footer-meta">
                   <Globe size={12} />
                   <span>Joined {new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                <button className="btn-mini-action">
                  <ExternalLink size={14} /> Portfolio
                </button>
              </div>
            </div>
          ))}
          {filteredSuppliers.length === 0 && (
            <div className="elite-empty-state">
              <AlertCircle size={48} />
              <p>No distribution partners are currently authorized.</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Register Partner" maxWidth={480}>
        <form onSubmit={handleSubmit} className="elite-form">
          <div className="elite-input-group">
            <label className="elite-input-label">Company Nomenclature</label>
            <input
              type="text"
              className="elite-glass-input"
              value={newSupplier.name}
              onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
              required
              placeholder="e.g. Grasse Essence Co."
            />
          </div>
          <div className="elite-input-group">
            <label className="elite-input-label">Communication Nexus (Email)</label>
            <input
              type="email"
              className="elite-glass-input"
              value={newSupplier.contactEmail}
              onChange={e => setNewSupplier({...newSupplier, contactEmail: e.target.value})}
              required
              placeholder="fulfillment@grasse.com"
            />
          </div>
          <div className="elite-input-group">
            <label className="elite-input-label">Voice Channel (Phone)</label>
            <input
              type="tel"
              className="elite-glass-input"
              value={newSupplier.phone}
              onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
              placeholder="+33 4 00 00 00 00"
            />
          </div>

          <div className="modal-actions-elite">
            <button type="submit" className="elite-btn" disabled={submitting}>
              {submitting ? 'Authenticating...' : 'Authorize Partner'}
            </button>
            <button type="button" className="elite-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-suppliers-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }
        .atelier-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }
        
        .elite-btn-plus { background: var(--color-primary); color: #000; border: none; padding: 12px 24px; border-radius: 4px; font-weight: 700; display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; font-size: 0.8rem; transition: var(--transition); }
        .elite-btn-plus:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 20px rgba(184,155,106,0.25); }

        .atelier-discovery { margin-bottom: 40px; }
        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 10px 16px; display: flex; align-items: center; max-width: 500px; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }

        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 32px; }
        
        .partner-card { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .partner-card-header { display: flex; justify-content: space-between; align-items: center; }
        .partner-avatar { width: 56px; height: 56px; background: rgba(184,155,106,0.1); border: 1px solid var(--color-border-alt); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .partner-status { display: flex; align-items: center; gap: 6px; font-size: 0.6rem; font-weight: 800; color: var(--color-primary); letter-spacing: 1.5px; }
        .partner-info { display: flex; flex-direction: column; gap: 4px; }
        .supplier-identity-fixed { font-size: 1.4rem; font-weight: 700; margin: 0; color: #1a1611 !important; }
        .partner-domain { font-size: 0.65rem; letter-spacing: 2px; color: var(--color-accent-dark) !important; font-weight: 700 !important; }
 
        .partner-contacts { display: flex; flex-direction: column; gap: 12px; }
        .contact-glass { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; font-size: 0.9rem; font-weight: 600 !important; }
        .contact-glass a { color: #1a1611 !important; text-decoration: none; transition: var(--transition); font-weight: 700 !important; }
        .contact-glass a:hover { color: var(--color-primary); }
        .contact-glass svg { color: var(--color-accent-dark); }

        .partner-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--color-border); }
        .footer-meta { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 8px; }
        .btn-mini-action { background: none; border: none; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--color-primary); }

        .elite-loading { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 100px 0; color: var(--color-text-muted); }
        .elite-empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 100px 0; color: var(--color-text-muted); opacity: 0.5; }
        .loader-gold { width: 40px; height: 40px; border: 3px solid rgba(184,155,106,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .elite-form { display: flex; flex-direction: column; gap: 20px; }
        .elite-input-group { display: flex; flex-direction: column; gap: 8px; }
        .elite-input-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
        .elite-glass-input { width: 100%; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 12px 16px; color: var(--color-text); outline: none; transition: var(--transition); font-size: 0.9rem; }
        .elite-glass-input:focus { border-color: var(--color-primary); background: rgba(184,155,106,0.05); }

        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
        .elite-btn { background: var(--color-primary); color: #000; padding: 14px; border: none; border-radius: 4px; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; transition: var(--transition); }
        .elite-btn-outline { background: none; border: 1px solid var(--color-border); color: var(--color-text); padding: 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; transition: var(--transition); }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        .animate-fade-in { animation: eliteFadeIn 0.4s ease-out; }
        .fade-in-blur { animation: eliteFadeIn 0.4s ease-out; }

        @media (max-width: 768px) {
          .atelier-header { flex-direction: column; gap: 24px; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
