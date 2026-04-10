import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { 
  Users, 
  Mail, 
  Calendar, 
  ShoppingBag, 
  Search, 
  Filter, 
  ExternalLink,
  UserCheck,
  CreditCard,
  MessageSquare
} from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const data = await adminOpsApi.customers.list();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="elite-customers-container animate-fade-in">
      <div className="atelier-header">
        <div className="header-titles">
          <h1 className="couture-text">Patron Portfolio</h1>
          <p className="couture-subtext">Unified directory of global fragrance collectors and clients</p>
        </div>
      </div>

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input" 
            placeholder="Discovery via patron name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-glass-matrix">
           <button className="elite-btn-outline mini">
              <MessageSquare size={14} /> Communication Nexus
           </button>
        </div>
      </div>

      <div className="atelier-grid">
        {loading ? (
          <div className="elite-loading">
            <div className="loader-gold"></div>
            <p>Retrieving patron dossier...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="elite-empty-state">
            <Users size={48} />
            <p>No patrons discovered in the current directory.</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="elite-glass patron-card fade-in-blur">
              <div className="patron-card-header">
                <div className="patron-avatar">
                   {customer.name?.charAt(0) || 'P'}
                </div>
                <div className="patron-status">
                   <UserCheck size={12} fill="var(--color-primary)" />
                   <span>OFFICIAL PATRON</span>
                </div>
              </div>

              <div className="patron-info">
                <h3 className="patron-name">{customer.name}</h3>
                <div className="patron-email-row">
                   <Mail size={12} />
                   <span>{customer.email}</span>
                </div>
              </div>

              <div className="patron-metrics">
                <div className="metric-box">
                  <span className="box-label">Acquisitions</span>
                  <span className="box-value">{customer._count?.orders || 0} Assets</span>
                </div>
                <div className="metric-box">
                  <span className="box-label">Since</span>
                  <span className="box-value">{customer.createdAt ? new Date(customer.createdAt).getFullYear() : '2024'}</span>
                </div>
              </div>

              <div className="patron-footer">
                <div className="footer-meta">
                   <CreditCard size={12} />
                   <span>Premium Tier</span>
                </div>
                <button className="btn-mini-action">
                   <ExternalLink size={14} /> Dossier
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-customers-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }
        .atelier-header { margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }
        
        .atelier-discovery {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; gap: 24px;
        }

        .search-glass-wrapper {
          position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px;
          padding: 10px 16px; display: flex; align-items: center; flex: 1; max-width: 500px;
        }
        .search-glass-input {
          background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem;
        }

        .atelier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px; }
        
        .patron-card { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .patron-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .patron-avatar { width: 52px; height: 52px; background: linear-gradient(135deg, var(--color-primary), #d4af37); color: #000; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.4rem; font-family: var(--font-display); }
        .patron-status { display: flex; align-items: center; gap: 6px; font-size: 0.6rem; font-weight: 800; color: var(--color-primary); letter-spacing: 1.5px; }

        .patron-info { display: flex; flex-direction: column; gap: 6px; }
        .patron-name { font-size: 1.3rem; font-weight: 700; color: var(--color-text-header); margin: 0; }
        .patron-email-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--color-text-muted); }

        .patron-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
        .box-label { display: block; font-size: 0.6rem; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 4px; }
        .box-value { font-weight: 700; color: var(--color-text-header); font-size: 0.95rem; }

        .patron-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; }
        .footer-meta { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 8px; }
        .btn-mini-action { background: none; border: none; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; transition: var(--transition); }
        .btn-mini-action:hover { color: var(--color-primary); }

        .elite-btn-outline.mini { padding: 8px 16px; border: 1px solid var(--color-border); background: none; color: var(--color-text); border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.8rem; }
        .elite-btn-outline.mini:hover { background: var(--color-border-light); border-color: var(--color-primary); }

        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
        .fade-in-blur { animation: eliteFadeIn 0.4s ease-out; }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .atelier-grid { grid-template-columns: 1fr; }
        }
      `}} />
    </div>
  );
}
