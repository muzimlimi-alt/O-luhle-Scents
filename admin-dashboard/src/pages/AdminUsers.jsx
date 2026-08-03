import React, { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { Modal } from '../components/Modal';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import {
  UserPlus, Shield, ShieldCheck, Edit2, Trash2, Key, Search, Filter, RefreshCw
} from 'lucide-react';

export function AdminUsers() {
  const { showMessage } = useMessaging();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
        status: statusFilter
      };
      const response = await adminOpsApi.adminUsers.list(params);
      
      if (Array.isArray(response)) {
        setUsers(response);
        setTotal(response.length);
      } else {
        setUsers(response.users || []);
        setTotal(response.total || 0);
      }
    } catch (err) {
      showMessage('error', 'Load Failed', 'Failed to load administrative users. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.create(formData);
      showMessage('success', 'Administrator Created', `${formData.name} can now sign in.`);
      setIsCreateOpen(false);
      setFormData({ name: '', email: '', role: 'staff', password: '' });
      fetchUsers();
    } catch (err) {
      showMessage('error', 'Create Failed', err.message);
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
      showMessage('success', 'Administrator Updated', 'Changes have been saved.');
      setIsEditOpen(false);
      fetchUsers();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage('warning', 'Passwords Don’t Match', 'Re-enter the new password in both fields.');
      return;
    }
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.updatePassword(selectedUser.id, newPassword);
      showMessage('success', 'Password Updated', 'The administrator can sign in with the new password.');
      setIsPasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showMessage('error', 'Update Failed', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await adminOpsApi.adminUsers.delete(selectedUser.id);
      showMessage('success', 'Administrator Removed', `${selectedUser.name}'s access has been revoked.`);
      setIsDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      showMessage('error', 'Delete Failed', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="elite-governance-container animate-fade-in">
      <PageHeader
        icon={<UserPlus size={22} />}
        title="Admin Users"
        subtitle="Control administrative access and permissions."
        actions={(
          <button className="btn btn--primary" onClick={() => setIsCreateOpen(true)}>
            <UserPlus size={18} /> Create Account
          </button>
        )}
      />

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input 
            type="text" 
            className="search-glass-input" 
            placeholder="Discovery via name or email..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        <div className="filter-glass-matrix">
           <div className="select-glass-wrapper">
              <Filter size={14} className="glass-icon" />
              <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
                <option value="">Roles: All Tiers</option>
                <option value="admin">Super Admin</option>
                <option value="shop_manager">Shop Manager</option>
                <option value="staff">Operational Staff</option>
                <option value="auditor">Internal Auditor</option>
              </select>
           </div>
           <div className="select-glass-wrapper">
              <Filter size={14} className="glass-icon" />
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Status: All States</option>
                <option value="true">State: Authorized</option>
                <option value="false">State: Denied</option>
              </select>
           </div>
           <button className="icon-btn" title="Refresh" onClick={() => fetchUsers()}>
             <RefreshCw size={16} className={loading ? 'spin' : ''} />
           </button>
        </div>
      </div>

      <div className="card">
        <DataTable
          loading={loading}
          columns={[
            { key: 'name', label: 'Administrator', render: (val, row) => (
              <div className="user-profile-cell">
                <div className={`avatar-box ${row.role}`}>{val.charAt(0).toUpperCase()}</div>
                <div className="profile-info">
                  <span className="profile-name">{val}</span>
                  <span className="profile-email">{row.email}</span>
                </div>
              </div>
            )},
            { key: 'role', label: 'Role', render: (val) => (
              <StatusBadge tone={val === 'admin' ? 'info' : 'neutral'} icon={val === 'admin' ? <ShieldCheck size={12} /> : <Shield size={12} />} label={val.replace('_', ' ').toUpperCase()} />
            )},
            { key: 'isActive', label: 'Access', render: (val) => (
              <StatusBadge tone={val ? 'success' : 'error'} label={val ? 'Authorized' : 'Denied'} />
            )},
            { key: 'lastLogin', label: 'Last Login', render: (val) => val ? new Date(val).toLocaleDateString() : 'Never' },
          ]}
          data={users}
          page={page}
          totalPages={Math.ceil(total / limit) || 1}
          onPageChange={setPage}
          emptyState={<EmptyState icon={<UserPlus size={40} />} title="No admin users found" description="Adjust your search or filters." />}
          actions={(row) => (
            <div className="action-matrix">
               <button className="icon-btn" title="Edit" onClick={() => { setSelectedUser(row); setIsEditOpen(true); }}><Edit2 size={14} /></button>
               <button className="icon-btn" title="Reset password" onClick={() => { setSelectedUser(row); setIsPasswordOpen(true); }}><Key size={14} /></button>
               <button className="icon-btn danger" title="Delete" onClick={() => { setSelectedUser(row); setIsDeleteOpen(true); }}><Trash2 size={14} /></button>
            </div>
          )}
        />
      </div>

      {/* --- MODALS --- */}
      <Drawer isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Admin User" width={480}>
        <form className="elite-form" onSubmit={handleCreate}>
          <FormField label="Full Name" required>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </FormField>
          <FormField label="Email" required>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
          </FormField>
          <FormField label="Role" required>
            <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
              <option value="staff">Staff</option>
              <option value="shop_manager">Shop Manager</option>
              <option value="admin">Super Admin</option>
              <option value="auditor">Internal Auditor</option>
            </select>
          </FormField>
          <FormField label="Password" required>
            <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
          </FormField>
          <div className="modal-actions-elite">
            <button type="submit" className="btn btn--primary" disabled={actionLoading}>{actionLoading ? 'Creating...' : 'Create Account'}</button>
            <button type="button" className="btn btn--outline" onClick={() => setIsCreateOpen(false)}>Cancel</button>
          </div>
        </form>
      </Drawer>

      {/* Edit Drawer (Account Settings) */}
      <Drawer isOpen={isEditOpen && !!selectedUser} onClose={() => setIsEditOpen(false)} title="Account Settings" width={480}>
        {selectedUser && (
          <form className="elite-form" onSubmit={handleUpdate}>
             <FormField label="Name">
               <input type="text" value={selectedUser.name} onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})} />
             </FormField>
             <FormField label="Role">
               <select value={selectedUser.role} onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="shop_manager">Shop Manager</option>
                  <option value="admin">Super Admin</option>
                  <option value="auditor">Internal Auditor</option>
               </select>
             </FormField>
             <FormField label="Access">
               <select value={selectedUser.isActive ? 'true' : 'false'} onChange={(e) => setSelectedUser({...selectedUser, isActive: e.target.value === 'true'})}>
                  <option value="true">Grant Access</option>
                  <option value="false">Revoke Access</option>
               </select>
             </FormField>
             <div className="modal-actions-elite">
               <button type="submit" className="btn btn--primary" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save Changes'}</button>
             </div>
          </form>
        )}
      </Drawer>

      {/* Password Reset Drawer */}
      <Drawer isOpen={isPasswordOpen && !!selectedUser} onClose={() => setIsPasswordOpen(false)} title="Reset Password" width={480}>
        {selectedUser && (
          <form className="elite-form" onSubmit={handlePasswordReset}>
             <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
               Update credentials for <strong>{selectedUser.name}</strong>
             </p>
             <FormField label="New Password" required>
               <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
             </FormField>
             <FormField label="Confirm Password" required>
               <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
             </FormField>
             <div className="modal-actions-elite">
               <button type="submit" className="btn btn--primary" disabled={actionLoading}>
                 {actionLoading ? 'Updating...' : 'Update Password'}
               </button>
             </div>
          </form>
        )}
      </Drawer>

      {/* Delete Confirmation Modal — stays centered: a destructive confirm needs to feel like a stop */}
      <Modal isOpen={isDeleteOpen && !!selectedUser} onClose={() => setIsDeleteOpen(false)} title="Revoke Access" maxWidth={440}>
        {selectedUser && (
          <div className="elite-form">
             <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '32px', lineHeight: '1.6' }}>
               You are about to remove <strong>{selectedUser.name}</strong>. This action will permanently revoke all system access and cannot be undone.
             </p>
             <div className="modal-actions-elite">
               <button
                 className="btn btn--danger"
                 onClick={handleDelete}
                 disabled={actionLoading}
               >
                 {actionLoading ? 'Removing...' : 'Confirm Removal'}
               </button>
               <button className="btn btn--outline" onClick={() => setIsDeleteOpen(false)}>Cancel</button>
             </div>
          </div>
        )}
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-governance-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 24px; }
        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 10px 16px; display: flex; align-items: center; flex: 1; max-width: 400px; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }
        .filter-glass-matrix { display: flex; gap: 12px; }
        .select-glass-wrapper { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px 16px; display: flex; align-items: center; gap: 10px; }
        .select-glass-wrapper select { background: none; border: none; color: var(--color-text); outline: none; cursor: pointer; font-size: 0.85rem; }

        .user-profile-cell { display: flex; align-items: center; gap: 16px; }
        .avatar-box { width: 44px; height: 44px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; color: #000; }
        .avatar-box.admin { background: linear-gradient(135deg, var(--color-primary), #d4af37); }
        .avatar-box.staff { background: #555; color: white; }

        .profile-info { display: flex; flex-direction: column; }
        .profile-name { font-weight: 700; color: var(--color-text-header); font-size: 0.95rem; }
        .profile-email { font-size: 0.75rem; color: var(--color-text-muted); }

        .action-matrix { display: flex; gap: 12px; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        .elite-form { display: flex; flex-direction: column; gap: 20px; }
        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }

        @media (max-width: 900px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .search-glass-wrapper { max-width: none; }
          .filter-glass-matrix { flex-wrap: wrap; }
          .select-glass-wrapper { flex: 1 1 160px; }
        }
        @media (max-width: 640px) {
          .elite-governance-container { padding: 20px; }
        }
      `}} />
    </div>
  );
}
