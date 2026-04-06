import React, { useState, useEffect } from 'react';
import { PreferencesContext, PREF_KEY } from './PreferencesContext';

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
