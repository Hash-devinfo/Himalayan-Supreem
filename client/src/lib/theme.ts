export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Must match the key in the script in index.html
export const THEME_STORAGE_KEY = 'hs-theme';

// Phone browser bar colour, matching --color-canvas
const BROWSER_BAR: Record<ResolvedTheme, string> = { light: '#f4f3ee', dark: '#141513' };

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system'; // storage blocked (private mode on some browsers)
  }
}

export function savePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not saved; the theme still applies for this visit
  }
}

export const systemPrefersDark = (): boolean => darkQuery().matches;

export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme; // native scrollbars and form controls follow too
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[theme]);
}

export function onSystemThemeChange(callback: () => void): () => void {
  const query = darkQuery();
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}