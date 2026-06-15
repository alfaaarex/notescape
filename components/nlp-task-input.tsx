'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, X, RotateCw, Clock, Flag, Palette } from 'lucide-react';
import type { TaskPriority, TaskStatus } from '@/lib/types';
import { TASK_COLOR_OPTIONS, PRIORITY_COLORS } from '@/lib/types';
import { parseTaskInput, recurrenceLabel } from '@/lib/regex-parser';

// Re-export so task-board / other consumers don't break
export interface NlpParsedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  dueTime?: string | null;
  colorTag: string;
  mode: 'deadline' | 'timeBox' | 'floating';
  start?: string | null;
  duration?: number;
  recurrence?: import('@/lib/types').RecurrenceRule | null;
}

interface NlpTaskInputProps {
  onParsed: (parsed: NlpParsedTask, rawInput: string) => void;
}

const EXAMPLES = [
  'Gym every Mon, Wed, Fri at 6am for 1h priority:high',
  'Fix login bug urgent at 2pm for 30min',
  'Review PR every weekday at 9am for 45min',
  'Study calculus every day at 8pm for 1.5h #medium',
  'Deploy to staging tomorrow at 3pm priority:high',
  'Design sprint every Mon at 10am for 2h',
];

// Priority badge colour helper
function priorityStyle(p: TaskPriority) {
  return { backgroundColor: PRIORITY_COLORS[p] };
}

// Format duration in minutes → "1h", "45 min", "1h 30 min"
function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Format HH:mm → "6:00 AM"
function format24to12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NlpTaskInput({ onParsed }: NlpTaskInputProps) {
  const [input, setInput] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live preview — parse as user types (debounced 120ms)
  const [preview, setPreview] = useState<NlpParsedTask | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) { setPreview(null); return; }
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = parseTaskInput(input);
        setPreview(parsed as NlpParsedTask);
      } catch {
        setPreview(null);
      }
    }, 120);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const cycleExample = useCallback(() => {
    setExampleIdx((i) => (i + 1) % EXAMPLES.length);
  }, []);

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const parsed = parseTaskInput(trimmed);
    setInput('');
    setPreview(null);
    onParsed(parsed as NlpParsedTask, trimmed);
  }, [input, onParsed]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { setInput(''); setPreview(null); }
  };

  const colorHex = preview
    ? TASK_COLOR_OPTIONS.find((c) => c.value === preview.colorTag)?.hex ?? '#94a3b8'
    : '#94a3b8';

  return (
    <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-violet-50/60 via-white to-indigo-50/40 dark:from-violet-950/20 dark:via-zinc-900 dark:to-indigo-950/20">
      {/* Input row */}
      <div className="flex items-center gap-2">
        {/* Icon — bolt for instant parsing */}
        <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400">
          <Zap size={15} />
        </div>

        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Try: "${EXAMPLES[exampleIdx]}"`}
            onClick={cycleExample}
            className="w-full bg-transparent text-sm text-gray-700 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none pr-8"
          />
          {input && (
            <button
              onClick={() => { setInput(''); setPreview(null); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 dark:hover:text-zinc-400"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!input.trim()}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Create task"
        >
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Live parse preview */}
      <AnimatePresence mode="wait">
        {preview && input.trim() ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-2 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {/* Color dot + title */}
              <span
                className="flex items-center gap-1 font-medium text-gray-700 dark:text-zinc-200 truncate max-w-[160px]"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorHex }}
                />
                {preview.title || '…'}
              </span>

              {/* Priority badge */}
              {preview.priority !== 'none' && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-white font-semibold uppercase tracking-wider"
                  style={priorityStyle(preview.priority)}
                >
                  <Flag size={9} className="inline mr-0.5 -mt-px" />
                  {preview.priority}
                </span>
              )}

              {/* Recurrence badge */}
              {preview.recurrence && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 font-medium">
                  <RotateCw size={9} />
                  {recurrenceLabel(preview.recurrence)}
                </span>
              )}

              {/* Time */}
              {preview.dueTime && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 font-medium">
                  <Clock size={9} />
                  {format24to12(preview.dueTime)}
                </span>
              )}

              {/* Duration */}
              {!!preview.duration && preview.duration > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                  {formatDuration(preview.duration)}
                </span>
              )}

              {/* Mode chip */}
              <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-medium capitalize">
                {preview.mode}
              </span>

              {/* Color label */}
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-medium">
                <Palette size={9} />
                {preview.colorTag}
              </span>

              {/* Enter hint */}
              <span className="ml-auto text-gray-300 dark:text-zinc-600 hidden sm:inline">
                ↵ to create
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 text-[11px] text-gray-400 dark:text-zinc-500"
          >
            Instant parsing — type a task with time, recurrence, and priority. No AI needed.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
