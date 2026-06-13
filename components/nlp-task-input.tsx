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
  dueTime?: string | null;
  colorTag: string;
  mode: 'deadline' | 'timeBox' | 'floating';
  start?: string | null;
  duration?: number;
}

interface NlpTaskInputProps {
  onParsed: (parsed: NlpParsedTask, rawInput: string) => void;
}

const EXAMPLES = [
  'Study physics for 45 mins at 4 PM tomorrow',
  'Fix login bug high priority due by 3 PM Friday',
  'Review PR medium priority next Friday',
  'Read calculus module when I have time',
  'Deploy to staging today urgent',
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
  const d = new Date();
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

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

    const systemPrompt = `You are an expert task extraction assistant. Today is ${today}.
Parse the user's input sentence and match it perfectly to one of these three task modes:

1. "timeBox": When a specific length/duration or an exact starting timeline block is explicitly stated (e.g., "for 45 minutes", "1 hour session at 4pm").
2. "floating": When the task is open-ended without any date constraints or expressions indicating casual pacing (e.g., "when I get around to it", "someday").
3. "deadline": Default choice for classic tasks that need completion by a specific date/time without defining a duration block.

Extraction rules:
- title: clear task action, excluding metadata phrasing like "urgent", "due tomorrow", or "for 30 mins".
- priority: "urgent"/"critical"/"asap" -> high; "soon" -> medium; "whenever" -> low; else -> none.
- colorTag: infer from task domain (coding/bugs -> rose; reviews/deadlines -> amber; features -> emerald; docs/admin -> sky; design -> violet; else -> slate).
- dueDate: parse into tokens like "today", "tomorrow", day names like "monday", or null.
- dueTime: extract concrete times into HH:mm format (24hr clock).
- start: For "timeBox" mode only. Construct a partial target timestamp format relative to the intent (e.g., "YYYY-MM-DDTHH:mm:00"). If date is missing, infer the target date based on context.
- duration: For "timeBox" mode only. Extract the time length block strictly in total minutes as an integer.`;

    // Structured JSON schema matching the xAI strict object specs
    const jsonSchema = {
      name: "task_extraction",
      strict: true,
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low", "none"] },
          status: { type: "string", enum: ["todo", "in_progress", "done", "cancelled"] },
          mode: { type: "string", enum: ["deadline", "timeBox", "floating"] },
          dueDate: { type: "string", nullable: true },
          dueTime: { type: "string", nullable: true, description: "Format as HH:mm or null" },
          start: { type: "string", nullable: true, description: "For timebox mode: YYYY-MM-DDTHH:mm:00 structure or null" },
          duration: { type: "number", description: "Duration block in total minutes, default 0" },
          colorTag: { type: "string", enum: ["rose", "amber", "emerald", "sky", "violet", "slate"] }
        },
        required: ["title", "description", "priority", "status", "mode", "dueDate", "dueTime", "start", "duration", "colorTag"],
        additionalProperties: false
      }
    };

    try {
      const apiKey = process.env.NEXT_PUBLIC_XAI_API_KEY;
      if (!apiKey) throw new Error("xAI API key is missing from environment variables.");

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-2-1212', // Can change to 'grok-beta' if preferred
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmed }
          ],
          response_format: {
            type: "json_schema",
            json_schema: jsonSchema
          },
          temperature: 0.1,
        }),
      });

      if (!response.ok) throw new Error(`xAI API error ${response.status}`);

      const data = await response.json();
      const textOutput = data.choices?.[0]?.message?.content;
      if (!textOutput) throw new Error("Received an empty response text payload from xAI.");

      const parsed = JSON.parse(textOutput);

      // Validate sets
      const validPriorities: TaskPriority[] = ['high', 'medium', 'low', 'none'];
      const validStatuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
      const validModes = ['deadline', 'timeBox', 'floating'];
      const validColors = TASK_COLOR_OPTIONS.map((c) => c.value);

      let resolvedDueDate = resolveDate(parsed.dueDate);
      let calculatedStart = parsed.start;

      if (parsed.mode === 'timeBox' && parsed.start) {
        if (parsed.start.includes('tomorrow')) {
          calculatedStart = parsed.start.replace('tomorrow', offsetISO(1));
        } else if (parsed.start.includes('today')) {
          calculatedStart = parsed.start.replace('today', todayISO());
        }
        if (calculatedStart && calculatedStart.length >= 10) {
          resolvedDueDate = calculatedStart.slice(0, 10);
        }
      }

      const result: NlpParsedTask = {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : trimmed,
        description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
        priority: validPriorities.includes(parsed.priority) ? parsed.priority : 'none',
        status: validStatuses.includes(parsed.status) ? parsed.status : 'todo',
        mode: validModes.includes(parsed.mode) ? parsed.mode : 'deadline',
        dueDate: resolvedDueDate,
        dueTime: parsed.dueTime || (parsed.mode === 'timeBox' && calculatedStart ? calculatedStart.slice(11, 16) : null),
        colorTag: validColors.includes(parsed.colorTag) ? parsed.colorTag : 'slate',
        start: calculatedStart,
        duration: Number(parsed.duration) || 0,
      };

      setInput('');
      onParsed(result, trimmed);
    } catch (err) {
      console.error('xAI NLP parse failed:', err);
      setError("Couldn't parse that — opening blank task instead.");

      setTimeout(() => {
        setError(null);
        onParsed({
          title: trimmed,
          description: '',
          priority: 'none',
          status: 'todo',
          mode: 'deadline',
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
        <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400">
          <Sparkles size={15} />
        </div>

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

        <button
          onClick={parse}
          disabled={!input.trim() || loading}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Parse task"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        </button>
      </div>

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
            Describe a task in plain English — AI automatically switches modes, extracts time blocks, and sets priorities.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}