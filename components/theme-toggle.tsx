'use client';

import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { isDark, setMode } = useTheme();

  const toggle = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="relative flex h-7 w-14 items-center rounded-full te-inset p-0.5 transition-all"
      aria-label="Toggle theme"
    >
      <motion.span
        layout
        animate={{ x: isDark ? 26 : 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative flex h-6 w-6 items-center justify-center rounded-full te-button"
      >
        {isDark ? (
          <Moon size={11} className="text-[#FF6B35]" />
        ) : (
          <Sun size={11} className="text-[#FF6B35]" />
        )}
      </motion.span>
    </button>
  );
}
