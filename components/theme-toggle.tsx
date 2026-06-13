'use client';

import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme, ACCENT_OPTIONS } from '@/lib/theme';

export function ThemeController() {
  const { isDark, toggleDark, accent, setAccent } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Accent swatches */}
      <div className="flex items-center gap-1">
        {ACCENT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setAccent(opt.id)}
            title={opt.label}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 flex-shrink-0 ${
              accent === opt.id
                ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 scale-125'
                : 'opacity-50 hover:opacity-100 hover:scale-110'
            }`}
            style={{
              backgroundColor: opt.hex,
              ringColor: opt.hex,
            }}
          />
        ))}
      </div>

      {/* Dark/Light toggle pill */}
      <button
        onClick={toggleDark}
        className="relative flex h-6 w-11 items-center rounded-full border border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 p-0.5 transition-all hover:border-gray-300 dark:hover:border-zinc-600 flex-shrink-0"
        aria-label="Toggle theme"
      >
        <motion.span
          layout
          animate={{ x: isDark ? 20 : 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-sm"
        >
          {isDark ? (
            <Moon size={10} className="ns-accent-text" />
          ) : (
            <Sun size={10} className="text-amber-500" />
          )}
        </motion.span>
      </button>
    </div>
  );
}

/** Legacy alias kept so old imports don't break */
export { ThemeController as ThemeToggle };
