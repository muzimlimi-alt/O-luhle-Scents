import { useState, useEffect } from 'react';
<<<<<<< HEAD
import { NavLink, useLocation } from 'react-router-dom';
=======
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
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
  Quote,
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
<<<<<<< HEAD
  ChevronRight,
  ChevronsLeft,
=======
  Search,
  ChevronDown,
  LogOut,
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239
  Lock,
  FileCheck,
  Calculator
} from 'lucide-react';

// Single source of truth for the sidebar, grouped into the same four
// sections as the reference design (Insight/Commerce/Revenue/Workspace).
// Adding a page is one entry here — either a standalone { type: 'link' }
// or one more object in a group's `children` array, under whichever
// section it belongs to.
const NAV = [
  {
    section: 'Insight',
    items: [
      { type: 'link', path: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
      { type: 'link', path: '/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
    ],
  },
  {
    section: 'Commerce',
    items: [
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
          { path: '/testimonials', label: 'Testimonials', icon: <Quote size={16} /> },
        ]
      },
    ],
  },
  {
    section: 'Revenue',
    items: [
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
      {
        type: 'group', id: 'sars', label: 'SARS Compliance', icon: <FileCheck size={18} />,
        children: [
          { path: '/sars', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
          { path: '/sars/vat', label: 'VAT Reports', icon: <Calculator size={16} /> },
        ]
      },
    ],
  },
  {
<<<<<<< HEAD
    section: 'Workspace',
    items: [
      {
        type: 'group', id: 'administration', label: 'Administration', icon: <ShieldCheck size={18} />,
        children: [
          { path: '/admin-users', label: 'Admin Users', icon: <UserCog size={16} /> },
          { path: '/audit-logs', label: 'Audit Logs', icon: <ScrollText size={16} /> },
          { path: '/privacy', label: 'Privacy & POPIA', icon: <Lock size={16} /> },
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
    ],
  },
];

const ALL_GROUPS = NAV.flatMap((s) => s.items).filter((i) => i.type === 'group');

const EXPANDED_KEY = 'toca_admin_nav_expanded';
export const RAIL_KEY = 'toca_admin_nav_rail';
=======
    type: 'group', id: 'customers', label: 'Customers', icon: <Users size={18} />,
    children: [
      { path: '/customers', label: 'Customers', icon: <Users size={16} /> },
      { path: '/newsletters', label: 'Newsletters', icon: <Mail size={16} /> },
      { path: '/testimonials', label: 'Testimonials', icon: <Quote size={16} /> },
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
  {
    type: 'group', id: 'sars', label: 'SARS Compliance', icon: <FileCheck size={18} />,
    children: [
      { path: '/sars', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
      { path: '/sars/vat', label: 'VAT Reports', icon: <Calculator size={16} /> },
    ]
  },
  { type: 'link', path: '/reports', label: 'Reports', icon: <FileBarChart size={18} /> },
  {
    type: 'group', id: 'administration', label: 'Administration', icon: <ShieldCheck size={18} />,
    children: [
      { path: '/admin-users', label: 'Admin Users', icon: <UserCog size={16} /> },
      { path: '/audit-logs', label: 'Audit Logs', icon: <ScrollText size={16} /> },
      { path: '/privacy', label: 'Privacy & POPIA', icon: <Lock size={16} /> },
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

const EXPANDED_KEY = 'toca_admin_nav_expanded';
>>>>>>> cc1345d8f96b760d66ac13c97afed99b99705239

function loadExpanded() {
  try {
    const saved = localStorage.getItem(EXPANDED_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function findActiveGroupId(pathname) {
  const group = ALL_GROUPS.find((item) => item.children.some((c) => c.path === pathname));
  return group?.id || null;
}

export function Sidebar({ isOpen = false, onNavigate, isRail = false, onToggleRail }) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(loadExpanded);

  // Auto-expand whichever group contains the current route — covers direct
  // navigation, refresh, and links clicked from outside the sidebar — without
  // fighting a user who has deliberately collapsed a *different* group.
  useEffect(() => {
    const activeGroupId = findActiveGroupId(location.pathname);
    if (activeGroupId) {
      setExpanded((prev) => (prev.has(activeGroupId) ? prev : new Set(prev).add(activeGroupId)));
    }
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(expanded)));
  }, [expanded]);

  const toggleGroup = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeGroupId = findActiveGroupId(location.pathname);

  return (
    <aside className={`side ${isOpen ? 'nav-open' : ''} ${isRail ? 'rail' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">T</span>
        <span className="brand-txt">
          <span className="brand-name">TOCA</span>
          <span className="brand-sub">Admin</span>
        </span>
      </div>

      <nav className="nav" aria-label="Sections">
        {NAV.map((section) => (
          <div key={section.section}>
            <p className="nav-label">{section.section}</p>
            {section.items.map((item) => {
              if (item.type === 'link') {
                return (
                  <div className="nav-group" key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) => `nav-item ${isActive ? 'is-current' : ''}`}
                    >
                      <span className="ic">{item.icon}</span>
                      <span className="lbl">{item.label}</span>
                    </NavLink>
                  </div>
                );
              }

              const isExpanded = expanded.has(item.id);
              const isGroupActive = item.id === activeGroupId;

              return (
                <div className={`nav-group ${isExpanded ? 'open' : ''}`} key={item.id}>
                  <button
                    type="button"
                    className={`nav-item ${isGroupActive ? 'is-current' : ''}`}
                    onClick={() => toggleGroup(item.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`sub-${item.id}`}
                  >
                    <span className="ic">{item.icon}</span>
                    <span className="lbl">{item.label}</span>
                    <span className="chev" aria-hidden="true"><ChevronRight size={12} /></span>
                  </button>
                  <ul className="nav-sub" id={`sub-${item.id}`} data-title={item.label}>
                    <div>
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <NavLink
                            to={child.path}
                            onClick={onNavigate}
                            className={({ isActive }) => (isActive ? 'is-current' : '')}
                          >
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </div>
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <button
          type="button"
          className="rail-toggle"
          onClick={onToggleRail}
          aria-expanded={!isRail}
          aria-label={isRail ? 'Expand side menu' : 'Collapse side menu'}
        >
          <span className="ic" aria-hidden="true"><ChevronsLeft size={18} /></span>
          <span className="lbl">{isRail ? 'Expand menu' : 'Collapse menu'}</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .side {
          grid-area: side;
          display: flex;
          flex-direction: column;
          background: var(--bg-section);
          border-right: 1px solid var(--border-low);
          min-width: 0;
          z-index: 60;
          transition: width var(--t) var(--ease-out);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: var(--sp-3);
          height: var(--top-h);
          padding: 0 var(--sp-5);
          border-bottom: 1px solid var(--border-low);
          flex: none;
          overflow: hidden;
        }
        .brand-mark {
          flex: none;
          width: 32px; height: 32px;
          display: grid; place-items: center;
          border: 1px solid var(--y-dark);
          font-family: var(--f-display);
          font-size: 1.1rem;
          color: var(--y-base);
        }
        .brand-txt { display: flex; flex-direction: column; line-height: 1.2; overflow: hidden; }
        .brand-name { font-family: var(--f-display); font-size: 1.05rem; letter-spacing: .18em; color: var(--text-primary); white-space: nowrap; }
        .brand-sub { font-size: .62rem; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); white-space: nowrap; }
        .side.rail .brand { padding: 0; justify-content: center; }
        .side.rail .brand-txt { display: none; }

        .nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: var(--sp-5) var(--sp-3) var(--sp-4);
          scrollbar-width: thin;
        }
        .nav-label {
          font-size: .6rem;
          letter-spacing: .26em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0 var(--sp-3);
          margin: var(--sp-5) 0 var(--sp-2);
        }
        .nav-label:first-child { margin-top: 0; }
        .side.rail .nav-label { opacity: 0; height: 8px; margin: var(--sp-4) 0 0; overflow: hidden; }

        .nav-group { position: relative; margin-bottom: 2px; }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--sp-3);
          width: 100%;
          min-height: var(--tap);
          padding: 10px var(--sp-3);
          text-align: left;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-left: 2px solid transparent;
          border-radius: var(--r);
          cursor: pointer;
          transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
          text-decoration: none;
        }
        .nav-item:hover { background: var(--bg-elevated); color: #fff; text-decoration: none; }
        .nav-item .ic { width: 20px; flex: none; display: inline-flex; justify-content: center; color: var(--text-muted); transition: color var(--t-fast) var(--ease); }
        .nav-item:hover .ic { color: var(--y-base); }
        .nav-item .lbl { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: .92rem; letter-spacing: .01em; }
        .nav-item .chev { display: inline-flex; font-size: .62rem; color: var(--text-muted); transition: transform var(--t) var(--ease); }
        .nav-item[aria-expanded="true"] .chev { transform: rotate(90deg); }
        .nav-item.is-current { background: linear-gradient(90deg, rgba(var(--y-rgb), .15), transparent 70%); color: #fff; border-left-color: var(--y-base); }
        .nav-item.is-current .ic { color: var(--y-base); }
        .nav-item:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--color-border-focus); }

        .side.rail .nav-item { justify-content: center; padding: 10px 0; }
        .side.rail .nav-item .lbl, .side.rail .nav-item .chev { display: none; }

        .nav-sub {
          list-style: none;
          margin: 2px 0 var(--sp-2);
          padding: 0 0 0 var(--sp-5);
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows var(--t) var(--ease-out);
        }
        .nav-sub > div { overflow: hidden; min-height: 0; visibility: hidden; transition: visibility var(--t); }
        .nav-group.open .nav-sub { grid-template-rows: 1fr; }
        .nav-group.open .nav-sub > div { visibility: visible; }
        .nav-sub a {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--sp-2);
          min-height: 36px;
          padding: 6px var(--sp-3);
          color: var(--text-muted);
          font-size: .86rem;
          border-left: 1px solid var(--border-low);
          border-radius: 0;
          text-decoration: none;
        }
        .nav-sub a:hover { color: #fff; border-left-color: var(--y-dark); background: rgba(255, 255, 255, .03); text-decoration: none; }
        .nav-sub a.is-current { color: var(--y-base); border-left-color: var(--y-base); }
        .nav-sub a:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--color-border-focus); }

        .side.rail .nav-sub {
          position: absolute; left: 100%; top: 0; z-index: 80;
          width: 224px; margin: 0; padding: var(--sp-2);
          background: var(--bg-elevated); border: 1px solid var(--border-default);
          border-left: 2px solid var(--y-base); box-shadow: var(--sh-xl);
          grid-template-rows: 1fr;
          opacity: 0; visibility: hidden; transform: translateX(-10px);
          transition: opacity var(--t-fast) var(--ease), transform var(--t) var(--ease-out), visibility var(--t);
        }
        .side.rail .nav-group:hover .nav-sub,
        .side.rail .nav-group:focus-within .nav-sub {
          opacity: 1; visibility: visible; transform: translateX(0);
        }
        .side.rail .nav-group .nav-sub > div { visibility: inherit; }
        .side.rail .nav-sub::before {
          content: attr(data-title);
          display: block;
          font-size: .6rem; letter-spacing: .24em; text-transform: uppercase;
          color: var(--y-base);
          padding: var(--sp-2) var(--sp-3) var(--sp-2);
        }
        .side.rail .nav-sub a { border-left: 0; padding-left: var(--sp-3); }

        .side-foot { flex: none; border-top: 1px solid var(--border-low); padding: var(--sp-3); }

        .rail-toggle {
          display: flex; align-items: center; gap: var(--sp-3);
          width: 100%; min-height: var(--tap); padding: 0 var(--sp-3);
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); border-radius: var(--r);
        }
        .rail-toggle:hover { background: var(--bg-elevated); color: var(--y-base); }
        .rail-toggle .ic { width: 20px; display: inline-flex; justify-content: center; transition: transform var(--t) var(--ease); }
        .rail-toggle .lbl { font-size: .82rem; white-space: nowrap; }
        .side.rail .rail-toggle { justify-content: center; padding: 0; }
        .side.rail .rail-toggle .lbl { display: none; }
        .side.rail .rail-toggle .ic { transform: rotate(180deg); }

        @media (max-width: 1080px) {
          .side {
            position: fixed; top: 0; left: 0; width: var(--nav-w); height: 100vh;
            transform: translateX(-100%); visibility: hidden;
            transition: transform var(--t) var(--ease-out), visibility var(--t);
            box-shadow: var(--sh-xl);
          }
          .side.nav-open { transform: none; visibility: visible; }
          .side.rail { width: var(--nav-w); }
          .side-foot { display: none; }
        }
      `}} />
    </aside>
  );
}

export default Sidebar;
