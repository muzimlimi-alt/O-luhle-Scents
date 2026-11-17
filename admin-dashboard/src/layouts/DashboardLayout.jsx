import { useState, useEffect, useRef, Suspense } from 'react';
import { Outlet, useLocation, useNavigate, Link, NavLink } from 'react-router-dom';
import { Sidebar, RAIL_KEY } from '../components/Sidebar';
import { Drawer } from '../components/Drawer';
import { AppearancePanel } from '../components/AppearancePanel';
import { Search, Menu, Palette, ChevronDown, Bell, CircleHelp, Sliders, UsersRound, LogOut, LayoutDashboard, ShoppingCart, Package, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppearance } from '../context/AppearanceContext';
import '../styles/design-tokens.css';
import '../styles/atl-tokens.css';
import '../styles/App.css';
import '../styles/buttons.css';
import '../styles/components.css';
import '../styles/appearance.css';
import '../styles/utilities.css';

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
  const mainRef = useRef(null);
  const location = useLocation();

  // Close the mobile drawer automatically on navigation.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Move focus to <main> on route change — announces new page to screen readers.
  useEffect(() => { mainRef.current?.focus(); }, [location.pathname]);

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
      <a href="#main" className="skip-link">Skip to main content</a>
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
              </div>
            )}
          </div>
        </div>
      </header>

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className="main" id="main" ref={mainRef} tabIndex={-1}>
        <div className="page-container">
          <Suspense fallback={<div className="page-fallback">Loading…</div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/orders" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <ShoppingCart size={20} aria-hidden="true" />
          <span>Orders</span>
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Package size={20} aria-hidden="true" />
          <span>Products</span>
        </NavLink>
        <NavLink to="/customers" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Users size={20} aria-hidden="true" />
          <span>Customers</span>
        </NavLink>
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </nav>

      <Drawer isOpen={appearanceOpen} onClose={() => setAppearanceOpen(false)} title="Appearance">
        <AppearancePanel />
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .skip-link {
          position: fixed; top: var(--sp-3); left: var(--sp-3); z-index: 9999;
          padding: var(--sp-2) var(--sp-4);
          background: var(--y-base); color: var(--text-inverse);
          border-radius: var(--r); font-size: .86rem; font-weight: 500;
          text-decoration: none;
          transform: translateY(-200%);
          transition: transform .15s ease;
        }
        .skip-link:focus { transform: translateY(0); outline: none; box-shadow: 0 0 0 3px var(--y-glow); }
        .main:focus { outline: none; }
        .page-fallback { display: flex; align-items: center; justify-content: center; padding: var(--sp-8); color: var(--text-muted); font-size: .86rem; }

        .app {
          display: grid;
          grid-template-columns: var(--nav-w) 1fr;
          grid-template-rows: var(--top-h) 1fr;
          grid-template-areas: "side top" "side main";
          height: 100vh;
          overflow: hidden;
          transition: grid-template-columns .3s var(--ease-out);
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
          transition: border-color .15s ease, color .15s ease;
        }
        .burger:hover { border-color: var(--y-base); color: var(--y-base); }

        .search { position: relative; flex: 1; max-width: 480px; }
        .search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .search input {
          width: 100%; height: 40px;
          padding: 0 var(--sp-4) 0 40px;
          background: var(--bg-surface);
          border: 1px solid var(--border-low);
          border-radius: var(--r-pill);
          color: var(--text-primary);
          font-family: var(--f-body); font-weight: 300; font-size: .88rem;
          transition: border-color .15s ease, background .15s ease;
        }
        .search input::placeholder { color: var(--text-muted); }
        .search input:hover { border-color: var(--border-default); background: var(--bg-elevated); }
        .search input:focus-visible { border-color: var(--y-base); background: var(--bg-elevated); outline: none; box-shadow: 0 0 0 3px rgba(var(--y-rgb), .12); }
        .search kbd {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          font-family: var(--f-mono); font-size: .6rem; color: var(--text-muted);
          border: 1px solid var(--border-low); border-radius: 6px; padding: 2px 7px;
          pointer-events: none; background: var(--bg-section);
        }

        .top-actions { display: flex; align-items: center; gap: var(--sp-2); margin-left: auto; }

        .icon-btn {
          position: relative;
          display: grid; place-items: center;
          width: 36px; height: 36px;
          border: none; border-radius: var(--r);
          color: var(--text-muted);
          background: none;
          cursor: pointer;
          text-decoration: none;
          transition: color .15s ease, background .15s ease;
        }
        .icon-btn:hover { color: var(--y-base); background: var(--bg-surface); text-decoration: none; }

        .acct-wrap { position: relative; margin-left: var(--sp-3); }
        .acct {
          display: flex; align-items: center; gap: var(--sp-3);
          min-height: var(--tap);
          padding: var(--sp-1) var(--sp-2) var(--sp-1) var(--sp-3);
          border: none; border-radius: var(--r-pill);
          background: var(--bg-surface);
          color: var(--text-secondary);
          cursor: pointer;
          transition: background .15s ease;
        }
        .acct:hover { background: var(--bg-elevated); }
        .acct-chev { color: var(--text-muted); transition: transform .2s ease; flex-shrink: 0; }
        .acct[aria-expanded="true"] .acct-chev { transform: rotate(180deg); color: var(--y-base); }

        .avatar {
          width: 32px; height: 32px; flex: none;
          display: grid; place-items: center;
          border-radius: 50%;
          background: linear-gradient(150deg, rgba(var(--y-rgb), .28), rgba(var(--y-rgb), .06));
          font-family: var(--f-display); font-size: .82rem; font-weight: 500;
          color: var(--y-light);
        }
        .acct-meta { display: flex; flex-direction: column; text-align: left; line-height: 1.25; }
        .acct-name { display: block; font-size: .84rem; color: var(--text-primary); white-space: nowrap; font-weight: 400; }
        .acct-role { display: block; font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); }

        .menu {
          position: absolute; top: calc(100% + 8px); right: 0;
          width: 280px; padding: var(--sp-2);
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: var(--r-md);
          box-shadow: var(--sh-lg);
          z-index: 70;
          animation: menuIn .15s var(--ease-out);
        }
        @keyframes menuIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .menu-head {
          display: flex; align-items: center; gap: var(--sp-3);
          padding: var(--sp-3);
          border-bottom: 1px solid var(--border-low);
          margin-bottom: var(--sp-2);
        }
        .menu-id { display: flex; flex-direction: column; min-width: 0; line-height: 1.35; }
        .menu-id b { font-weight: 400; color: var(--text-primary); font-size: .86rem; }
        .menu-id span { font-family: var(--f-mono); font-size: .66rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }
        .menu-item {
          display: flex; align-items: center; gap: var(--sp-3);
          width: 100%; min-height: 40px;
          padding: 0 var(--sp-3);
          text-align: left; font-size: .86rem;
          color: var(--text-secondary);
          background: none; border: none;
          border-radius: var(--r);
          cursor: pointer;
          text-decoration: none;
          transition: background .12s ease, color .12s ease;
        }
        .menu-item:hover, .menu-item:focus-visible { background: rgba(var(--y-rgb), .06); color: var(--text-primary); text-decoration: none; }
        .menu-item svg { width: 16px; flex: none; color: var(--text-muted); transition: color .12s ease; }
        .menu-item:hover svg { color: var(--y-base); }
        .menu-hint { margin-left: auto; font-size: .64rem; letter-spacing: .08em; text-transform: uppercase; color: var(--y-base); white-space: nowrap; opacity: .8; }
        .menu-sep { display: block; height: 1px; background: var(--border-low); margin: var(--sp-2) var(--sp-3); }

        .main { grid-area: main; overflow-y: auto; min-width: 0; }
        .page-container { max-width: 1400px; padding: var(--sp-6); }

        .scrim { display: none; }

        .bottom-nav { display: none; }

        @media (max-width: 1024px) {
          .app { grid-template-columns: 1fr; grid-template-areas: "top" "main"; }
          .burger { display: flex; }
          .search { max-width: none; }
          .scrim {
            display: block; position: fixed; inset: 0; top: var(--top-h);
            background: rgba(0, 0, 0, .45); backdrop-filter: blur(2px); z-index: 55;
          }
        }

        @media (max-width: 768px) {
          .search kbd, .acct-meta { display: none; }
          .top { padding: 0 var(--sp-4); gap: var(--sp-2); }
        }

        @media (max-width: 480px) {
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 64px;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background: var(--bg-section);
            border-top: 1px solid var(--border-low);
            z-index: 50;
            align-items: stretch;
            justify-content: space-around;
          }
          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            flex: 1;
            min-width: 0;
            padding: var(--sp-2) 0;
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: .62rem;
            letter-spacing: .04em;
            text-decoration: none;
            cursor: pointer;
            transition: color .15s ease;
          }
          .bottom-nav-item:hover,
          .bottom-nav-item:focus-visible { color: var(--text-primary); text-decoration: none; }
          .bottom-nav-item.active { color: var(--y-base); }
          .bottom-nav-item.active svg { color: var(--y-base); }

          .page-container { padding: var(--sp-4); padding-bottom: calc(var(--sp-4) + 72px); }
          .burger { display: none; }
        }
      `}} />
    </div>
  );
}

export default DashboardLayout;
