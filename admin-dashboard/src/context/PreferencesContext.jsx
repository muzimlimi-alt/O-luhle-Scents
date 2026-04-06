import React, { createContext, useContext, useState, useEffect } from 'react';

const PreferencesContext = createContext();

export const PREF_KEY = 'oluhle_admin_prefs';

const DEFAULT_PREFS = {
  theme: 'dark',
  compactMode: false,
  privacyMode: false,
  autoRefresh: 'off',
  defaultSection: 'overview',
  lowStockThreshold: 5
};

/**
 * Global preference orchestration for the O'luhle Scents administrative suite.
 * ensures absolute synchronization between localized UI settings and the PostgreSQL fulfillment engine.
 * persists state in 'localStorage' to maintain continuity with legacy administrative patterns.
 * provides a unified interface for Theme, Compact Mode, and Privacy Mode (Revenue Blurring).
 */
export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(PREF_KEY);
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    // Apply globally accessible CSS classes to document root
    document.documentElement.setAttribute('data-theme', prefs.theme);
    document.documentElement.classList.toggle('compact-mode', prefs.compactMode);
    document.documentElement.classList.toggle('privacy-mode', prefs.privacyMode);
  }, [prefs]);

  const updatePrefs = (updates) => {
    setPrefs(prev => ({ ...prev, ...updates }));
  };

  const resetPrefs = () => {
    setPrefs(DEFAULT_PREFS);
  };

  return (
    <PreferencesContext.Provider value={{ prefs, updatePrefs, resetPrefs }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
};
