import React, { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { 
  UserPlus, Shield, ShieldCheck, Edit2, Trash2, Key, Search, Filter, 
  MoreVertical, X, Check, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Modal } from '../components/Modal';

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy] = useState('name');
  const [sortOrder] = useState('asc');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', email: '', role: 'staff', password: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search,
        role: roleFilter,
        status: statusFilter,
        sortBy,
        sortOrder
      };
      const response = await adminOpsApi.adminUsers.list(params);
      
      // Handle both legacy array and new paginated object responses
      if (Array.isArray(response)) {
        setUsers(response);
        setTotal(response.length);
      } else {
        setUsers(response.users || []);
        setTotal(response.total || 0);
      }
      setError(null);
    } catch (err) {
      setError('Failed to load administrative users. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.create(formData);
      setSuccess('Administrator created successfully.');
      setIsCreateOpen(false);
      setFormData({ name: '', email: '', role: 'staff', password: '' });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.update(selectedUser.id, {
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role,
        isActive: selectedUser.isActive
      });
      setSuccess('Administrator updated successfully.');
      setIsEditOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.updatePassword(selectedUser.id, newPassword);
      setSuccess('Password updated successfully.');
      setIsPasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.delete(selectedUser.id);
      setSuccess('Administrator deleted successfully.');
      setIsDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    { 
      key: 'name', 
      label: 'Administrator', 
      render: (val, row) => (
        <div className="user-cell">
          <div className={`user-avatar ${row.role}`}>
             {val.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{val}</span>
            <span className="user-email">{row.email}</span>
          </div>
        </div>
      )
    },
    { 
      key: 'role', 
      label: 'Role', 
      render: (val) => (
        <span className={`role-badge ${val}`}>
          {val === 'admin' ? <ShieldCheck size={12} /> : <Shield size={12} />}
          {val.replace('_', ' ').toUpperCase()}
        </span>
      )
    },
    { 
      key: 'isActive', 
      label: 'Status', 
      render: (val) => (
        <span className={`status-pill ${val ? 'active' : 'inactive'}`}>
          <span className="dot"></span>
          {val ? 'Active' : 'Locked'}
        </span>
      )
    },
    { 
      key: 'lastLogin', 
      label: 'Last Login', 
      render: (val) => val ? new Date(val).toLocaleString() : 'Never' 
    },
    { 
      key: 'createdAt', 
      label: 'Joined', 
      render: (val) => new Date(val).toLocaleDateString() 
    }
  ];

  return (
    <div className="admin-users-page animate-fade-in">
      {/* feedback bar */}
      {(error || success) && (
        <div className={`feedback-banner ${error ? 'error' : 'success'}`}>
          {error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{error || success}</span>
          <button className="close-btn" onClick={() => { setError(null); setSuccess(null); }}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="content-header">
        <div>
          <h1 className="page-heading">Admin User Management</h1>
          <p className="page-subheading">Control administrative access and secure system permissions.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setIsCreateOpen(true)}>
          <UserPlus size={18} /> Create Account
        </button>
      </div>

      {/* Control Bar */}
      <div className="control-bar card">
        <div className="search-group">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search name or email..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="filters">
          <div className="filter-select">
            <Filter size={14} className="filter-icon" />
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="shop_manager">Shop Manager</option>
              <option value="staff">Staff</option>
              <option value="auditor">Auditor</option>
            </select>
          </div>
          <div className="filter-select">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Locked</option>
            </select>
          </div>
          <button className="btn btn--icon-outline" onClick={() => fetchUsers()} title="Refresh Data">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="card table-container">
        <DataTable 
          columns={columns} 
          data={users} 
          loading={loading}
          actions={(row) => (
            <div className="action-row">
               <button className="action-button edit" onClick={() => { setSelectedUser(row); setIsEditOpen(true); }} title="Edit User">
                 <Edit2 size={16} />
               </button>
               <button className="action-button secure" onClick={() => { setSelectedUser(row); setIsPasswordOpen(true); }} title="Update Password">
                 <Key size={16} />
               </button>
               <button className="action-button delete" onClick={() => { setSelectedUser(row); setIsDeleteOpen(true); }} title="Delete Admin">
                 <Trash2 size={16} />
               </button>
            </div>
          )}
        />
        
        {/* Pagination logic injected into bottom container if needed, 
            but DataTable handles basic styling. We'll add our custom pagination logic here if necessary. */}
        <div className="table-pagination">
          <div className="pagination-info">
             Showing {users.length} of {total} administrators
          </div>
          <div className="pagination-controls">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="pagination-btn"
            >Previous</button>
            <span className="page-number">Page {page} of {Math.ceil(total / limit) || 1}</span>
            <button 
              disabled={page >= Math.ceil(total / limit)} 
              onClick={() => setPage(p => p + 1)}
              className="pagination-btn"
            >Next</button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Administrative Account">
        <form className="modern-form" onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-field">
              <label>Full Name</label>
              <input 
                type="text" 
                placeholder="Name" 
                required 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label>Work Email</label>
              <input 
                type="email" 
                placeholder="email@oluhle.com" 
                required 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div className="form-field">
              <label>System Role</label>
              <select 
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="staff">Staff</option>
                <option value="shop_manager">Shop Manager</option>
                <option value="admin">Super Admin</option>
                <option value="auditor">Internal Auditor</option>
              </select>
            </div>
            <div className="form-field">
              <label>Initial Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn--primary" disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Initialize Account'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setIsCreateOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Account Settings">
        {selectedUser && (
          <form className="modern-form" onSubmit={handleUpdate}>
            <div className="form-grid">
              <div className="form-field">
                <label>Full Name</label>
                <input 
                  type="text" 
                  value={selectedUser.name}
                  onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})}
                />
              </div>
              <div className="form-field">
                <label>Email Address</label>
                <input 
                  type="email" 
                  value={selectedUser.email}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                />
              </div>
              <div className="form-field">
                <label>Role</label>
                <select 
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}
                >
                  <option value="staff">Staff</option>
                  <option value="shop_manager">Shop Manager</option>
                  <option value="admin">Super Admin</option>
                  <option value="auditor">Internal Auditor</option>
                </select>
              </div>
              <div className="form-field">
                <label>Account Status</label>
                <select 
                   value={selectedUser.isActive ? 'true' : 'false'}
                   onChange={(e) => setSelectedUser({...selectedUser, isActive: e.target.value === 'true'})}
                >
                  <option value="true">Active & Authorized</option>
                  <option value="false">Locked & Denied Access</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn btn--primary" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Update Settings'}
              </button>
              <button type="button" className="btn btn--outline" onClick={() => setIsEditOpen(false)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Password Reset Modal */}
      <Modal isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)} title="Security Update">
        <form className="modern-form" onSubmit={handlePasswordReset}>
          <div className="alert-box info">
            <Shield size={16} />
            <span>Updating password for <strong>{selectedUser?.name}</strong>. User will need to use this for their next login.</span>
          </div>
          <div className="form-field">
            <label>New Secured Password</label>
            <input 
              type="password" 
              placeholder="Min 8 characters" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Confirm Password</label>
            <input 
              type="password" 
              placeholder="Repeat password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn--primary btn--danger" disabled={actionLoading}>
              {actionLoading ? 'Updating Security...' : 'Apply New Password'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setIsPasswordOpen(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Deletion">
        <div className="confirmation-dialog">
          <div className="warning-icon"><Trash2 size={40} /></div>
          <h3>Permanent Account Removal</h3>
          <p>Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This action will revoke all system access and cannot be undone.</p>
          <div className="modal-actions horizontal">
            <button className="btn btn--danger" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Removing...' : 'Delete Admin Access'}
            </button>
            <button className="btn btn--outline" onClick={() => setIsDeleteOpen(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-users-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
        .page-heading { font-size: 1.8rem; font-weight: 700; color: var(--color-text); margin: 0 0 4px 0; }
        .page-subheading { color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 24px; }
        
        .feedback-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-weight: 500; position: relative; }
        .feedback-banner.success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .feedback-banner.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .close-btn { margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; }
        .close-btn:hover { opacity: 1; }

        .control-bar { display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 24px; gap: 20px; flex-wrap: wrap; }
        .search-group { display: flex; align-items: center; gap: 12px; background: var(--color-bg-dark); padding: 8px 16px; border-radius: 8px; flex-grow: 1; max-width: 400px; border: 1px solid var(--color-border); }
        .search-group input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; font-size: 0.9rem; }
        .search-icon { color: var(--color-text-muted); }
        
        .filters { display: flex; gap: 12px; align-items: center; }
        .filter-select { display: flex; align-items: center; gap: 8px; background: var(--color-bg-dark); border: 1px solid var(--color-border); padding: 6px 12px; border-radius: 8px; }
        .filter-select select { background: none; border: none; color: var(--color-text); outline: none; font-size: 0.85rem; cursor: pointer; }
        .filter-icon { color: var(--color-text-muted); }

        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; color: #fff; }
        .user-avatar.admin { background: linear-gradient(135deg, #d4af37, #b8860b); }
        .user-avatar.shop_manager { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        .user-avatar.staff { background: linear-gradient(135deg, #10b981, #059669); }
        .user-avatar.auditor { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .user-info { display: flex; flex-direction: column; }
        .user-name { font-weight: 600; color: var(--color-text); font-size: 0.9rem; }
        .user-email { font-size: 0.75rem; color: var(--color-text-muted); }

        .role-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .role-badge.admin { background: rgba(212, 175, 55, 0.15); color: #d4af37; }
        .role-badge.shop_manager { background: rgba(99, 102, 241, 0.15); color: #6366f1; }
        .role-badge.staff { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .role-badge.auditor { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

        .status-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .status-pill.active { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-pill.inactive { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .action-row { display: flex; gap: 6px; }
        .action-button { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-bg-card); color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
        .action-button:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .action-button.delete:hover { border-color: #ef4444; color: #ef4444; }
        .action-button.secure:hover { border-color: #f59e0b; color: #f59e0b; }

        .table-pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-top: 1px solid var(--color-border); }
        .pagination-info { font-size: 0.85rem; color: var(--color-text-muted); }
        .pagination-controls { display: flex; align-items: center; gap: 16px; }
        .pagination-btn { background: var(--color-bg-dark); border: 1px solid var(--color-border); color: var(--color-text); padding: 6px 14px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: 0.2s; }
        .pagination-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-number { font-size: 0.85rem; color: var(--color-text); font-weight: 600; }

        .modern-form { display: flex; flex-direction: column; gap: 20px; padding: 8px 0; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-field { display: flex; flex-direction: column; gap: 8px; }
        .form-field label { font-size: 0.85rem; font-weight: 600; color: var(--color-text); }
        .form-field input, .form-field select { background: var(--color-bg-dark); border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 14px; color: var(--color-text); outline: none; transition: 0.2s; }
        .form-field input:focus, .form-field select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.1); }
        
        .modal-actions { display: flex; flex-direction: row-reverse; gap: 12px; margin-top: 12px; }
        .modal-actions.horizontal { display: flex; flex-direction: row; justify-content: center; }
        
        .alert-box { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; font-size: 0.85rem; line-height: 1.4; }
        .alert-box.info { background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.2); }

        .confirmation-dialog { text-align: center; padding: 20px 0; }
        .warning-icon { color: #ef4444; margin-bottom: 16px; animation: bounce 1s infinite alternate; }
        .confirmation-dialog h3 { font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text); }
        .confirmation-dialog p { color: var(--color-text-muted); margin-bottom: 24px; }
        
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-8px); } }
        
        @media (max-width: 768px) {
          .form-grid { grid-template-columns: 1fr; }
          .control-bar { flex-direction: column; align-items: stretch; }
          .search-group { max-width: none; }
          .filters { flex-wrap: wrap; }
          .table-pagination { flex-direction: column; gap: 16px; }
        }
      `}} />
    </div>
  );
}
