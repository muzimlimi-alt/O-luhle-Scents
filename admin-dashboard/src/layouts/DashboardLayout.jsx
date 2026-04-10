import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ThemeToggle } from '../components/ThemeToggle';
import { Search, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/design-tokens.css';
import '../styles/App.css';
import '../styles/buttons.css';

export function DashboardLayout() {
  const { user } = useAuth();

  return (
    <div className="admin-layout">
      {/* Classic Fixed Header */}
      <div className="admin-header-classic">
        <div className="navbar__logo">O'luhle <em>Scents</em></div>
        <div className="header-actions-classic">
           <div className="search-bar-classic">
              <Search size={16} />
              <input type="text" placeholder="Global search..." />
           </div>
           
           <ThemeToggle />
           <div className="user-profile-classic">
              <div className="user-info-text">
                 <p className="user-name">{user?.name || 'Administrator'}</p>
                 <p className="user-email">{user?.email || 'admin@oluhle.com'}</p>
              </div>
              <div className="user-avatar">
                 <User size={18} />
              </div>
           </div>
        </div>
      </div>

      <Sidebar />
      
      <main className="main-content">
        <div className="page-container">
           <Outlet />
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-header-classic {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 70px;
          background: var(--color-bg-dark);
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          z-index: 100;
        }

        .navbar__logo {
          font-family: var(--font-display);
          font-size: 1.5rem;
          color: var(--color-text-header);
          text-decoration: none;
          letter-spacing: 1px;
        }
        .navbar__logo em {
          font-weight: 300;
          font-style: italic;
          color: var(--color-text-muted);
        }

        .header-actions-classic {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .search-bar-classic {
          position: relative;
          display: flex;
          align-items: center;
          background: var(--color-surface);
          border: 1.5px solid var(--color-border);
          padding: 6px 12px;
          border-radius: 4px;
          color: var(--color-primary);
          width: 240px;
          transition: var(--transition);
        }
        .search-bar-classic:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 10px rgba(184, 155, 106, 0.1);
        }
        .search-bar-classic input {
          background: none;
          border: none;
          color: var(--color-text-header);
          font-size: 0.85rem;
          margin-left: 10px;
          outline: none;
          width: 100%;
        }
        .search-bar-classic input::placeholder {
          color: var(--color-text-muted);
          opacity: 1; /* Ensure visibility in Light Mode */
        }

        .user-profile-classic {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-left: 20px;
          border-left: 1px solid var(--color-border);
        }
        .user-info-text { text-align: right; }
        .user-name { font-size: 0.82rem; font-weight: 600; color: var(--color-text-header); }
        .user-email { font-size: 0.7rem; color: var(--color-text-muted); }
        .user-avatar {
          width: 32px; height: 32px;
          background: var(--color-primary);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #000;
        }
      `}} />
    </div>
  );
}

export default DashboardLayout;
