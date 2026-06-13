'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ArrowRight, X } from 'lucide-react';
import type { TaskPriority, TaskStatus } from '@/lib/types';
import { TASK_COLOR_OPTIONS } from '@/lib/types';

export interface NlpParsedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  colorTag: string;
}

interface NlpTaskInputProps {
  onParsed: (parsed: NlpParsedTask, rawInput: string) => void;
}

const EXAMPLES = [
  'Fix login bug high priority due tomorrow',
  'Review PR medium priority next Friday',
  'Write tests for auth module due next week',
  'Deploy to staging today urgent',
  'Update docs low priority no due date',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function offsetISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextWeekdayISO(weekday: number) {
  // weekday: 0=Sun … 6=Sat
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve relative date tokens the model might emit to real ISO dates.
 * The model returns tokens like "today", "tomorrow", "next monday", etc.
 * We convert them so the modal gets a concrete YYYY-MM-DD string.
 */
function resolveDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'today') return todayISO();
  if (s === 'tomorrow') return offsetISO(1);
  if (s === 'yesterday') return offsetISO(-1);
  if (s === 'next week' || s === 'in a week') return offsetISO(7);
  if (s === 'in two weeks' || s === 'in 2 weeks') return offsetISO(14);
  const days: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const nextDayMatch = s.match(/^(?:next\s+)?(\w+)$/);
  if (nextDayMatch && days[nextDayMatch[1]] !== undefined) {
    return nextWeekdayISO(days[nextDayMatch[1]]);
  }
  // If it already looks like ISO (YYYY-MM-DD), pass through
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NlpTaskInput({ onParsed }: NlpTaskInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const cycleExample = useCallback(() => {
    setExampleIdx((i) => (i + 1) % EXAMPLES.length);
  }, []);

  const parse = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const systemPrompt = `You are a task parser. Today is ${today}.
Extract structured task data from the user's natural language input.
Return ONLY a valid JSON object — no markdown fences, no prose, nothing else.

JSON shape:
{
  "title": string,          // concise action title
  "description": string,    // optional extra detail (empty string if none)
  "priority": "high" | "medium" | "low" | "none",
  "status": "todo" | "in_progress" | "done" | "cancelled",
  "dueDate": string | null, // "today" / "tomorrow" / "YYYY-MM-DD" / "next monday" / null
  "colorTag": "rose" | "amber" | "emerald" | "sky" | "violet" | "slate"
}

Rules:
- title: extract the core task, strip meta words like "urgent", "high priority", "due tomorrow"
- priority: "urgent" / "critical" / "asap" → high; "soon" → medium; "when you can" → low
- colorTag: infer from domain — bugs/errors → rose; deadlines/reviews → amber; features/builds → emerald; docs/comms → sky; design → violet; default → slate
- dueDate: resolve relative dates relative to today. Return "today", "tomorrow", day name like "monday", "next week", or null
- status: default "todo" unless user says "working on", "in progress" → in_progress; "done"/"finished" → done`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: trimmed }],
        }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);

      const data = await response.json();
      const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
      const clean = text.replace(/```(?:json)?|```/g, '').trim();
      const parsed = JSON.parse(clean) as NlpParsedTask;

      // Validate and normalise
      const validPriorities: TaskPriority[] = ['high', 'medium', 'low', 'none'];
      const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
      const validColors = TASK_COLOR_OPTIONS.map((c) => c.value);

      const result: NlpParsedTask = {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : trimmed,
        description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
        priority: validPriorities.includes(parsed.priority) ? parsed.priority : 'none',
        status: validStatuses.includes(parsed.status) ? parsed.status : 'todo',
        dueDate: resolveDate(parsed.dueDate),
        colorTag: validColors.includes(parsed.colorTag) ? parsed.colorTag : 'slate',
      };

      setInput('');
      onParsed(result, trimmed);
    } catch (err) {
      console.error('NLP parse failed:', err);
      setError('Couldn\'t parse that — opening blank task instead.');
      // Graceful fallback: open modal with just the raw title
      setTimeout(() => {
        setError(null);
        onParsed({
          title: trimmed,
          description: '',
          priority: 'none',
          status: 'todo',
          dueDate: null,
          colorTag: 'slate',
        }, trimmed);
        setInput('');
      }, 1800);
    } finally {
      setLoading(false);
    }
  }, [input, loading, onParsed]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') parse();
    if (e.key === 'Escape') setInput('');
  };

  return (
    <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-indigo-50/60 via-white to-purple-50/40 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-purple-950/20">
      <div className="flex items-center gap-2">
        {/* Icon */}
        <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400">
          <Sparkles size={15} />
        </div>

        {/* Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Try: "${EXAMPLES[exampleIdx]}"`}
            disabled={loading}
            onClick={cycleExample}
            className="w-full bg-transparent text-sm text-gray-700 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none pr-8 disabled:opacity-60"
          />
          {input && !loading && (
            <button
              onClick={() => setInput('')}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 dark:hover:text-zinc-400"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={parse}
          disabled={!input.trim() || loading}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Parse task"
        >
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <ArrowRight size={14} />
          }
        </button>
      </div>

      {/* Label + error */}
      <AnimatePresence>
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 text-[11px] text-amber-500 dark:text-amber-400"
          >
            {error}
          </motion.p>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1 text-[11px] text-gray-400 dark:text-zinc-500"
          >
            Describe a task in plain English — AI fills in priority, due date & more
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
