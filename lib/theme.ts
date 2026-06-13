'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type AccentColor = 'indigo' | 'violet' | 'rose' | 'amber' | 'emerald' | 'sky';
export type EditorFont  = 'sans' | 'serif' | 'mono';

export const ACCENT_OPTIONS: Array<{ id: AccentColor; label: string; hex: string; light: string }> = [
  { id: 'indigo',  label: 'Indigo',  hex: '#6366f1', light: '#eef2ff' },
  { id: 'violet',  label: 'Violet',  hex: '#8b5cf6', light: '#f5f3ff' },
  { id: 'rose',    label: 'Rose',    hex: '#f43f5e', light: '#fff1f2' },
  { id: 'amber',   label: 'Amber',   hex: '#f59e0b', light: '#fffbeb' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981', light: '#ecfdf5' },
  { id: 'sky',     label: 'Sky',     hex: '#0ea5e9', light: '#f0f9ff' },
];

export const NOTE_COLORS: Array<{ id: string; label: string; hex: string; darkHex: string }> = [
  { id: 'alabaster', label: 'Alabaster',   hex: '#F9F9F6', darkHex: '#1c1c1a' },
  { id: 'sage',      label: 'Soft Sage',   hex: '#EEF2EE', darkHex: '#182018' },
  { id: 'linen',     label: 'Warm Linen',  hex: '#FDF8F5', darkHex: '#1f1b17' },
  { id: 'slate',     label: 'Faint Slate', hex: '#F0F1F4', darkHex: '#191a20' },
  { id: 'lavender',  label: 'Lavender',    hex: '#F3EFFF', darkHex: '#1a1726' },
  { id: 'blush',     label: 'Blush',       hex: '#FDF0F0', darkHex: '#20181a' },
  { id: 'frost',     label: 'Frost',       hex: '#EFF7FD', darkHex: '#161e26' },
  { id: 'honey',     label: 'Honey',       hex: '#FEFBEA', darkHex: '#1f1c10' },
  { id: 'mint',      label: 'Mint',        hex: '#EEFAF5', darkHex: '#141f1b' },
  { id: 'dusk',      label: 'Dusk',        hex: '#2D2B3D', darkHex: '#1E1B2E' },
];

interface ThemeContextType {
  accent: AccentColor;
  setAccent: (a: AccentColor) => void;
  editorFont: EditorFont;
  setEditorFont: (f: EditorFont) => void;
  isDark: boolean;
  toggleDark: () => void;
}

import React from 'react';

export const ThemeContext = createContext<ThemeContextType>({
  accent: 'indigo',
  setAccent: () => {},
  editorFont: 'sans',
  setEditorFont: () => {},
  isDark: false,
  toggleDark: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>('indigo');
  const [editorFont, setEditorFontState] = useState<EditorFont>('sans');
  const [isDark, setIsDark] = useState(false);

  // Initialise from localStorage on mount
  useEffect(() => {
    const storedAccent = localStorage.getItem('ns-accent') as AccentColor | null;
    const storedFont   = localStorage.getItem('ns-editor-font') as EditorFont | null;
    const storedDark   = localStorage.getItem('notescape-theme');
    const prefersDark  = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const resolvedAccent: AccentColor = storedAccent ?? 'indigo';
    const resolvedFont: EditorFont   = storedFont ?? 'sans';
    const resolvedDark = storedDark === 'dark' || (!storedDark && prefersDark);

    setAccentState(resolvedAccent);
    setEditorFontState(resolvedFont);
    setIsDark(resolvedDark);

    document.documentElement.setAttribute('data-accent', resolvedAccent);
    document.documentElement.classList.toggle('dark', resolvedDark);
  }, []);

  const setAccent = useCallback((a: AccentColor) => {
    setAccentState(a);
    document.documentElement.setAttribute('data-accent', a);
    localStorage.setItem('ns-accent', a);
  }, []);

  const setEditorFont = useCallback((f: EditorFont) => {
    setEditorFontState(f);
    localStorage.setItem('ns-editor-font', f);
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('notescape-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return React.createElement(
    ThemeContext.Provider,
    { value: { accent, setAccent, editorFont, setEditorFont, isDark, toggleDark } },
    children,
  );
}
