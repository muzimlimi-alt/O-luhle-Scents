import { useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { adminOpsApi } from '../services/api';
import { Modal } from '../components/Modal';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { useMessaging } from '../context/MessagingContext';
import {
  UserPlus, Shield, ShieldCheck, Edit2, Trash2, Key, Search, Filter, RefreshCw, LogOut
} from 'lucide-react';

// What each role can actually do, derived from the real route gates in
// server/src/middleware/auth.js (requireAdmin's auditor GET-only check) and
// the requireRole('admin') calls guarding payments/finance/banking/admin-user
// management/etc — not a fabricated permission-scope system. shop_manager and
// staff aren't differentiated anywhere in the route gates beyond that, so
// both read "Standard access" rather than inventing a distinction that
// doesn't exist in the code.
const ROLE_ACCESS = {
  admin: { label: 'Full access', tone: 'gold' },
  auditor: { label: 'Read-only', tone: 'mute' },
  shop_manager: { label: 'Standard access', tone: 'info' },
  staff: { label: 'Standard access', tone: 'info' },
};

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

  // Compromised-credential response: ends every session currently signed in
  // as this admin without deactivating the account itself. Doesn't need a
  // confirmation modal — unlike delete, it's non-destructive (they can just
  // log back in), so the same lightweight pattern as password reset fits.
  const handleRevokeSessions = async (row) => {
    try {
      const { sessionsRevoked } = await adminOpsApi.adminUsers.revokeSessions(row.id);
      showMessage('success', 'Sessions Ended', sessionsRevoked > 0
        ? `${row.name} has been signed out of ${sessionsRevoked} active session(s).`
        : `${row.name} had no active sessions.`);
    } catch (err) {
      showMessage('error', 'Failed to End Sessions', err.message);
    }
  };

  return (
    <div className="elite-governance-container animate-fade-in">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Workspace</li><li aria-current="page">Admin Users</li></ol>
          <h1>Admin Users</h1>
          <p className="sub">{total} administrator{total === 1 ? '' : 's'}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
            <UserPlus size={14} /> Create Account
          </button>
        </div>
      </div>

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
            { key: 'access', label: 'Access', render: (_val, row) => {
              const access = ROLE_ACCESS[row.role] || { label: 'Standard access', tone: 'mute' };
              return <span className={`pill ${access.tone}`}>{access.label}</span>;
            }},
            { key: 'isActive', label: 'Status', render: (val) => (
              <StatusBadge tone={val ? 'success' : 'error'} label={val ? 'Authorized' : 'Denied'} />
            )},
            { key: 'lastLogin', label: 'Last Active', render: (val) => val ? DateTime.fromISO(val).toRelative() : 'Never' },
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
               <button className="icon-btn" title="Sign out everywhere" onClick={() => handleRevokeSessions(row)}><LogOut size={14} /></button>
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
             <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
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
             <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '32px', lineHeight: '1.6' }}>
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

        .page-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--sp-5); flex-wrap: wrap;
          padding-bottom: var(--sp-5); margin-bottom: var(--sp-6);
          border-bottom: 1px solid var(--border-low);
        }
        .page-head h1 { font-size: 2rem; }
        .page-head .sub { color: var(--text-muted); font-size: .9rem; margin-top: var(--sp-2); }
        .crumbs { display: flex; align-items: center; gap: var(--sp-2); font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 var(--sp-3); padding: 0; }
        .crumbs li { list-style: none; display: flex; align-items: center; gap: var(--sp-2); }
        .crumbs li + li::before { content: "/"; color: var(--border-strong); }
        .crumbs [aria-current] { color: var(--y-base); }
        .head-actions { display: flex; align-items: center; gap: var(--sp-3); }

        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
          min-height: var(--tap); padding: 0 var(--sp-5);
          border-radius: var(--r); font-size: .86rem; font-weight: 500;
          letter-spacing: .06em; text-transform: uppercase;
          border: 1px solid transparent; cursor: pointer;
          background: var(--y-base); color: var(--text-inverse);
          transition: all var(--t-fast) var(--ease); white-space: nowrap;
        }
        .btn-primary:hover { background: var(--y-hover); box-shadow: 0 6px 22px rgba(var(--y-rgb), .3); }
        .btn-sm { min-height: 36px; padding: 0 var(--sp-4); font-size: .74rem; }
        .btn-primary:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.gold { color: var(--y-base); border-color: rgba(var(--y-rgb), .45); background: rgba(var(--y-rgb), .12); }
        .pill.info { color: var(--info); border-color: rgba(var(--info-rgb), .4); background: rgba(var(--info-rgb), .09); }
        .pill.mute { color: var(--text-muted); border-color: var(--border-default); }
        .pill.bad { color: var(--error); border-color: rgba(var(--bad-rgb), .4); background: rgba(var(--bad-rgb), .09); }

        .card .modern-table th { font-size: .66rem; letter-spacing: .14em; }
        .card .modern-table td, .card .modern-table th { padding: 12px var(--sp-4); }

        .atelier-discovery { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 24px; }
        .search-glass-wrapper { position: relative; background: var(--bg-surface); border: 1.5px solid var(--border-default); border-radius: var(--r); padding: 10px 16px; display: flex; align-items: center; flex: 1; max-width: 400px; }
        .search-glass-input { background: none; border: none; color: var(--text-primary); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }
        .filter-glass-matrix { display: flex; gap: 12px; }
        .select-glass-wrapper { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r); padding: 8px 16px; display: flex; align-items: center; gap: 10px; }
        .select-glass-wrapper select { background: none; border: none; color: var(--text-primary); outline: none; cursor: pointer; font-size: 0.85rem; }

        .user-profile-cell { display: flex; align-items: center; gap: 16px; }
        .avatar-box { width: 44px; height: 44px; border-radius: var(--r); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; color: var(--text-inverse); }
        .avatar-box.admin { background: linear-gradient(135deg, var(--y-base), var(--y-dark)); }
        .avatar-box.staff { background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border-default); }

        .profile-info { display: flex; flex-direction: column; }
        .profile-name { font-weight: 700; color: var(--text-primary); font-size: 0.95rem; }
        .profile-email { font-size: 0.75rem; color: var(--text-muted); }

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
