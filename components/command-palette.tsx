'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, CheckSquare, ArrowRight } from 'lucide-react';
import type { Note } from '@/lib/storage';
import type { Task } from '@/lib/types';

interface CommandPaletteProps {
  open: boolean;
  notes: Note[];
  tasks: Task[];
  onClose: () => void;
  onSelectNote: (note: Note) => void;
  onSelectTask: (task: Task) => void;
  onCreateNote: () => void;
  onCreateTask: () => void;
}

type ResultItem =
  | { kind: 'note'; note: Note }
  | { kind: 'task'; task: Task }
  | { kind: 'action'; label: string; action: () => void };

export function CommandPalette({
  open,
  notes,
  tasks,
  onClose,
  onSelectNote,
  onSelectTask,
  onCreateNote,
  onCreateTask,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setQuery('');
        setActiveIndex(0);
        inputRef.current?.focus();
      }, 80);
    }
  }, [open]);

  const results: ResultItem[] = query.trim()
    ? [
        ...notes
          .filter(
            (n) =>
              n.title.toLowerCase().includes(query.toLowerCase()) ||
              n.content.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 4)
          .map((note): ResultItem => ({ kind: 'note', note })),
        ...tasks
          .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 3)
          .map((task): ResultItem => ({ kind: 'task', task })),
      ]
    : [
        { kind: 'action', label: 'New Note', action: () => { onCreateNote(); onClose(); } },
        { kind: 'action', label: 'New Task', action: () => { onCreateTask(); onClose(); } },
        ...notes.slice(0, 5).map((note): ResultItem => ({ kind: 'note', note })),
      ];

  const handleSelect = useCallback(
    (item: ResultItem) => {
      if (item.kind === 'note') { onSelectNote(item.note); onClose(); }
      else if (item.kind === 'task') { onSelectTask(item.task); onClose(); }
      else { item.action(); }
    },
    [onSelectNote, onSelectTask, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIndex]) handleSelect(results[activeIndex]);
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="cp-modal"
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-gray-200 dark:border-zinc-700"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-zinc-800">
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search notes, tasks, or type a command..."
                className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 border-none outline-none"
              />
              <kbd className="hidden sm:block px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-700">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No results found</p>
              ) : (
                results.map((item, idx) => (
                  <button
                    key={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      activeIndex === idx
                        ? 'bg-gray-100 dark:bg-zinc-800'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    {item.kind === 'note' ? (
                      <>
                        <FileText size={15} className="text-gray-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                          {item.note.title || 'Untitled'}
                        </span>
                        <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
                      </>
                    ) : item.kind === 'task' ? (
                      <>
                        <CheckSquare size={15} className="text-gray-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                          {item.task.title}
                        </span>
                        <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
                      </>
                    ) : (
                      <>
                        <span className="w-5 h-5 flex items-center justify-center rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-bold">
                          +
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.label}
                        </span>
                      </>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-zinc-800 text-[11px] text-gray-400">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> select</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
