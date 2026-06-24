'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>('system');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('notescape-mode') as ColorMode | null;
    if (savedMode) setMode(savedMode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // Apply color mode
    const applyDarkMode = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(applyDarkMode);

    root.classList.remove('light', 'dark');
    root.classList.add(applyDarkMode ? 'dark' : 'light');

    localStorage.setItem('notescape-mode', mode);
  }, [mode]);

  // Listen to system changes
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
