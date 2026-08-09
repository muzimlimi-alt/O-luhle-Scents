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

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
