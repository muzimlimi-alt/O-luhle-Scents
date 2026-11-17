import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';
import { AppearanceProvider } from './context/AppearanceProvider';
import { MessagingProvider } from './context/MessagingContext.jsx';

// Route-level code splitting — pages load only when first navigated to.
const n = (mod, key) => mod.then(m => ({ default: m[key] }));
const Dashboard          = lazy(() => n(import('./pages/Dashboard'),          'Dashboard'));
const Products           = lazy(() => n(import('./pages/Products'),           'Products'));
const Categories         = lazy(() => n(import('./pages/Categories'),         'Categories'));
const Collections        = lazy(() => n(import('./pages/Collections'),        'Collections'));
const CatalogueImports   = lazy(() => n(import('./pages/CatalogueImports'),   'CatalogueImports'));
const AttributeDefinitions = lazy(() => n(import('./pages/AttributeDefinitions'), 'AttributeDefinitions'));
const Inventory          = lazy(() => n(import('./pages/Inventory'),          'Inventory'));
const Orders             = lazy(() => n(import('./pages/Orders'),             'Orders'));
const Customers          = lazy(() => import('./pages/Customers'));
const Coupons            = lazy(() => n(import('./pages/Coupons'),            'Coupons'));
const Invoices           = lazy(() => n(import('./pages/Invoices'),           'Invoices'));
const Suppliers          = lazy(() => n(import('./pages/Suppliers'),          'Suppliers'));
const Purchases          = lazy(() => n(import('./pages/Purchases'),          'Purchases'));
const AdminUsers         = lazy(() => n(import('./pages/AdminUsers'),         'AdminUsers'));
const AuditLogs          = lazy(() => n(import('./pages/AuditLogs'),          'AuditLogs'));
const Privacy            = lazy(() => n(import('./pages/Privacy'),            'Privacy'));
const VatReports         = lazy(() => n(import('./pages/VatReports'),         'VatReports'));
const ComplianceDashboard = lazy(() => n(import('./pages/ComplianceDashboard'), 'ComplianceDashboard'));
const Quotes             = lazy(() => n(import('./pages/Quotes'),             'Quotes'));
const Reports            = lazy(() => n(import('./pages/Reports'),            'Reports'));
const Payments           = lazy(() => import('./pages/Payments'));
const Notifications      = lazy(() => import('./pages/Notifications'));
const Settings           = lazy(() => n(import('./pages/Settings'),           'Settings'));
const Preferences        = lazy(() => n(import('./pages/Preferences'),        'Preferences'));
const Content            = lazy(() => n(import('./pages/Content'),            'Content'));
const Newsletters        = lazy(() => n(import('./pages/Newsletters'),        'Newsletters'));
const Testimonials       = lazy(() => import('./pages/Testimonials'));
const ShippingMethods    = lazy(() => n(import('./pages/ShippingMethods'),    'ShippingMethods'));
const TaxRates           = lazy(() => n(import('./pages/TaxRates'),           'TaxRates'));
const GeneralLedger      = lazy(() => n(import('./pages/GeneralLedger'),      'GeneralLedger'));
const Journals           = lazy(() => n(import('./pages/Journals'),           'Journals'));
const FinancialStatements = lazy(() => n(import('./pages/FinancialStatements'), 'FinancialStatements'));
const Banking            = lazy(() => n(import('./pages/Banking'),            'Banking'));
const Reconciliation     = lazy(() => n(import('./pages/Reconciliation'),     'Reconciliation'));
const Expenses           = lazy(() => n(import('./pages/Expenses'),           'Expenses'));
const AgedReports        = lazy(() => n(import('./pages/AgedReports'),        'AgedReports'));
const Campaigns          = lazy(() => n(import('./pages/Campaigns'),          'Campaigns'));
const Reviews            = lazy(() => n(import('./pages/Reviews'),            'Reviews'));
const Wishlists          = lazy(() => n(import('./pages/Wishlists'),          'Wishlists'));
const LegalPolicies      = lazy(() => n(import('./pages/LegalPolicies'),      'LegalPolicies'));

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
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="wishlists" element={<Wishlists />} />
              <Route path="legal-policies" element={<LegalPolicies />} />
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

