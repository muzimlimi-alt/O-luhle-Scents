import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Coupons } from './pages/Coupons';
import { Invoices } from './pages/Invoices';
import { Suppliers } from './pages/Suppliers';
import { Purchases } from './pages/Purchases';
import { AdminUsers } from './pages/AdminUsers';
import { AuditLogs } from './pages/AuditLogs';
import { Quotes } from './pages/Quotes';
import { Reports } from './pages/Reports';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';

import { Settings } from './pages/Settings';
import { Preferences } from './pages/Preferences';
import { Config } from './pages/Config';
import { Login } from './pages/Login';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';

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
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<Products />} />
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
            <Route path="admin-users" element={<AdminUsers />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="config" element={<Config />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

