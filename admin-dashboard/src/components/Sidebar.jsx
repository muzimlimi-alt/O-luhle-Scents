import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Package,
  FolderTree,
  SlidersHorizontal,
  Boxes,
  Truck,
  Building2,
  ShoppingCart,
  ShoppingCart as PurchaseIcon,
  Wallet,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Ticket,
  Users,
  Mail,
  FileBarChart,
  Landmark,
  BookOpen,
  ReceiptText,
  PieChart,
  Banknote,
  Receipt,
  History,
  ShieldCheck,
  UserCog,
  ScrollText,
  Bell,
  Settings,
  Cog,
  Layout,
  Sliders,
  Percent,
  Search,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Single source of truth for the sidebar. Adding a page is one entry here —
// either a standalone { type: 'link' } or one more object in a group's
// `children` array. A group's children could themselves grow a further
// `children` array later without restructuring anything else.
const NAV = [
  { type: 'link', path: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  {
    type: 'group', id: 'catalog', label: 'Catalog', icon: <Layers size={18} />,
    children: [
      { path: '/products', label: 'Products', icon: <Package size={16} /> },
      { path: '/categories', label: 'Categories', icon: <FolderTree size={16} /> },
      { path: '/attributes', label: 'Attributes', icon: <SlidersHorizontal size={16} /> },
      { path: '/inventory', label: 'Inventory', icon: <Boxes size={16} /> },
    ]
  },
  {
    type: 'group', id: 'purchasing', label: 'Purchasing', icon: <Truck size={18} />,
    children: [
      { path: '/suppliers', label: 'Suppliers', icon: <Building2 size={16} /> },
      { path: '/purchases', label: 'Purchases', icon: <PurchaseIcon size={16} /> },
    ]
  },
  {
    type: 'group', id: 'sales', label: 'Sales', icon: <Wallet size={18} />,
    children: [
      { path: '/orders', label: 'Orders', icon: <ShoppingCart size={16} /> },
      { path: '/payments', label: 'Payments', icon: <CreditCard size={16} /> },
      { path: '/invoices', label: 'Invoices', icon: <FileText size={16} /> },
      { path: '/quotes', label: 'Quotes', icon: <FileSpreadsheet size={16} /> },
      { path: '/coupons', label: 'Coupons', icon: <Ticket size={16} /> },
    ]
  },
  {
    type: 'group', id: 'customers', label: 'Customers', icon: <Users size={18} />,
    children: [
      { path: '/customers', label: 'Customers', icon: <Users size={16} /> },
      { path: '/newsletters', label: 'Newsletters', icon: <Mail size={16} /> },
    ]
  },
  {
    type: 'group', id: 'finance', label: 'Finance', icon: <Landmark size={18} />,
    children: [
      { path: '/finance/ledger', label: 'General Ledger', icon: <BookOpen size={16} /> },
      { path: '/finance/journals', label: 'Journals', icon: <ReceiptText size={16} /> },
      { path: '/finance/statements', label: 'Financial Statements', icon: <PieChart size={16} /> },
      { path: '/finance/banking', label: 'Banking', icon: <Banknote size={16} /> },
      { path: '/finance/expenses', label: 'Expenses', icon: <Receipt size={16} /> },
      { path: '/finance/aged', label: 'Aged Reports', icon: <History size={16} /> },
    ]
  },
  { type: 'link', path: '/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
  {
    type: 'group', id: 'administration', label: 'Administration', icon: <ShieldCheck size={18} />,
    children: [
      { path: '/admin-users', label: 'Admin Users', icon: <UserCog size={16} /> },
      { path: '/audit-logs', label: 'Audit Logs', icon: <ScrollText size={16} /> },
      { path: '/notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ]
  },
  {
    type: 'group', id: 'configuration', label: 'Configuration', icon: <Settings size={18} />,
    children: [
      { path: '/settings', label: 'Settings', icon: <Cog size={16} /> },
      { path: '/content', label: 'Site Content', icon: <Layout size={16} /> },
      { path: '/preferences', label: 'Preferences', icon: <Sliders size={16} /> },
      { path: '/shipping-methods', label: 'Shipping Methods', icon: <Truck size={16} /> },
      { path: '/tax-rates', label: 'Tax Rates', icon: <Percent size={16} /> },
    ]
  },
];

const EXPANDED_KEY = 'oluhle_admin_nav_expanded';

function loadExpanded() {
  try {
    const saved = localStorage.getItem(EXPANDED_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function findActiveGroupId(pathname) {
  const group = NAV.find(item => item.type === 'group' && item.children.some(c => c.path === pathname));
  return group?.id || null;
}

export function Sidebar({ isOpen = false, onNavigate }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(loadExpanded);
  const [query, setQuery] = useState('');

  // Auto-expand whichever group contains the current route — covers direct
  // navigation, refresh, and links clicked from outside the sidebar — without
  // fighting a user who has deliberately collapsed a *different* group.
  useEffect(() => {
    const activeGroupId = findActiveGroupId(location.pathname);
    if (activeGroupId) {
      setExpanded(prev => (prev.has(activeGroupId) ? prev : new Set(prev).add(activeGroupId)));
    }
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expanded)));
  }, [expanded]);

  const toggleGroup = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const matches = (label) => label.toLowerCase().includes(trimmedQuery);
  const activeGroupId = findActiveGroupId(location.pathname);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-nav">
        <div className="sidebar-search">
          <Search size={14} className="sidebar-search__icon" />
          <input
            type="text"
            placeholder="Search menu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search navigation"
          />
        </div>

        <nav className="nav-links-classic">
          {NAV.map((item) => {
            if (item.type === 'link') {
              if (isSearching && !matches(item.label)) return null;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              );
            }

            const groupLabelMatches = isSearching && matches(item.label);
            const children = isSearching && !groupLabelMatches
              ? item.children.filter((c) => matches(c.label))
              : item.children;
            if (isSearching && children.length === 0) return null;

            const isExpanded = isSearching || expanded.has(item.id);
            const isGroupActive = item.id === activeGroupId;

            return (
              <div className="nav-group" key={item.id}>
                <button
                  type="button"
                  className={`nav-group-header ${isGroupActive ? 'nav-group-header--active' : ''}`}
                  onClick={() => toggleGroup(item.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  <ChevronDown size={14} className={`nav-group-chevron ${isExpanded ? 'nav-group-chevron--open' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="nav-group-children">
                    {children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={onNavigate}
                        className={({ isActive }) => `nav-link nav-link--child ${isActive ? 'active' : ''}`}
                      >
                        <span className="nav-icon">{child.icon}</span>
                        <span className="nav-label">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .nav-label {
           font-size: 0.85rem;
        }

        .sidebar-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 16px 16px;
          padding: 8px 12px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          color: var(--color-text-muted);
          transition: var(--transition);
        }
        .sidebar-search:focus-within {
          border-color: var(--color-primary);
        }
        .sidebar-search__icon { flex-shrink: 0; }
        .sidebar-search input {
          background: none;
          border: none;
          outline: none;
          color: var(--color-text);
          font-size: 0.8rem;
          width: 100%;
        }
        .sidebar-search input::placeholder { color: var(--color-text-muted); }

        .nav-group-header {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 10px 24px;
          font: inherit;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text);
          background: none;
          border: none;
          border-left: 3px solid transparent;
          cursor: pointer;
          text-align: left;
          transition: var(--transition);
        }
        .nav-group-header:hover {
          color: var(--color-primary);
          border-left-color: var(--color-primary);
          background-color: rgba(184, 155, 106, 0.05);
        }
        .nav-group-header--active {
          color: var(--color-primary);
          border-left-color: var(--color-primary);
        }
        .nav-group-header:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--color-border-focus);
        }

        .nav-group-chevron {
          margin-left: auto;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .nav-group-chevron--open { transform: rotate(180deg); }
        @media (prefers-reduced-motion: reduce) {
          .nav-group-chevron { transition: none; }
        }

        .nav-link--child {
          padding-left: 44px;
          font-size: 0.8rem;
        }

        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.25s ease-out;
            z-index: 70;
            width: 260px;
            box-shadow: var(--shadow-lg);
          }
          .sidebar.open { transform: translateX(0); }
        }
      `}} />
    </aside>
  );
}

export default Sidebar;
