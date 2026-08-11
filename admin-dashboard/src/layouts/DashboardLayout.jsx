<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Sidebar, RAIL_KEY } from '../components/Sidebar';
import { Drawer } from '../components/Drawer';
import { AppearancePanel } from '../components/AppearancePanel';
import { Search, Menu, Palette, ChevronDown, Bell, CircleHelp, Sliders, UsersRound, LogOut } from 'lucide-react';
=======
import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { ThemeToggle } from '../components/ThemeToggle';
import { Search, User, Menu } from 'lucide-react';
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
import { useAuth } from '../context/AuthContext';
import { useAppearance } from '../context/AppearanceContext';
import '../styles/design-tokens.css';
import '../styles/App.css';
import '../styles/buttons.css';
import '../styles/appearance.css';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const initials = (name) => {
  if (!name) return 'A';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

function loadRail() {
  try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { appearance } = useAppearance();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRail, setIsRail] = useState(loadRail);
  const [acctOpen, setAcctOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const acctMenuRef = useRef(null);
  const searchRef = useRef(null);
  const location = useLocation();

  // Close the mobile drawer automatically on navigation (mobile/tablet only —
  // harmless no-op on desktop since the sidebar isn't a drawer there).
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem(RAIL_KEY, isRail ? '1' : '0'); } catch { /* noop */ }
  }, [isRail]);

  // Lightweight non-modal dropdown — close on outside click or Escape.
  // The Appearance panel itself opens in a Drawer, which already has full
  // focus-trap/Esc handling via overlayStack.js.
  useEffect(() => {
    if (!acctOpen) return undefined;
    const handleClick = (e) => {
      if (acctMenuRef.current && !acctMenuRef.current.contains(e.target)) {
        setAcctOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') setAcctOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [acctOpen]);

  // Cmd/Ctrl+K focuses global search, matching the reference shell.
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`app ${isRail ? 'rail' : ''}`}>
      <Sidebar
        isOpen={menuOpen}
        onNavigate={() => setMenuOpen(false)}
        isRail={isRail}
        onToggleRail={() => setIsRail((r) => !r)}
      />

      <header className="top">
        <button
          type="button"
          className="burger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <Menu size={20} />
        </button>

        <div className="search">
          <Search size={15} aria-hidden="true" />
          <label className="vh" htmlFor="globalSearch">Search orders, products and customers</label>
          <input ref={searchRef} id="globalSearch" type="search" placeholder="Search orders, products, customers…" />
          <kbd aria-hidden="true">&#8984;K</kbd>
        </div>

        <div className="top-actions">
          <Link to="/notifications" className="icon-btn" aria-label="Notifications">
            <Bell size={17} />
          </Link>
          <button type="button" className="icon-btn" aria-label="Help and documentation">
            <CircleHelp size={17} />
          </button>
<<<<<<< HEAD

          <div className="acct-wrap" ref={acctMenuRef}>
            <button
              type="button"
              className="acct"
              onClick={() => setAcctOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={acctOpen}
            >
              <span className="avatar" aria-hidden="true">{initials(user?.name)}</span>
              <span className="acct-meta">
                <span className="acct-name">{user?.name || 'Administrator'}</span>
                <span className="acct-role">{user?.role || 'Administrator'}</span>
              </span>
              <ChevronDown size={13} className="acct-chev" aria-hidden="true" />
            </button>

            {acctOpen && (
              <div className="menu" role="menu" aria-label="Account">
                <div className="menu-head">
                  <span className="avatar" aria-hidden="true">{initials(user?.name)}</span>
                  <span className="menu-id">
                    <b>{user?.name || 'Administrator'}</b>
                    <span>{user?.email || 'admin@toca.co.za'}</span>
                  </span>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => { setAppearanceOpen(true); setAcctOpen(false); }}
                >
                  <Palette size={15} aria-hidden="true" /> Appearance
                  <span className="menu-hint">{cap(appearance.finish)} · {cap(appearance.accent)}</span>
                </button>
                <Link role="menuitem" className="menu-item" to="/settings" onClick={() => setAcctOpen(false)}>
                  <Sliders size={15} aria-hidden="true" /> Account settings
                </Link>
                <Link role="menuitem" className="menu-item" to="/admin-users" onClick={() => setAcctOpen(false)}>
                  <UsersRound size={15} aria-hidden="true" /> Team &amp; roles
                </Link>
                <span className="menu-sep" role="separator" />
                <button type="button" role="menuitem" className="menu-item" onClick={handleSignOut}>
                  <LogOut size={15} aria-hidden="true" /> Sign out
                </button>
=======
          <div className="navbar__logo">TOCA</div>
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
                 <p className="user-email">{user?.email || 'admin@toca.co.za'}</p>
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
              </div>
            )}
          </div>
        </div>
      </header>

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className="main" id="main">
        <div className="page-container">
          <Outlet />
        </div>
      </main>

      <Drawer isOpen={appearanceOpen} onClose={() => setAppearanceOpen(false)} title="Appearance">
        <AppearancePanel />
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .app {
          display: grid;
          grid-template-columns: var(--nav-w) 1fr;
          grid-template-rows: var(--top-h) 1fr;
          grid-template-areas: "side top" "side main";
          height: 100vh;
          overflow: hidden;
          transition: grid-template-columns var(--t) var(--ease-out);
        }
        .app.rail { grid-template-columns: var(--nav-w-rail) 1fr; }

        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .top {
          grid-area: top;
          display: flex;
          align-items: center;
          gap: var(--sp-4);
          padding: 0 var(--sp-6);
          background: var(--bg-page);
          border-bottom: 1px solid var(--border-low);
          z-index: 50;
        }

        .burger {
          display: none;
          width: var(--tap); height: var(--tap);
          align-items: center; justify-content: center;
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--r);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
        }
        .burger:hover { border-color: var(--y-base); color: var(--y-base); }

        .search { position: relative; flex: 1; max-width: 440px; }
        .search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .search input {
          width: 100%; height: var(--tap);
          padding: 0 var(--sp-4) 0 40px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--r);
          color: var(--text-primary);
          font-family: var(--f-body); font-weight: 300; font-size: .9rem;
        }
        .search input::placeholder { color: var(--text-muted); }
        .search input:hover { border-color: var(--border-strong); }
        .search input:focus-visible { border-color: var(--y-base); outline-offset: 1px; }
        .search kbd {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          font-family: var(--f-mono); font-size: .62rem; color: var(--text-muted);
          border: 1px solid var(--border-default); border-radius: var(--r); padding: 3px 6px;
          pointer-events: none;
        }

        .top-actions { display: flex; align-items: center; gap: var(--sp-2); margin-left: auto; }

        .icon-btn {
          position: relative;
          display: grid; place-items: center;
          width: var(--tap); height: var(--tap);
          border: 1px solid transparent; border-radius: var(--r);
          color: var(--text-secondary);
          background: none;
          cursor: pointer;
          text-decoration: none;
          transition: all var(--t-fast) var(--ease);
        }
        .icon-btn:hover { border-color: var(--y-dark); color: var(--y-base); background: var(--bg-surface); text-decoration: none; }

        .acct-wrap { position: relative; margin-left: var(--sp-2); }
        .acct {
          display: flex; align-items: center; gap: var(--sp-3);
          min-height: var(--tap);
          padding: 0 var(--sp-3) 0 var(--sp-2);
          border: none; border-left: 1px solid var(--border-low);
          border-radius: var(--r);
          background: none;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .acct:hover { color: var(--text-primary); }
        .acct-chev { color: var(--text-muted); transition: transform var(--t-fast) var(--ease); flex-shrink: 0; }
        .acct[aria-expanded="true"] .acct-chev { transform: rotate(180deg); color: var(--y-base); }

        .avatar {
          width: 34px; height: 34px; flex: none;
          display: grid; place-items: center;
          border: 1px solid var(--y-dark);
          background: linear-gradient(150deg, rgba(var(--y-rgb), .22), rgba(var(--y-rgb), .03));
          font-family: var(--f-display); font-size: .9rem;
          color: var(--y-light);
        }
        .acct-meta { display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
        .acct-name { display: block; font-size: .86rem; color: var(--text-primary); white-space: nowrap; }
        .acct-role { display: block; font-size: .66rem; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); }

        .menu {
          position: absolute; top: calc(100% + 10px); right: 0;
          width: 284px; padding: var(--sp-2);
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-top: 2px solid var(--y-base);
          border-radius: var(--r);
          box-shadow: var(--sh-xl);
          z-index: 70;
        }
        .menu-head {
          display: flex; align-items: center; gap: var(--sp-3);
          padding: var(--sp-3);
          border-bottom: 1px solid var(--border-low);
          margin-bottom: var(--sp-2);
        }
        .menu-id { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
        .menu-id b { font-weight: 400; color: var(--text-primary); font-size: .88rem; }
        .menu-id span { font-family: var(--f-mono); font-size: .68rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
        .menu-item {
          display: flex; align-items: center; gap: var(--sp-3);
          width: 100%; min-height: var(--tap);
          padding: 0 var(--sp-3);
          text-align: left; font-size: .88rem;
          color: var(--text-secondary);
          background: none; border: none;
          border-radius: var(--r);
          cursor: pointer;
          text-decoration: none;
          transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
        }
        .menu-item:hover, .menu-item:focus-visible { background: var(--bg-surface); color: var(--text-primary); text-decoration: none; }
        .menu-item svg { width: 18px; flex: none; color: var(--text-muted); }
        .menu-item:hover svg { color: var(--y-base); }
        .menu-hint { margin-left: auto; font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; color: var(--y-base); white-space: nowrap; }
        .menu-sep { display: block; height: 1px; background: var(--border-low); margin: var(--sp-2) var(--sp-3); }

        .main { grid-area: main; overflow-y: auto; min-width: 0; }
        .page-container { padding: var(--sp-6); }

        .scrim { display: none; }

        @media (max-width: 1080px) {
          .app { grid-template-columns: 1fr; grid-template-areas: "top" "main"; }
          .burger { display: flex; }
          .search { max-width: none; }
          .scrim {
            display: block; position: fixed; inset: 0; top: var(--top-h);
            background: rgba(0, 0, 0, .5); z-index: 55;
          }
        }

        @media (max-width: 720px) {
          .search kbd, .acct-meta { display: none; }
          .top { padding: 0 var(--sp-4); gap: var(--sp-2); }
        }
      `}} />
    </div>
  );
}

export default DashboardLayout;
