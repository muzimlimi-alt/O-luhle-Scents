import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3, 
  Package, 
  Boxes, 
  ShoppingCart, 
  CreditCard, 
  Users, 
  Ticket, 
  FileText, 
  Truck, 
  ShoppingCart as PurchaseIcon, 
  Bell, 
  UserCog, 
  ScrollText,
  Settings,
  LogOut,
  Mail,
  Layout,
  FolderTree,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const sidebarLinks = [
  { path: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  { path: '/orders', label: 'Orders', icon: <ShoppingCart size={18} /> },
  { path: '/payments', label: 'Payments', icon: <CreditCard size={18} /> },
  { path: '/products', label: 'Products', icon: <Package size={18} /> },
  { path: '/categories', label: 'Categories', icon: <FolderTree size={18} /> },
  { path: '/attributes', label: 'Attributes', icon: <SlidersHorizontal size={18} /> },
  { path: '/inventory', label: 'Inventory', icon: <Boxes size={18} /> },
  { path: '/notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { path: '/quotes', label: 'Quotes', icon: <FileText size={18} /> },
  { path: '/customers', label: 'Customers', icon: <Users size={18} /> },
  { path: '/invoices', label: 'Invoices', icon: <FileText size={18} /> },
  { path: '/suppliers', label: 'Suppliers', icon: <Truck size={18} /> },
  { path: '/purchases', label: 'Purchases', icon: <PurchaseIcon size={18} /> },
  { path: '/admin-users', label: 'Admin Users', icon: <UserCog size={18} /> },
  { path: '/newsletters', label: 'Newsletters', icon: <Mail size={18} /> },
  { path: '/audit-logs', label: 'Audit Logs', icon: <ScrollText size={18} /> },
  { path: '/content', label: 'Site Content', icon: <Layout size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export function Sidebar({ isOpen = false, onNavigate }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-nav">
        <p className="sidebar-section-label">Dashboard</p>
        <nav className="nav-links-classic">
          {sidebarLinks.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onNavigate}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sidebar-section-label {
          padding: 0 24px 16px;
          font-size: 0.65rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-sidebar-header);
          margin: 0;
        }
        .nav-label {
           font-size: 0.85rem;
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
