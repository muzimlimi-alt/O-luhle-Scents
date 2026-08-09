import { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { usePreferences } from '../context/PreferencesContext';
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

// Not every Notification type is listed here — anything missing falls back
// to the neutral/info treatment rather than assuming a fixed
// INFO/WARNING/ERROR vocabulary that doesn't exist on the model itself.
const SEVERITY = {
  PAYMENT_MISMATCH: 'critical',
  LOW_STOCK: 'warning',
  STOCK_UNAVAILABLE_AFTER_PAYMENT: 'critical',
  // A payment reached PayFast but its confirmation never arrived — same
  // urgency as a mismatch, since a real sale may have been silently lost.
  PAYFAST_ITN_NOT_RECEIVED: 'critical',
};

export default function Notifications() {
  const { prefs } = usePreferences();
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

  // "Low-stock alerts" in Preferences -> Inventory Thresholds hides these
  // client-side rather than suppressing them server-side — the underlying
  // LOW_STOCK notification still gets created (other admins may want it),
  // this is a per-admin, per-device viewing preference, same as Appearance.
  const visibleNotifications = prefs.lowStockAlertsEnabled
    ? notifications
    : notifications.filter(n => n.type !== 'LOW_STOCK');

  const filtered = visibleNotifications.filter(n => {
    const matchesSearch = humanizeType(n.type).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          n.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === '' || n.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const availableTypes = [...new Set(visibleNotifications.map(n => n.type))];

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
        .elite-notifications-container { padding: var(--sp-6); max-width: 1000px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-5); gap: var(--sp-5); }
        .search-glass-wrapper { position: relative; height: var(--tap); background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r); padding: 0 var(--sp-4); display: flex; align-items: center; flex: 1; }
        .search-glass-input { background: none; border: none; color: var(--text-primary); width: 100%; outline: none; margin-left: var(--sp-3); font-size: 0.9rem; font-family: var(--f-body); font-weight: 300; }
        .filter-glass-matrix { display: flex; gap: var(--sp-4); }
        .select-glass-wrapper { height: var(--tap); background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r); padding: 0 var(--sp-4); display: flex; align-items: center; gap: var(--sp-2); }
        .select-glass-wrapper select { background: none; border: none; color: var(--text-primary); outline: none; cursor: pointer; font-size: 0.85rem; font-family: var(--f-body); font-weight: 300; }

        .vertical-feed { display: flex; flex-direction: column; gap: var(--sp-5); }

        .alert-card { display: flex; padding: var(--sp-5); gap: var(--sp-5); transition: all var(--t-fast, .18s) var(--ease, ease); border-left: 4px solid transparent; }
        .alert-card.unread { background: var(--border-low); border-left-color: var(--y-base); }
        .alert-card.read { opacity: 0.8; filter: grayscale(0.5); }
        .alert-card:hover { transform: translateX(var(--sp-2)); background: var(--bg-section); }

        .alert-card-side { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); position: relative; }
        .unread-pulse { width: 8px; height: 8px; background: var(--y-base); border-radius: 50%; box-shadow: 0 0 10px var(--y-base); animation: pulse 2s infinite; position: absolute; top: -4px; right: -4px; }

        .alert-icon-box { width: 44px; height: 44px; border-radius: var(--r); display: flex; align-items: center; justify-content: center; background: var(--bg-section); border: 1px solid var(--border-default); flex-shrink: 0; }
        .alert-icon-box.error { color: var(--error); }
        .alert-icon-box.warning { color: var(--y-base); }
        .alert-icon-box.info { color: var(--info); }

        .alert-card-content { flex: 1; display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
        .alert-header-row { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
        .alert-type-tag { font-size: 0.6rem; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-muted); opacity: 0.5; }
        .alert-time { font-size: 0.75rem; color: var(--text-muted); }

        .alert-title { font-size: 1.1rem; font-weight: 400; color: var(--text-primary); margin: 0; }
        .alert-message { font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin: 0; }

        .alert-footer { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--border-low); }
        .footer-actions { display: flex; gap: var(--sp-5); }
        .btn-mini-action { background: none; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; gap: var(--sp-2); font-size: 0.8rem; font-weight: 500; opacity: 0.6; transition: all var(--t-fast, .18s) var(--ease, ease); }
        .btn-mini-action:hover { opacity: 1; color: var(--y-base); }
        .btn-mini-action.delete:hover { color: var(--error); }

        @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(var(--y-rgb), 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(var(--y-rgb), 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(var(--y-rgb), 0); } }
        @keyframes eliteFadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .elite-notifications-container { padding: var(--sp-4); }
          .alert-card { padding: var(--sp-4); gap: var(--sp-3); }
          .footer-actions { gap: var(--sp-3); }
        }
      `}} />
    </div>
  );
}
