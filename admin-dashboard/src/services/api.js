import axios from 'axios';

// Development vs Production Environment Detection
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth Interceptor for Bearer Tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('toca_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// A request made with `responseType: 'blob'` (every CSV/Excel export) still
// gets its error body delivered as a Blob even on a JSON error response —
// `data?.message`/`data?.error` below would silently be undefined and every
// export failure showed a useless generic "Request failed with status code
// 400" instead of the real reason. Unwrap it back to the JSON it actually is.
async function resolveErrorData(error) {
  const data = error.response?.data;
  if (!(data instanceof Blob)) return data;
  try {
    return JSON.parse(await data.text());
  } catch {
    return data;
  }
}

// Error Interceptor for Global Feedback
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const status = error.response?.status;
    const data = await resolveErrorData(error);
    const message = data?.message || data?.error || error.message || 'API Communication Error';

    if (status === 401) {
      localStorage.removeItem('toca_admin_token');
      // Only notify if not already on login page
      if (!window.location.pathname.includes('/login')) {
        dispatchAdminMessage('error', 'Session Expired', 'Please log in again to continue.');
        window.location.href = '/login';
      }
    } else if (status === 403) {
      dispatchAdminMessage('error', 'Access Denied', 'You do not have permission for this artisanal operation.');
    } else if (status >= 500) {
      dispatchAdminMessage('error', 'Server Interruption', 'The server is currently resting. We are working to restore service.');
    } else if (!status && error.message === 'Network Error') {
      dispatchAdminMessage('error', 'Network Failure', 'Unable to reach the server. Please check your connection.');
    }

    return Promise.reject(new Error(message));
  }
);

function dispatchAdminMessage(type, title, message) {
  window.dispatchEvent(new CustomEvent('admin_message', {
    detail: { type, title, message }
  }));
}

// Shared by every report's CSV/Excel export button (Export Centre) — one
// GET with ?format=csv|xlsx appended, same params the on-screen report
// already uses, triggered as a browser download rather than rendered.
export async function downloadReport(path, params, format, filename) {
  const response = await api.get(path, { params: { ...params, format }, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/* ─── Endpoints ───────────────────────────────────────────────────────────── */

export const productsApi = {
  list: (params) => api.get('/products', { params }),
  create: (data) => api.post('/products', data, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  }),
  update: (id, data) => api.patch(`/products/${id}`, data, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  }),
  delete: (id) => api.delete(`/products/${id}`),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.patch(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const ordersApi = {
  list: (params) => api.get('/orders', { params }),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  getDetail: (id) => api.get(`/orders/${id}`),
  fulfill: (id, data) => api.patch(`/orders/${id}/fulfill`, data),
  updateNotes: (id, internalNotes) => api.patch(`/orders/${id}/notes`, { internalNotes }),
  addTrackingEvent: (id, data) => api.post(`/orders/${id}/tracking-events`, data),
};


export const paymentsApi = {
  list: (eftStatus) => api.get('/admin/payments', { params: eftStatus ? { eftStatus } : {} }),
  verify: (id) => api.post(`/admin/payments/${id}/verify`),
  reject: (id, reason) => api.post(`/admin/payments/${id}/reject`, { reason }),
  proofUrl: (id) => `${API_BASE_URL}/admin/payments/${id}/proof`,
};

export const quotesApi = {
  list: () => api.get('/quotes/admin'),
  updateStatus: (id, status) => api.patch(`/quotes/admin/${id}/status`, { status }),
  convert: (id, data) => api.post(`/quotes/admin/${id}/convert`, data),
};

export const settingsApi = {
  list: () => api.get('/admin/settings'),
  update: (settings) => api.post('/admin/settings', { settings }),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/admin/settings/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};


export const metricsApi = {
  dashboard: () => api.get('/admin/metrics/dashboard'),
  predictions: () => api.get('/admin/metrics/predictions'),
  abandoned: () => api.get('/admin/metrics/abandoned'),
  sendRecovery: (orderId) => api.post(`/admin/ops/email/abandoned/${orderId}`),
  analytics: (period) => api.get('/admin/analytics', { params: { period } }),
};


export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const adminOpsApi = {
  coupons: {
    list: () => api.get('/admin/ops/coupons'),
    create: (data) => api.post('/admin/ops/coupons', data),
    delete: (id) => api.delete(`/admin/ops/coupons/${id}`),
  },
  suppliers: {
    list: () => api.get('/admin/ops/suppliers'),
    create: (data) => api.post('/admin/ops/suppliers', data),
  },

  purchases: {
    list: () => api.get('/admin/ops/purchases'),
    create: (data) => api.post('/admin/ops/purchases', data),
    receive: (id) => api.patch(`/admin/ops/purchases/${id}/receive`),
    pay: (id, data) => api.post(`/admin/ops/purchases/${id}/pay`, data),
  },
  payments: {
    list: () => api.get('/admin/ops/payments'),
  },
  inventory: {
    list: () => api.get('/admin/ops/inventory'),
    logs: (variantId) => api.get('/admin/ops/inventory/logs', { params: variantId ? { variantId } : {} }),
    updateThreshold: (variantId, lowStockThreshold) => api.patch(`/admin/ops/inventory/${variantId}/threshold`, { lowStockThreshold }),
    adjust: (variantId, data) => api.post(`/admin/ops/inventory/${variantId}/adjust`, data),
  },
  attributeDefinitions: {
    list: (family) => api.get('/admin/ops/attribute-definitions', { params: family ? { family } : {} }),
    create: (data) => api.post('/admin/ops/attribute-definitions', data),
    update: (id, data) => api.patch(`/admin/ops/attribute-definitions/${id}`, data),
    delete: (id) => api.delete(`/admin/ops/attribute-definitions/${id}`),
  },
  productSuppliers: {
    list: (productId) => api.get(`/admin/ops/products/${productId}/suppliers`),
    create: (productId, data) => api.post(`/admin/ops/products/${productId}/suppliers`, data),
    delete: (id) => api.delete(`/admin/ops/product-suppliers/${id}`),
  },
  media: {
    updateAltText: (mediaId, altText) => api.patch(`/admin/ops/media/${mediaId}`, { altText }),
  },
  notifications: {
    list: () => api.get('/admin/ops/notifications'),
    markRead: (id) => api.patch(`/admin/ops/notifications/${id}/read`),
    delete: (id) => api.delete(`/admin/ops/notifications/${id}`),
  },
  invoices: {
    list: () => api.get('/admin/ops/invoices'),
    bulkDownload: (ids) => api.post('/admin/ops/invoices/bulk-pdf', { ids }, { responseType: 'blob' }),
  },
  auditLogs: {
    list: () => api.get('/admin/ops/audit-logs'),
  },
  adminUsers: {
    list: (params) => api.get('/admin/ops/admin-users', { params }),
    create: (data) => api.post('/admin/ops/admin-users', data),
    update: (id, data) => api.patch(`/admin/ops/admin-users/${id}`, data),
    updatePassword: (id, password) => api.patch(`/admin/ops/admin-users/${id}/password`, { password }),
    delete: (id) => api.delete(`/admin/ops/admin-users/${id}`),
    revokeSessions: (id) => api.post(`/admin/ops/admin-users/${id}/revoke-sessions`),
  },
  customers: {
    list: () => api.get('/admin/ops/customers'),
  },
  reports: {
    generate: (month = 1) => api.get('/admin/ops/reports/generate', { params: { month }, responseType: 'blob' }),
    inventorySummary: () => api.get('/admin/ops/reports/inventory-summary'),
    financeSummary: (period = '30d') => api.get('/admin/ops/reports/finance-summary', { params: { period } }),
  },
  returns: {
    list: () => api.get('/admin/ops/returns'),
    create: (data) => api.post('/admin/ops/returns', data),
  },
  orders: {
    create: (data) => api.post('/admin/ops/orders', data),
    getDetail: (id) => api.get(`/admin/ops/orders/${id}`),
    recordPayment: (id, data) => api.post(`/admin/ops/orders/${id}/payments`, data),
    issueRefund: (id, data) => api.post(`/admin/ops/orders/${id}/refunds`, data),
  },
  exchanges: {
    list: () => api.get('/admin/ops/exchanges'),
    create: (data) => api.post('/admin/ops/exchanges', data),
  },
  couponValidate: (code, subtotal) => api.post('/admin/ops/coupons/validate', { code, subtotal }),
  shippingMethods: {
    list: () => api.get('/admin/ops/shipping-methods'),
    create: (data) => api.post('/admin/ops/shipping-methods', data),
    update: (id, data) => api.patch(`/admin/ops/shipping-methods/${id}`, data),
    delete: (id) => api.delete(`/admin/ops/shipping-methods/${id}`),
  },
  taxRates: {
    list: () => api.get('/admin/ops/tax-rates'),
    create: (data) => api.post('/admin/ops/tax-rates', data),
    update: (id, data) => api.patch(`/admin/ops/tax-rates/${id}`, data),
    delete: (id) => api.delete(`/admin/ops/tax-rates/${id}`),
  },
};

export const financeApi = {
  chartOfAccounts: () => api.get('/admin/finance/chart-of-accounts'),
  trialBalance: (asOf) => api.get('/admin/finance/trial-balance', { params: asOf ? { asOf } : {} }),
  ledger: (code, params) => api.get(`/admin/finance/ledger/${code}`, { params }),
  journals: (params) => api.get('/admin/finance/journals', { params }),
  incomeStatement: (params) => api.get('/admin/finance/income-statement', { params }),
  balanceSheet: (asOf) => api.get('/admin/finance/balance-sheet', { params: asOf ? { asOf } : {} }),
  cashFlow: (params) => api.get('/admin/finance/cash-flow', { params }),
  agedReceivables: (asOf) => api.get('/admin/finance/aged-receivables', { params: asOf ? { asOf } : {} }),
  agedPayables: (asOf) => api.get('/admin/finance/aged-payables', { params: asOf ? { asOf } : {} }),
  fiscalPeriods: () => api.get('/admin/finance/fiscal-periods'),
  closePeriod: (id) => api.post(`/admin/finance/fiscal-periods/${id}/close`),
  requestPeriodReopen: (id) => api.post(`/admin/finance/fiscal-periods/${id}/reopen-request`),
};

export const approvalsApi = {
  list: () => api.get('/admin/approvals'),
  approve: (id) => api.post(`/admin/approvals/${id}/approve`),
  reject: (id, reason) => api.post(`/admin/approvals/${id}/reject`, { reason }),
};

export const expensesApi = {
  list: () => api.get('/admin/expenses'),
  create: (data) => api.post('/admin/expenses', data),
};

export const sarsApi = {
  vatOutputRegister: (params) => api.get('/admin/sars/vat/output-register', { params }),
  vatInputRegister: (params) => api.get('/admin/sars/vat/input-register', { params }),
  vatSummary: (params) => api.get('/admin/sars/vat/summary', { params }),
  complianceSummary: () => api.get('/admin/sars/compliance-summary'),
  deadlines: {
    list: () => api.get('/admin/sars/deadlines'),
    add: (label, dueDate) => api.post('/admin/sars/deadlines', { label, dueDate }),
    remove: (id) => api.delete(`/admin/sars/deadlines/${id}`),
  },
};

export const bankingApi = {
  accounts: {
    list: () => api.get('/admin/banking/accounts'),
    create: (data) => api.post('/admin/banking/accounts', data),
    update: (id, data) => api.patch(`/admin/banking/accounts/${id}`, data),
    setDefault: (id) => api.post(`/admin/banking/accounts/${id}/set-default`),
  },
  transactions: {
    create: (accountId, data) => api.post(`/admin/banking/accounts/${accountId}/transactions`, data),
    import: (accountId, formData) => api.post(`/admin/banking/accounts/${accountId}/transactions/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    match: (id, journalLineId) => api.post(`/admin/banking/transactions/${id}/match`, { journalLineId }),
    unmatch: (id) => api.post(`/admin/banking/transactions/${id}/unmatch`),
    adjust: (id, data) => api.post(`/admin/banking/transactions/${id}/adjust`, data),
  },
  reconciliation: (accountId, params) => api.get(`/admin/banking/accounts/${accountId}/reconciliation`, { params }),
};

export const newsletterApi = {
  subscribers: {
    list: (params) => api.get('/newsletter/subscribers', { params }),
    create: (data) => api.post('/newsletter/subscribers', data),
    updateStatus: (id, status) => api.patch(`/newsletter/subscribers/${id}`, { status }),
    delete: (id) => api.delete(`/newsletter/subscribers/${id}`),
    bulkAction: (data) => api.post('/newsletter/subscribers/bulk', data),
  },
  campaigns: {
    list: (params) => api.get('/newsletter/campaigns', { params }),
    create: (data) => api.post('/newsletter/campaigns', data),
    update: (id, data) => api.patch(`/newsletter/campaigns/${id}`, data),
    delete: (id) => api.delete(`/newsletter/campaigns/${id}`),
    send: (id) => api.post(`/newsletter/campaigns/${id}/send`),
    uploadAttachment: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/newsletter/campaigns/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    uploadImage: (file) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.post('/newsletter/campaigns/image-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
  }
};

export const adminPrivacyApi = {
  summary: () => api.get('/admin/privacy/summary'),
  requests: {
    list: (params) => api.get('/admin/privacy/requests', { params }),
    resolve: (id, data) => api.patch(`/admin/privacy/requests/${id}`, data),
  },
  consentStats: () => api.get('/admin/privacy/consent-stats'),
  retentionPolicies: {
    list: () => api.get('/admin/privacy/retention-policies'),
    update: (category, data) => api.patch(`/admin/privacy/retention-policies/${category}`, data),
  },
};

export const testimonialsApi = {
  list: (status) => api.get('/testimonials/admin', { params: status ? { status } : {} }),
  create: (formData) => api.post('/testimonials/admin', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/testimonials/admin/${id}`, data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  remove: (id) => api.delete(`/testimonials/admin/${id}`),
};

export default api;
