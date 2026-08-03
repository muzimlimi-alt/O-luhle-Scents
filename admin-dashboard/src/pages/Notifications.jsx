import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Trash2,
  Search,
  Filter
} from 'lucide-react';
import { DateTime } from 'luxon';

// The Notification model has no title field — type ("LOW_STOCK") is all
// there is to summarize it with, so humanize it for display.
const humanizeType = (type) => (type || '')
  .toLowerCase()
  .replace(/_/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase());

// Only LOW_STOCK and PAYMENT_MISMATCH are actually created anywhere in the
// app today; anything else falls back to the neutral/info treatment rather
// than assuming a fixed INFO/WARNING/ERROR vocabulary that doesn't exist.
const SEVERITY = {
  PAYMENT_MISMATCH: 'critical',
  LOW_STOCK: 'warning',
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchNotifications = async () => {
    try {
      const data = await adminOpsApi.notifications.list();
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await adminOpsApi.notifications.markRead(id);
      fetchNotifications();
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await adminOpsApi.notifications.delete(id);
      fetchNotifications();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = notifications.filter(n => {
    const matchesSearch = humanizeType(n.type).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          n.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === '' || n.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const availableTypes = [...new Set(notifications.map(n => n.type))];

  return (
    <div className="elite-notifications-container animate-fade-in">
      <PageHeader
        icon={<Bell size={22} />}
        title="Notifications"
        subtitle="Operational alerts that need attention."
      />

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input" 
            placeholder="Discovery via alert title or content..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-glass-matrix">
           <div className="select-glass-wrapper">
              <Filter size={14} className="glass-icon" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Alerts: All Types</option>
                {availableTypes.map(type => (
                  <option key={type} value={type}>{humanizeType(type)}</option>
                ))}
              </select>
           </div>
        </div>
      </div>

      <div className="atelier-grid vertical-feed">
        {loading ? (
          <LoadingState label="Loading notifications..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Bell size={40} />} title="All clear" description="No notifications match your current filters." />
        ) : (
          filtered.map((n) => (
            <div key={n.id} className={`elite-glass alert-card fade-in-blur ${!n.isRead ? 'unread' : 'read'}`}>
              <div className="alert-card-side">
                {!n.isRead && <div className="unread-pulse"></div>}
                <div className={`alert-icon-box ${SEVERITY[n.type] === 'critical' ? 'error' : SEVERITY[n.type] === 'warning' ? 'warning' : 'info'}`}>
                   {SEVERITY[n.type] === 'critical' ? <AlertTriangle size={20} /> : SEVERITY[n.type] === 'warning' ? <Info size={20} /> : <CheckCircle size={20} />}
                </div>
              </div>

              <div className="alert-card-content">
                <div className="alert-header-row">
                  <span className="alert-type-tag">{n.type}</span>
                  <span className="alert-time">{DateTime.fromISO(n.createdAt).toRelative()}</span>
                </div>
                <h3 className="alert-title">{humanizeType(n.type)}</h3>
                <p className="alert-message">{n.message}</p>
                
                <div className="alert-footer">
                   <div className="footer-actions">
                      {!n.isRead && (
                        <button className="btn-mini-action" onClick={() => markAsRead(n.id)}>
                          <CheckCircle size={14} /> Resolve
                        </button>
                      )}
                      <button className="btn-mini-action delete" onClick={() => deleteNotification(n.id)}>
                        <Trash2 size={14} /> Purge
                      </button>
                   </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-notifications-container { padding: 40px; max-width: 1000px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 24px; }
        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 10px 16px; display: flex; align-items: center; flex: 1; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }
        .filter-glass-matrix { display: flex; gap: 16px; }
        .select-glass-wrapper { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px 16px; display: flex; align-items: center; gap: 10px; }
        .select-glass-wrapper select { background: none; border: none; color: var(--color-text); outline: none; cursor: pointer; font-size: 0.85rem; }

        .vertical-feed { display: flex; flex-direction: column; gap: 20px; }
        
        .alert-card { display: flex; padding: 24px; gap: 24px; transition: var(--transition); border-left: 4px solid transparent; }
        .alert-card.unread { background: var(--color-border-light); border-left-color: var(--color-primary); }
        .alert-card.read { opacity: 0.8; filter: grayscale(0.5); }
        .alert-card:hover { transform: translateX(8px); background: var(--color-surface); }

        .alert-card-side { display: flex; flex-direction: column; align-items: center; gap: 12px; position: relative; }
        .unread-pulse { width: 8px; height: 8px; background: var(--color-primary); border-radius: 50%; box-shadow: 0 0 10px var(--color-primary); animation: pulse 2s infinite; position: absolute; top: -4px; right: -4px; }
        
        .alert-icon-box { width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--color-surface); border: 1px solid var(--color-border); }
        .alert-icon-box.error { color: #e74c3c; }
        .alert-icon-box.warning { color: var(--color-primary); }
        .alert-icon-box.info { color: #3498db; }

        .alert-card-content { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .alert-header-row { display: flex; justify-content: space-between; align-items: center; }
        .alert-type-tag { font-size: 0.6rem; font-weight: 800; letter-spacing: 2px; color: var(--color-text-muted); opacity: 0.5; }
        .alert-time { font-size: 0.75rem; color: var(--color-text-muted); }
        
        .alert-title { font-size: 1.1rem; font-weight: 700; color: var(--color-text-header); margin: 0; }
        .alert-message { font-size: 0.95rem; color: var(--color-text-muted); line-height: 1.6; margin: 0; }

        .alert-footer { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border-alt); }
        .footer-actions { display: flex; gap: 20px; }
        .btn-mini-action { background: none; border: none; color: var(--color-text); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; opacity: 0.6; transition: 0.2s; }
        .btn-mini-action:hover { opacity: 1; color: var(--color-primary); }
        .btn-mini-action.delete:hover { color: #e74c3c; }

        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(184, 155, 106, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(184, 155, 106, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(184, 155, 106, 0); } }
        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
        }
      `}} />
    </div>
  );
}
