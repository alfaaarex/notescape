'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, CheckSquare, ArrowRight, CornerDownLeft, Command, Plus } from 'lucide-react';
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
        { kind: 'action', label: 'NEW NOTE', action: () => { onCreateNote(); onClose(); } },
        { kind: 'action', label: 'NEW TASK', action: () => { onCreateTask(); onClose(); } },
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
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm te-noise"
            onClick={onClose}
          />
          <motion.div
            key="cp-modal"
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg overflow-hidden rounded-xl te-surface shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
              <div className="te-inset p-1.5 rounded-md text-primary">
                <Command size={14} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="TYPE A COMMAND OR SEARCH..."
                className="flex-1 bg-transparent text-sm font-mono font-bold uppercase text-foreground placeholder:text-muted-foreground/50 border-none outline-none"
              />
              <kbd className="hidden sm:flex px-2 py-1 text-[10px] font-mono font-bold tracking-widest text-muted-foreground te-button rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-2 px-2">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Search size={24} className="mb-2 text-muted-foreground" />
                  <p className="text-center text-[10px] font-mono font-bold tracking-widest uppercase text-muted-foreground">NO MATCHES FOUND</p>
                </div>
              ) : (
                results.map((item, idx) => {
                  const active = activeIndex === idx;
                  return (
                    <button
                      key={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(item)}
                      className={`group flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        active ? 'te-inset bg-background' : 'hover:bg-muted/50'
                      }`}
                    >
                      {item.kind === 'note' ? (
                        <>
                          <div className={`p-1.5 rounded-md ${active ? 'bg-primary text-primary-foreground' : 'te-button text-muted-foreground'}`}>
                            <FileText size={13} />
                          </div>
                          <span className={`flex-1 text-xs font-bold font-mono tracking-wide truncate ${active ? 'text-primary' : 'text-foreground'}`}>
                            {item.note.title.toUpperCase() || 'UNTITLED'}
                          </span>
                          {active && <CornerDownLeft size={12} className="text-primary flex-shrink-0" />}
                        </>
                      ) : item.kind === 'task' ? (
                        <>
                          <div className={`p-1.5 rounded-md ${active ? 'bg-primary text-primary-foreground' : 'te-button text-muted-foreground'}`}>
                            <CheckSquare size={13} />
                          </div>
                          <span className={`flex-1 text-xs font-bold font-mono tracking-wide truncate ${active ? 'text-primary' : 'text-foreground'}`}>
                            {item.task.title.toUpperCase()}
                          </span>
                          {active && <CornerDownLeft size={12} className="text-primary flex-shrink-0" />}
                        </>
                      ) : (
                        <>
                          <div className={`p-1.5 rounded-md ${active ? 'bg-primary text-primary-foreground' : 'te-inset bg-background text-muted-foreground'}`}>
                            <Plus size={13} />
                          </div>
                          <span className={`flex-1 text-xs font-bold font-mono tracking-wide ${active ? 'text-primary' : 'text-foreground'}`}>
                            {item.label}
                          </span>
                          {active && <CornerDownLeft size={12} className="text-primary flex-shrink-0" />}
                        </>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-[9px] font-mono font-bold tracking-widest text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5"><kbd className="te-button px-1 rounded">↑↓</kbd> NAVIGATE</span>
              <span className="flex items-center gap-1.5"><kbd className="te-button px-1 rounded">↵</kbd> EXECUTE</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
