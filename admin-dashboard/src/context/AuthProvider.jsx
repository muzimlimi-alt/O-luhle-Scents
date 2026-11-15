import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { authApi } from '../services/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const token = localStorage.getItem('toca_admin_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (err) {
      console.error('[Auth Sync Failure]', err);
      localStorage.removeItem('toca_admin_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const { token, user: userData } = await authApi.login(email, password);
    localStorage.setItem('toca_admin_token', token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    // Best-effort: end the session server-side too, so the token can't be
    // reused even if it leaks after this — not just discarded client-side.
    authApi.logout().catch(() => {});
    localStorage.removeItem('toca_admin_token');
    setUser(null);
  };

  // Thin wrapper over the user.permissions array returned by /api/auth/me
  // (server/src/lib/permissions.js). Admin accounts always return true as
  // a safety net for permission keys the matrix hasn't learned about yet,
  // so the UI never silently hides something an admin can actually do.
  const hasPermission = (resource, action) => {
    if (!user) return false;
    if (user.role?.toLowerCase() === 'admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(`${resource}:${action}`);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuth,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
