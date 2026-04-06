import React, { useState, useEffect } from 'react';
import { adminOpsApi } from '../services/api';
import { Bell, AlertTriangle, Package, CheckCircle, Clock } from 'lucide-react';
import { DateTime } from 'luxon';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const data = await adminOpsApi.notifications.list();
        setNotifications(data);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await adminOpsApi.notifications.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'LOW_STOCK': return <AlertTriangle className="status--error-text" size={20} />;
      case 'NEW_ORDER': return <Package className="status--paid-text" size={20} />;
      default: return <Bell size={20} />;
    }
  };

  return (
    <div className="notifications-page">
      <div className="content-header">
        <h2 className="page-title">Operational Intelligence</h2>
        <p className="page-subtitle">Critical alerts and system notifications for the O'luhle ecosystem</p>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Gathering intelligence...</div>
        ) : (
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                <Bell size={48} strokeWidth={1} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <p>System is operating within optimal parameters.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`notification-item ${n.isRead ? 'is-read' : 'is-unread'}`}>
                  <div className="notification-icon">
                    {getIcon(n.type)}
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">{n.message}</p>
                    <div className="notification-footer">
                      <span className="notification-time">
                        <Clock size={12} /> {DateTime.fromISO(n.createdAt).toRelative()}
                      </span>
                      {!n.isRead && (
                        <button 
                          className="text-btn" 
                          onClick={() => markAsRead(n.id)}
                          style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                  {!n.isRead && <div className="unread-dot"></div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .notification-list {
          display: flex;
          flex-direction: column;
        }
        .notification-item {
          display: flex;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid var(--color-border-light);
          position: relative;
          transition: background 0.2s ease;
        }
        .notification-item:hover {
          background: #fafafa;
        }
        .notification-item.is-unread {
          background: rgba(212, 175, 55, 0.03);
        }
        .notification-item.is-read {
          opacity: 0.7;
        }
        .notification-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-sm);
        }
        .notification-content {
          flex: 1;
        }
        .notification-message {
          font-weight: 500;
          margin-bottom: 8px;
          color: var(--color-text);
        }
        .notification-footer {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .notification-time {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .unread-dot {
          position: absolute;
          top: 24px;
          right: 20px;
          width: 8px;
          height: 8px;
          background: var(--color-primary);
          border-radius: 50%;
        }
      `}} />
    </div>
  );
}
