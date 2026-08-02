import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ThemeToggle } from '../components/ThemeToggle';
import { Search, User, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/design-tokens.css';
import '../styles/App.css';
import '../styles/buttons.css';

export function DashboardLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the drawer automatically on navigation (mobile/tablet only —
  // harmless no-op on desktop since the sidebar isn't a drawer there).
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="admin-layout">
      {/* Classic Fixed Header */}
      <div className="admin-header-classic">
        <div className="header-left-classic">
          <button
            className="mobile-menu-toggle"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <Menu size={22} />
          </button>
          <div className="navbar__logo">O'luhle <em>Scents</em></div>
        </div>
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

      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <Sidebar isOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />

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

        .header-left-classic {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          color: var(--color-text);
          width: 38px; height: 38px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .mobile-menu-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .navbar__logo {
          font-family: var(--font-display);
          font-size: 1.5rem;
          color: var(--color-text-header);
          text-decoration: none;
          letter-spacing: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

        .sidebar-backdrop {
          display: none;
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

        /* ── Tablet & mobile: sidebar becomes an off-canvas drawer ──
           Placed last deliberately: these override base rules above
           (.search-bar-classic, .user-info-text etc.) of equal
           specificity, and in plain CSS the later rule in source order
           wins ties — @media doesn't change that. ── */
        @media (max-width: 1024px) {
          .mobile-menu-toggle { display: flex; }
          .admin-header-classic { padding: 0 20px; }
          .search-bar-classic { display: none; }
          .user-info-text { display: none; }
          .user-profile-classic { padding-left: 0; border-left: none; }

          .sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            top: 70px;
            background: rgba(0, 0, 0, 0.5);
            z-index: 60;
          }
        }

        @media (max-width: 480px) {
          .admin-header-classic { padding: 0 14px; }
          .header-actions-classic { gap: 12px; }
          .navbar__logo { font-size: 1.2rem; }
        }
      `}} />
    </div>
  );
}

export default DashboardLayout;
