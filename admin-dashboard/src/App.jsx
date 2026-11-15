import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Categories } from './pages/Categories';
import { Collections } from './pages/Collections';
import { CatalogueImports } from './pages/CatalogueImports';
import { AttributeDefinitions } from './pages/AttributeDefinitions';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
import Customers from './pages/Customers';
import { Coupons } from './pages/Coupons';
import { Invoices } from './pages/Invoices';
import { Suppliers } from './pages/Suppliers';
import { Purchases } from './pages/Purchases';
import { AdminUsers } from './pages/AdminUsers';
import { AuditLogs } from './pages/AuditLogs';
import { Privacy } from './pages/Privacy';
import { VatReports } from './pages/VatReports';
import { ComplianceDashboard } from './pages/ComplianceDashboard';
import { Quotes } from './pages/Quotes';
import { Reports } from './pages/Reports';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';

import { Settings } from './pages/Settings';
import { Preferences } from './pages/Preferences';
import { Content } from './pages/Content';
import { Login } from './pages/Login';
import { Newsletters } from './pages/Newsletters';
import Testimonials from './pages/Testimonials';
import { ShippingMethods } from './pages/ShippingMethods';
import { TaxRates } from './pages/TaxRates';
import { GeneralLedger } from './pages/GeneralLedger';
import { Journals } from './pages/Journals';
import { FinancialStatements } from './pages/FinancialStatements';
import { Banking } from './pages/Banking';
import { Reconciliation } from './pages/Reconciliation';
import { Expenses } from './pages/Expenses';
import { AgedReports } from './pages/AgedReports';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';
import { AppearanceProvider } from './context/AppearanceProvider';

// Protective Layer
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="flex-center" style={{ height: '100vh', background: 'var(--color-bg-dark)' }}>
      <div className="loader-gold"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
};





// Temporary/Minor modules placeholders
const Placeholder = ({ title }) => (
  <div className="card">
    <h2 className="page-title">{title}</h2>
    <p style={{ marginTop: '20px', color: 'var(--color-text-muted)' }}>
      This module is being connected to the PostgreSQL engine.
    </p>
  </div>
);

import { MessagingProvider } from './context/MessagingContext.jsx';

function App() {
  return (
    <MessagingProvider>
      <AuthProvider>
        <AppearanceProvider>
        <BrowserRouter basename="/admin">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="analytics" element={<Navigate to="/" replace />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="collections" element={<Collections />} />
              <Route path="catalogue-imports" element={<CatalogueImports />} />
              <Route path="attributes" element={<AttributeDefinitions />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="orders" element={<Orders />} />
              <Route path="payments" element={<Payments />} />
              <Route path="customers" element={<Customers />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="quotes" element={<Quotes />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="newsletters" element={<Newsletters />} />
              <Route path="testimonials" element={<Testimonials />} />
              <Route path="admin-users" element={<AdminUsers />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="sars" element={<ComplianceDashboard />} />
              <Route path="sars/vat" element={<VatReports />} />
              <Route path="preferences" element={<Preferences />} />
              <Route path="content" element={<Content />} />
              <Route path="shipping-methods" element={<ShippingMethods />} />
              <Route path="tax-rates" element={<TaxRates />} />
              <Route path="finance/ledger" element={<GeneralLedger />} />
              <Route path="finance/journals" element={<Journals />} />
              <Route path="finance/statements" element={<FinancialStatements />} />
              <Route path="finance/banking" element={<Banking />} />
              <Route path="finance/reconciliation/:accountId" element={<Reconciliation />} />
              <Route path="finance/expenses" element={<Expenses />} />
              <Route path="finance/aged" element={<AgedReports />} />
              <Route path="config" element={<Navigate to="/settings" replace />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </AppearanceProvider>
      </AuthProvider>
    </MessagingProvider>
  );
}

export default App;

