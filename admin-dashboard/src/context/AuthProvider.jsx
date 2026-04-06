import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { authApi } from '../services/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const token = localStorage.getItem('oluhle_admin_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (err) {
      console.error('[Auth Sync Failure]', err);
      localStorage.removeItem('oluhle_admin_token');
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
    localStorage.setItem('oluhle_admin_token', token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('oluhle_admin_token');
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
