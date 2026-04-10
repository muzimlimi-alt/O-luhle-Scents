import React, { useState, useEffect, useCallback } from 'react';
import { adminOpsApi } from '../services/api';
import { 
  UserPlus, Shield, ShieldCheck, Edit2, Trash2, Key, Search, Filter, 
  MoreVertical, X, Check, AlertCircle, RefreshCw, Lock, Unlock, UserCog
} from 'lucide-react';

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
      setError(null);
    } catch (err) {
      setError('Failed to load administrative users. ' + err.message);
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

  return (
    <div className="elite-governance-container animate-fade-in">
      {(error || success) && (
        <div className={`elite-banner ${error ? 'error' : 'success'}`}>
          {error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{error || success}</span>
          <button className="close-btn" onClick={() => { setError(null); setSuccess(null); }}>
             <X size={14} />
          </button>
        </div>
      )}

      <div className="atelier-header">
        <div className="header-titles">
          <h1 className="couture-text">System Governance</h1>
          <p className="couture-subtext">Control administrative access and secure system permissions</p>
        </div>
        <button className="elite-btn-plus" onClick={() => setIsCreateOpen(true)}>
          <UserPlus size={18} /> Create Account
        </button>
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
           <button className="elite-btn-outline icon-only" onClick={() => fetchUsers()}>
             <RefreshCw size={16} className={loading ? 'spin' : ''} />
           </button>
        </div>
      </div>

      <div className="card table-glass-container">
        <div className="table-responsive">
          <table className="modern-table elite-glass-table">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Role Tier</th>
                <th>Access Status</th>
                <th>Last Engagement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="empty-state">Syncing governance matrix...</td></tr>
              ) : users.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className="user-profile-cell">
                      <div className={`avatar-box ${row.role}`}>
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="profile-info">
                        <span className="profile-name">{row.name}</span>
                        <span className="profile-email">{row.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge-elite ${row.role}`}>
                      {row.role === 'admin' ? <ShieldCheck size={12} /> : <Shield size={12} />}
                      {row.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill-elite ${row.isActive ? 'active' : 'locked'}`}>
                      {row.isActive ? <Unlock size={12} /> : <Lock size={12} />}
                      {row.isActive ? 'AUTHORIZED' : 'DENIED'}
                    </span>
                  </td>
                  <td className="engagement-cell">
                    {row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td>
                    <div className="action-matrix">
                       <button className="btn-mini-action" onClick={() => { setSelectedUser(row); setIsEditOpen(true); }}><Edit2 size={14} /></button>
                       <button className="btn-mini-action secure" onClick={() => { setSelectedUser(row); setIsPasswordOpen(true); }}><Key size={14} /></button>
                       <button className="btn-mini-action delete" onClick={() => { setSelectedUser(row); setIsDeleteOpen(true); }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="elite-pagination">
          <div className="pagination-intel">
             Showing {users.length} of {total} security principals
          </div>
          <div className="pagination-controls">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="elite-page-btn">Previous</button>
            <span className="current-page">Matrix {page} of {Math.ceil(total / limit) || 1}</span>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="elite-page-btn">Next</button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {isCreateOpen && (
        <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && setIsCreateOpen(false)}>
          <div className="elite-modal glass-panel">
            <div className="modal-top">
              <h2 className="couture-text">New Principal</h2>
              <button className="close-btn" onClick={() => setIsCreateOpen(false)}><X size={24} /></button>
            </div>
            <form className="elite-form" onSubmit={handleCreate}>
              <div className="elite-input-group">
                <label className="elite-input-label">Full Nomenclature</label>
                <input type="text" className="elite-glass-input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="elite-input-group">
                <label className="elite-input-label">System Email</label>
                <input type="email" className="elite-glass-input" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="elite-input-group">
                <label className="elite-input-label">Authorization Role</label>
                <select className="elite-glass-input" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                  <option value="staff">Staff</option>
                  <option value="shop_manager">Shop Manager</option>
                  <option value="admin">Super Admin</option>
                  <option value="auditor">Internal Auditor</option>
                </select>
              </div>
              <div className="elite-input-group">
                <label className="elite-input-label">Primary Password</label>
                <input type="password" className="elite-glass-input" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="modal-actions-elite">
                <button type="submit" className="elite-btn" disabled={actionLoading}>{actionLoading ? 'Initializing...' : 'Authorize Account'}</button>
                <button type="button" className="elite-btn-outline" onClick={() => setIsCreateOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (Account Settings) */}
      {isEditOpen && (
        <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && setIsEditOpen(false)}>
          <div className="elite-modal glass-panel">
            <div className="modal-top">
               <h2 className="couture-text">Account Settings</h2>
               <button className="close-btn" onClick={() => setIsEditOpen(false)}><X size={24} /></button>
            </div>
            <form className="elite-form" onSubmit={handleUpdate}>
               <div className="elite-input-group">
                 <label className="elite-input-label">Principal Name</label>
                 <input type="text" className="elite-glass-input" value={selectedUser.name} onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})} />
               </div>
               <div className="elite-input-group">
                 <label className="elite-input-label">Role Tier</label>
                 <select className="elite-glass-input" value={selectedUser.role} onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value})}>
                    <option value="staff">Staff</option>
                    <option value="shop_manager">Shop Manager</option>
                    <option value="admin">Super Admin</option>
                    <option value="auditor">Internal Auditor</option>
                 </select>
               </div>
               <div className="elite-input-group">
                 <label className="elite-input-label">Access State</label>
                 <select className="elite-glass-input" value={selectedUser.isActive ? 'true' : 'false'} onChange={(e) => setSelectedUser({...selectedUser, isActive: e.target.value === 'true'})}>
                    <option value="true">Grant Absolute Access</option>
                    <option value="false">Revoke All Sessions</option>
                 </select>
               </div>
               <div className="modal-actions-elite">
                 <button type="submit" className="elite-btn" disabled={actionLoading}>{actionLoading ? 'Synchronizing...' : 'Save Changes'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isPasswordOpen && selectedUser && (
        <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && setIsPasswordOpen(false)}>
          <div className="elite-modal glass-panel">
            <div className="modal-top">
               <h2 className="couture-text">Secure Credentials</h2>
               <button className="close-btn" onClick={() => setIsPasswordOpen(false)}><X size={24} /></button>
            </div>
            <form className="elite-form" onSubmit={handlePasswordReset}>
               <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                 Update security credentials for <strong>{selectedUser.name}</strong>
               </p>
               <div className="elite-input-group">
                 <label className="elite-input-label">New Master Password</label>
                 <input type="password" className="elite-glass-input" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
               </div>
               <div className="elite-input-group">
                 <label className="elite-input-label">Confirm Master Password</label>
                 <input type="password" className="elite-glass-input" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
               </div>
               <div className="modal-actions-elite">
                 <button type="submit" className="elite-btn" disabled={actionLoading}>
                   {actionLoading ? 'Updating Matrix...' : 'Commit New Password'}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && selectedUser && (
        <div className="elite-overlay" onClick={(e) => e.target === e.currentTarget && setIsDeleteOpen(false)}>
          <div className="elite-modal glass-panel">
            <div className="modal-top">
               <h2 className="couture-text" style={{ color: '#ef4444' }}>Revoke Authority</h2>
               <button className="close-btn" onClick={() => setIsDeleteOpen(false)}><X size={24} /></button>
            </div>
            <div className="elite-form">
               <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '32px', lineHeight: '1.6' }}>
                 You are about to decommission <strong>{selectedUser.name}</strong>. This action will permanently revoke all system access and cannot be undone.
               </p>
               <div className="modal-actions-elite">
                 <button 
                   className="elite-btn" 
                   style={{ background: '#ef4444' }} 
                   onClick={handleDelete} 
                   disabled={actionLoading}
                 >
                   {actionLoading ? 'Decommissioning...' : 'Confirm Revocation'}
                 </button>
                 <button className="elite-btn-outline" onClick={() => setIsDeleteOpen(false)}>Abort Action</button>
               </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-governance-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }
        .atelier-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; border-left: 3px solid var(--color-primary); padding-left: 24px; }
        
        .elite-banner { display: flex; align-items: center; gap: 12px; padding: 12px 24px; border-radius: 4px; margin-bottom: 24px; font-weight: 600; font-size: 0.9rem; position: relative; }
        .elite-banner.success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .elite-banner.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }

        .atelier-discovery { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 24px; }
        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 10px 16px; display: flex; align-items: center; flex: 1; max-width: 400px; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }
        .filter-glass-matrix { display: flex; gap: 12px; }
        .select-glass-wrapper { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 4px; padding: 8px 16px; display: flex; align-items: center; gap: 10px; }
        .select-glass-wrapper select { background: none; border: none; color: var(--color-text); outline: none; cursor: pointer; font-size: 0.85rem; }

        .table-glass-container { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 4px; padding: 0; overflow: hidden; }
        .modern-table.elite-glass-table thead tr { background: var(--color-surface); }
        .modern-table.elite-glass-table th { padding: 20px; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 2px; color: var(--color-text-muted); font-weight: 700; border-bottom: 2px solid var(--color-border); }
        .modern-table.elite-glass-table td { padding: 20px; border-bottom: 1px solid var(--color-border-light); border-top: none; }
        
        .user-profile-cell { display: flex; align-items: center; gap: 16px; }
        .avatar-box { width: 44px; height: 44px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; color: #000; }
        .avatar-box.admin { background: linear-gradient(135deg, var(--color-primary), #d4af37); }
        .avatar-box.staff { background: #555; color: white; }
        
        .profile-info { display: flex; flex-direction: column; }
        .profile-name { font-weight: 700; color: var(--color-text-header); font-size: 0.95rem; }
        .profile-email { font-size: 0.75rem; color: var(--color-text-muted); }

        .role-badge-elite { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; background: var(--color-surface); color: var(--color-text); font-size: 0.65rem; font-weight: 700; letter-spacing: 1px; border-radius: 2px; }
        .role-badge-elite.admin { border-left: 2px solid var(--color-primary); color: var(--color-primary-dark); background: var(--color-border-light); }
        
        .status-pill-elite { display: inline-flex; align-items: center; gap: 8px; font-size: 0.65rem; font-weight: 700; letter-spacing: 1.5px; }
        .status-pill-elite.active { color: #2ecc71; }
        .status-pill-elite.locked { color: #e74c3c; }

        .engagement-cell { font-family: monospace; font-size: 0.8rem; color: var(--color-text-muted); }
        
        .action-matrix { display: flex; gap: 12px; }
        .btn-mini-action.delete:hover { color: #e74c3c; }
        .btn-mini-action.secure:hover { color: var(--color-primary); }

        .elite-pagination { display: flex; justify-content: space-between; align-items: center; padding: 24px; background: var(--color-surface); border-top: 1px solid var(--color-border); }
        .pagination-intel { font-size: 0.8rem; color: var(--color-text-muted); }
        .elite-page-btn { background: none; border: 1px solid var(--color-border); color: var(--color-text); padding: 6px 16px; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 0.8rem; }
        .elite-page-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-border-light); }
        .elite-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .current-page { font-size: 0.8rem; font-weight: 700; color: var(--color-text-header); }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
}
