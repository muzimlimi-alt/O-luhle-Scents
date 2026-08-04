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
    const status = error.response?.status;
    const data = error.response?.data;
    const message = data?.message || data?.error || error.message || 'API Communication Error';

    if (status === 401) {
      localStorage.removeItem('oluhle_admin_token');
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
};


export const quotesApi = {
  list: () => api.get('/quotes/admin'),
  updateStatus: (id, status) => api.patch(`/quotes/admin/${id}/status`, { status }),
  convert: (id) => api.post(`/quotes/admin/${id}/convert`),
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
    create: (data) => api.post('/admin/ops/purchases', data),
    receive: (id) => api.patch(`/admin/ops/purchases/${id}/receive`),
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
  },
  customers: {
    list: () => api.get('/admin/ops/customers'),
  },
  email: {
    sendBulk: (subject, body) => api.post('/admin/ops/email/bulk', { subject, body }),
  },
  reports: {
    generate: (month = 1) => api.get('/admin/ops/reports/generate', { params: { month }, responseType: 'blob' }),
    inventorySummary: () => api.get('/admin/ops/reports/inventory-summary'),
    financeSummary: (period = '30d') => api.get('/admin/ops/reports/finance-summary', { params: { period } }),
  },
  returns: {
    list: () => api.get('/admin/ops/returns'),
    create: (data) => api.post('/admin/ops/returns', data),
  }
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

export default api;
