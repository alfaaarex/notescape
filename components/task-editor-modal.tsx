'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Flag, Tag, FileText, Loader2, Clock, RotateCw } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus, RecurrenceRule } from '@/lib/types';
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  TASK_COLOR_OPTIONS,
} from '@/lib/types';
import type { Note } from '@/lib/storage';
import type { NlpParsedTask } from '@/components/nlp-task-input';
import { recurrenceLabel } from '@/lib/regex-parser';

interface TaskEditorModalProps {
  open: boolean;
  task?: Task | null;
  notes: Note[];
  prefillDate?: string;
  nlpPrefill?: NlpParsedTask | null;
  onSave: (task: Task) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low', 'none'];
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
const MODES: ('deadline' | 'timeBox' | 'floating')[] = ['deadline', 'timeBox', 'floating'];

export function TaskEditorModal({
  open,
  task,
  notes,
  prefillDate,
  nlpPrefill,
  onSave,
  onClose,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [colorTag, setColorTag] = useState('sky');
  const [dueDate, setDueDate] = useState(''); // For deadline and floating
  const [dueTime, setDueTime] = useState(''); // For deadline only
  const [mode, setMode] = useState<'deadline' | 'timeBox' | 'floating'>('deadline');
  // Time Box fields
  const [startDate, setStartDate] = useState(''); // ISO date
  const [startTime, setStartTime] = useState(''); // HH:mm
  const [duration, setDuration] = useState(0); // in minutes
  const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setStatus(task.status);
      setColorTag(task.colorTag);

      if (task.mode === 'timeBox') {
        setMode('timeBox');
        const rawStart = (task as any).start;
        if (rawStart) {
          const start = new Date(rawStart);
          setStartDate(start.toISOString().split('T')[0]);
          setStartTime(start.toTimeString().slice(0, 5));
        }
        setDuration((task as any).duration ?? 0);
      } else if (task.mode === 'floating') {
        setMode('floating');
        setDueDate(task.dueDate ?? '');
        setDueTime('');
      } else {
        setMode('deadline');
        setDueDate(task.dueDate ?? '');
        setDueTime(task.dueTime ?? '');
      }
      setLinkedNoteId(task.linkedNoteId);
      setRecurrence((task as any).recurrence ?? null);
    } else if (nlpPrefill) {
      setTitle(nlpPrefill.title);
      setDescription(nlpPrefill.description);
      setPriority(nlpPrefill.priority);
      setStatus(nlpPrefill.status);
      setColorTag(nlpPrefill.colorTag);

      setMode(nlpPrefill.mode ?? 'deadline');
      if (nlpPrefill.mode === 'timeBox') {
        const rawStart = (nlpPrefill as any).start;
        if (rawStart) {
          const start = new Date(rawStart);
          setStartDate(start.toISOString().split('T')[0]);
          setStartTime(start.toTimeString().slice(0, 5));
        }
        setDuration((nlpPrefill as any).duration ?? 0);
        setDueDate('');
        setDueTime('');
      } else if (nlpPrefill.mode === 'floating') {
        setMode('floating');
        setDueDate(nlpPrefill.dueDate ?? '');
        setDueTime('');
      } else {
        setMode('deadline');
        setDueDate(nlpPrefill.dueDate ?? '');
        setDueTime(nlpPrefill.dueTime ?? '');
      }
      setLinkedNoteId(null);
      setRecurrence((nlpPrefill as any).recurrence ?? null);
    } else {
      setTitle('');
      setDescription('');
      setPriority('none');
      setStatus('todo');
      setColorTag('sky');
      setMode('deadline');
      setDueDate(prefillDate ?? '');
      setDueTime('');
      setStartDate('');
      setStartTime('');
      setDuration(0);
      setLinkedNoteId(null);
    }
  }, [task, nlpPrefill, open, prefillDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const taskData = {
        id: task?.id ?? crypto.randomUUID(),
        title: title.trim(),
        description,
        priority,
        status,
        colorTag,
        mode,
        ...(mode === 'timeBox' ? {
          start: `${startDate}T${startTime}:00`,
          duration,
          dueDate: startDate || null,
          dueTime: startTime || null,
        } : mode === 'floating' ? {
          start: null,
          duration: 0,
          dueDate: dueDate || null,
          dueTime: null,
        } : {
          start: null,
          duration: 0,
          dueDate: dueDate || null,
          dueTime: dueTime || null,
        }),
        linkedNoteId,
        createdAt: task?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      } as Task & { start: string | null; duration: number };

      await onSave(taskData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md te-noise"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl te-surface shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full te-led te-led-on" />
                <h2 className="text-xl font-sans font-black uppercase tracking-tight text-foreground te-emboss">
                  {task ? 'EDIT TASK CONFIG' : 'INITIALIZE TASK'}
                </h2>
                {nlpPrefill && !task && (
                  <span className="flex items-center gap-1.5 rounded te-inset px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest text-primary border border-primary/30">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 15l-5 3.2 1.9-5.8L4 8.8h6.1z" /></svg>
                    AUTO-FILLED
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded te-button text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <label className="te-label">TASK NOMENCLATURE</label>
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ENTER TASK TITLE..."
                  className="w-full text-lg font-sans font-bold uppercase tracking-wide text-foreground te-inset rounded-lg p-3 placeholder:text-muted-foreground/50 border-none outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="te-label">PARAMETERS / NOTES</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ADDITIONAL PARAMETERS..."
                  rows={3}
                  className="w-full text-xs font-mono text-muted-foreground te-inset rounded-lg p-3 placeholder:text-muted-foreground/40 border-none outline-none resize-none leading-relaxed focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Mode Selector - TE Rocker Style */}
              <div className="flex flex-col gap-1">
                <label className="te-label">OPERATIONAL MODE</label>
                <div className="flex gap-2 te-inset rounded-lg p-1">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${mode === m
                        ? 'te-surface text-primary shadow-sm border border-border'
                        : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {m === 'deadline' && <><Calendar size={12} /> <span className="hidden sm:inline">DEADLINE</span></>}
                      {m === 'timeBox' && <><RotateCw size={12} /> <span className="hidden sm:inline">TIME BOX</span></>}
                      {m === 'floating' && <><Calendar size={12} /> <span className="hidden sm:inline">FLOATING</span></>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional fields based on mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mode === 'deadline' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="te-label"><Calendar size={10} className="inline mr-1" /> DUE DATE</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-xs font-mono font-bold te-inset text-foreground rounded-lg p-2.5 border-none outline-none uppercase [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="te-label"><Clock size={10} className="inline mr-1" /> DUE TIME</label>
                      <input
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="w-full text-xs font-mono font-bold te-inset text-foreground rounded-lg p-2.5 border-none outline-none uppercase [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  </>
                )}

                {mode === 'timeBox' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="te-label"><Calendar size={10} className="inline mr-1" /> START DATE</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs font-mono font-bold te-inset text-foreground rounded-lg p-2.5 border-none outline-none uppercase [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="te-label"><Clock size={10} className="inline mr-1" /> START TIME</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full text-xs font-mono font-bold te-inset text-foreground rounded-lg p-2.5 border-none outline-none uppercase [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="te-label"><RotateCw size={10} className="inline mr-1" /> DURATION (MINUTES)</label>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value) || 0)}
                        className="w-full text-xs font-mono font-bold te-inset text-foreground rounded-lg p-2.5 border-none outline-none"
                        min="1"
                        step="15"
                      />
                    </div>
                  </>
                )}

                {mode === 'floating' && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="te-label"><Calendar size={10} className="inline mr-1" /> DUE DATE (OPTIONAL)</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-xs font-mono font-bold te-inset text-foreground rounded-lg p-2.5 border-none outline-none uppercase [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                )}
              </div>

              {/* Grid: Status, Priority, Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-border border-dashed">
                <div className="flex flex-col gap-2">
                  <label className="te-label"><Tag size={10} className="inline mr-1" /> STATUS</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full text-[10px] font-mono font-bold uppercase tracking-widest te-inset text-foreground rounded-lg p-2.5 border-none outline-none cursor-pointer"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="te-label"><Flag size={10} className="inline mr-1" /> PRIORITY</label>
                  <div className="flex flex-wrap gap-1">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 min-w-[60px] py-2 rounded text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${priority === p
                          ? 'shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] border border-black/20 text-white'
                          : 'te-inset text-muted-foreground hover:bg-muted'
                          }`}
                        style={priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : {}}
                      >
                        {p === 'none' ? 'NONE' : PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="te-label flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full border border-border" style={{ backgroundColor: TASK_COLOR_OPTIONS.find((c) => c.value === colorTag)?.hex ?? '#7dd3fc' }} />
                    ASSIGN COLOR
                  </label>
                  <div className="flex gap-1.5 flex-wrap te-inset p-2 rounded-lg justify-center">
                    {TASK_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColorTag(c.value)}
                        title={c.label}
                        className={`w-5 h-5 rounded transition-all border border-black/20 dark:border-white/20 shadow-inner ${colorTag === c.value ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Link Note */}
              <div className="flex flex-col gap-1 border-t border-border border-dashed pt-4">
                <label className="te-label"><FileText size={10} className="inline mr-1" /> ATTACHED NOTE</label>
                <select
                  value={linkedNoteId ?? ''}
                  onChange={(e) => setLinkedNoteId(e.target.value || null)}
                  className="w-full text-xs font-mono font-bold uppercase te-inset text-foreground rounded-lg p-3 border-none outline-none cursor-pointer"
                >
                  <option value="">// NO NOTE ATTACHED</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title.toUpperCase() || 'UNTITLED NOTE'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 te-button text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground rounded"
                >
                  ABORT
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || saving}
                  className="flex items-center gap-2 px-6 py-2 te-button-primary text-[10px] font-mono font-bold uppercase tracking-widest rounded disabled:opacity-40"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  {task ? 'UPDATE CONFIG' : 'EXECUTE'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}