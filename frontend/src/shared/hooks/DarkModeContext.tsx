import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'theme-preference';

function getInitial(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

interface DarkModeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue>({ isDark: false, toggle: () => undefined });

/**
 * Applies the `dark` class at the document root regardless of which route is
 * active — dark mode must not depend on being inside the authenticated app
 * shell (spec §5 "Dark mode support from day one").
 */
export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  return <DarkModeContext.Provider value={{ isDark, toggle: () => setIsDark((d) => !d) }}>{children}</DarkModeContext.Provider>;
}

export function useDarkMode(): [boolean, () => void] {
  const ctx = useContext(DarkModeContext);
  return [ctx.isDark, ctx.toggle];
}
