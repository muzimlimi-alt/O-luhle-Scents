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
  const token = localStorage.getItem('oluhle_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Error Interceptor for Global Feedback
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('oluhle_admin_token');
      window.location.href = '/login';
    }
    const message = error.response?.data?.message || error.message || 'API Communication Error';
    return Promise.reject(new Error(message));
  }
);

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
};

export const ordersApi = {
  list: (params) => api.get('/orders', { params }),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  getDetail: (id) => api.get(`/orders/${id}`),
  fulfill: (id, data) => api.patch(`/orders/${id}/fulfill`, data),
};


export const quotesApi = {
  list: () => api.get('/quotes/admin'),
  updateStatus: (id, status) => api.patch(`/quotes/admin/${id}/status`, { status }),
  convert: (id) => api.post(`/quotes/admin/${id}/convert`),
};

export const settingsApi = {
  list: () => api.get('/admin/settings'),
  update: (settings) => api.post('/admin/settings', { settings }),
};


export const metricsApi = {
  dashboard: () => api.get('/admin/metrics/dashboard'),
  predictions: () => api.get('/admin/metrics/predictions'),
  abandoned: () => api.get('/admin/metrics/abandoned'),
  sendRecovery: (orderId) => api.post(`/admin/ops/email/abandoned/${orderId}`),
};


export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
};

export const adminOpsApi = {
  coupons: {
    list: () => api.get('/admin/ops/coupons'),
    create: (data) => api.post('/admin/ops/coupons', data),
  },
  suppliers: {
    list: () => api.get('/admin/ops/suppliers'),
    create: (data) => api.post('/admin/ops/suppliers', data),
    sendRestockAlert: (variantId) => api.post(`/admin/ops/suppliers/restock-alert/${variantId}`),
  },

  purchases: {
    list: () => api.get('/admin/ops/purchases'),
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
  },
  customers: {
    list: () => api.get('/admin/ops/customers'),
  },
  email: {
    sendBulk: (subject, body) => api.post('/admin/ops/email/bulk', { subject, body }),
  },
  reports: {
    generate: (month = 1) => api.get('/admin/ops/reports/generate', { params: { month }, responseType: 'blob' }),
  }
};

export default api;
