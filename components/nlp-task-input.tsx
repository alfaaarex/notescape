'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, X, RotateCw, Clock, Flag } from 'lucide-react';
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
    <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-border bg-background te-inset rounded-none">
      <div className="flex items-center gap-1.5 mb-2 te-label">
        <span className="w-1.5 h-1.5 rounded-full te-led te-led-on" />
        QUICK INPUT / NLP PARSER
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg te-button text-primary">
          <Zap size={14} />
        </div>

        <div className="relative flex-1 te-inset rounded-lg px-3 py-2 flex items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`TRY: "${EXAMPLES[exampleIdx].toUpperCase()}"`}
            onClick={cycleExample}
            className="w-full bg-transparent text-xs font-mono font-bold uppercase text-foreground placeholder:text-muted-foreground/50 outline-none pr-8"
          />
          {input && (
            <button onClick={() => { setInput(''); setPreview(null); }} className="absolute right-2 p-1 te-button rounded text-muted-foreground">
              <X size={12} />
            </button>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!input.trim()}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg te-button-primary disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Create task"
        >
          <ArrowRight size={14} />
        </button>
      </div>

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
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
              <span className="flex items-center gap-1 text-foreground truncate max-w-[160px] uppercase">
                <span className="w-2 h-2 rounded-sm flex-shrink-0 border border-black/20" style={{ backgroundColor: colorHex }} />
                {preview.title || '…'}
              </span>

              {preview.priority !== 'none' && (
                <span className="px-1.5 py-0.5 rounded te-inset text-white uppercase tracking-wider" style={priorityStyle(preview.priority)}>
                  <Flag size={9} className="inline mr-0.5" />
                  {preview.priority}
                </span>
              )}

              {preview.recurrence && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded te-inset text-primary uppercase">
                  <RotateCw size={9} />
                  {recurrenceLabel(preview.recurrence)}
                </span>
              )}

              {preview.dueTime && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded te-inset text-muted-foreground uppercase">
                  <Clock size={9} />
                  {format24to12(preview.dueTime)}
                </span>
              )}

              {!!preview.duration && preview.duration > 0 && (
                <span className="px-1.5 py-0.5 rounded te-inset text-muted-foreground uppercase">
                  {formatDuration(preview.duration)}
                </span>
              )}

              <span className="px-1.5 py-0.5 rounded te-inset text-muted-foreground uppercase">{preview.mode}</span>

              <span className="ml-auto text-muted-foreground/60 hidden sm:inline uppercase tracking-widest">↵ EXECUTE</span>
            </div>
          </motion.div>
        ) : (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
            // Instant parsing — time, recurrence, priority. No AI required.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
