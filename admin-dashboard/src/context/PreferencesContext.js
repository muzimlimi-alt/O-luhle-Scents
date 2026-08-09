import { createContext, useContext } from 'react';

export const PreferencesContext = createContext();

export const PREF_KEY = 'toca_admin_prefs';

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
};
