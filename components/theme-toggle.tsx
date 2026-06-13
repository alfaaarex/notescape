'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('notescape-theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('notescape-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="relative flex h-7 w-13 items-center rounded-full border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 p-0.5 transition-all hover:border-gray-300 dark:hover:border-zinc-600"
      aria-label="Toggle theme"
    >
      <motion.span
        layout
        animate={{ x: isDark ? 24 : 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-sm"
      >
        {isDark ? (
          <Moon size={12} className="text-indigo-400" />
        ) : (
          <Sun size={12} className="text-amber-500" />
        )}
      </motion.span>
    </button>
  );
}
