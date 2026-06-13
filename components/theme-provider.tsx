'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark' | 'system';
export type ThemeColor = 'zinc' | 'slate' | 'rose' | 'indigo' | 'emerald' | 'amber';

interface ThemeContextType {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  color: ThemeColor;
  setColor: (color: ThemeColor) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>('system');
  const [color, setColor] = useState<ThemeColor>('zinc');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('notescape-mode') as ColorMode | null;
    const savedColor = localStorage.getItem('notescape-color') as ThemeColor | null;
    
    if (savedMode) setMode(savedMode);
    if (savedColor) setColor(savedColor);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply color mode
    const applyDarkMode = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(applyDarkMode);
    
    root.classList.remove('light', 'dark');
    root.classList.add(applyDarkMode ? 'dark' : 'light');

    // Apply color theme
    root.classList.remove('theme-zinc', 'theme-slate', 'theme-rose', 'theme-indigo', 'theme-emerald', 'theme-amber');
    root.classList.add(`theme-${color}`);
    
    localStorage.setItem('notescape-mode', mode);
    localStorage.setItem('notescape-color', color);
  }, [mode, color]);

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
    <ThemeContext.Provider value={{ mode, setMode, color, setColor, isDark }}>
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
