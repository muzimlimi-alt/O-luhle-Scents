import { createContext, useContext } from 'react';

export const AppearanceContext = createContext(null);

export const useAppearance = () => useContext(AppearanceContext);

// Body class each axis value maps to. '' means "no class" (the house
// default look for that axis lives in design-tokens.css :root already).
export const APPEARANCE_CLASS = {
  finish: { obsidian: '', ember: 'finish-ember', ivory: 'finish-ivory' },
  accent: { gold: 'accent-gold', vetiver: 'accent-vetiver', cassis: 'accent-cassis', cuivre: 'accent-cuivre' },
  presence: { editorial: '', boutique: 'presence-boutique', operations: 'presence-operations' },
};
