import { useState, useEffect } from 'react';
import { PreferencesContext, PREF_KEY } from './PreferencesContext';

const DEFAULT_PREFS = {
  compactMode: false,
  privacyMode: false,
  autoRefresh: 'off',
  defaultSection: 'overview',
  lowStockThreshold: 5,
  lowStockAlertsEnabled: true,
  reduceMotion: false
};

/**
 * Global preference orchestration for the TOCA administrative suite.
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
    // Apply globally accessible CSS classes to document root.
    // Appearance (finish/accent/presence) is owned by AppearanceProvider,
    // which applies its own classes to <html> — not duplicated here.
    document.documentElement.classList.toggle('compact-mode', prefs.compactMode);
    document.documentElement.classList.toggle('privacy-mode', prefs.privacyMode);
    document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion);
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
