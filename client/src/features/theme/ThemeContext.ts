import { createContext } from 'react';
import type { ResolvedTheme, ThemePreference } from '../../lib/theme';

export interface ThemeValue {
  preference: ThemePreference; // what the person chose
  resolvedTheme: ResolvedTheme; // what is showing now
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);