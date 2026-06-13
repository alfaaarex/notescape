'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Flag, Tag, FileText, Loader2, Clock, RotateCw } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  TASK_COLOR_OPTIONS,
} from '@/lib/types';
import type { Note } from '@/lib/storage';
import type { NlpParsedTask } from '@/components/nlp-task-input';

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setStatus(task.status);
      setColorTag(task.colorTag);
      // Determine mode from task
      if (task.mode === 'timeBox') {
        setMode('timeBox');
        // Assuming task.start is ISO datetime string
        if (task.start) {
          const start = new Date(task.start);
          setStartDate(start.toISOString().split('T')[0]);
          setStartTime(start.toTimeString().slice(0, 5));
        }
        setDuration(task.duration ?? 0);
      } else if (task.mode === 'floating') {
        setMode('floating');
        setDueDate(task.dueDate ?? '');
        setDueTime(''); // Floating tasks have no time
      } else {
        // deadline mode
        setMode('deadline');
        setDueDate(task.dueDate ?? '');
        setDueTime(task.dueTime ?? '');
      }
      setLinkedNoteId(task.linkedNoteId);
    } else if (nlpPrefill) {
      setTitle(nlpPrefill.title);
      setDescription(nlpPrefill.description);
      setPriority(nlpPrefill.priority);
      setStatus(nlpPrefill.status);
      setColorTag(nlpPrefill.colorTag);
      // Assume nlpPrefill provides mode? We'll default to deadline
      setMode(nlpPrefill.mode ?? 'deadline');
      if (nlpPrefill.mode === 'timeBox') {
        if (nlpPrefill.start) {
          const start = new Date(nlpPrefill.start);
          setStartDate(start.toISOString().split('T')[0]);
          setStartTime(start.toTimeString().slice(0, 5));
        }
        setDuration(nlpPrefill.duration ?? 0);
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
      const taskData: Task = {
        id: task?.id ?? crypto.randomUUID(),
        title: title.trim(),
        description,
        priority,
        status,
        colorTag,
        mode,
        // Fields based on mode
        ...(mode === 'timeBox' ? {
          start: `${startDate}T${startTime}:00`, // ISO datetime
          duration,
          dueDate: null,
          dueTime: null,
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
      };
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
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {task ? 'Edit Task' : 'New Task'}
                </h2>
                {nlpPrefill && !task && (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 15l-5 3.2 1.9-5.8L4 8.8h6.1z" /></svg>
                    AI filled
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              {/* Title */}
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full text-xl font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none placeholder:text-gray-300 dark:placeholder:text-zinc-600"
              />

              {/* Description */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 rounded-xl p-3 border-none outline-none placeholder:text-gray-300 dark:placeholder:text-zinc-600 resize-none leading-relaxed"
              />

              {/* Mode Selector */}
              <div className="flex gap-4 rounded-lg bg-gray-50 dark:bg-zinc-800/50 p-3">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${mode === m
                      ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-transparent'}`}
                  >
                    {m === 'deadline' && (
                      <>
                        <Calendar size={14} />
                        <span className="hidden sm:inline">Deadline</span>
                      </>
                    )}
                    {m === 'timeBox' && (
                      <>
                        <RotateCw size={14} />
                        <span className="hidden sm:inline">Time Box</span>
                      </>
                    )}
                    {m === 'floating' && (
                      <>
                        <Calendar size={14} />
                        <span className="hidden sm:inline">Floating</span>
                      </>
                    )}
                  </button>
                ))}
              </div>

              {/* Conditional fields based on mode */}
              {mode === 'deadline' && (
                <>
                  {/* Due Date */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <Calendar size={12} />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none"
                    />
                  </div>

                  {/* Due Time */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <Clock size={12} />
                      Due Time
                    </label>
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </>
              )}

              {mode === 'timeBox' && (
                <>
                  {/* Start Date */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <Calendar size={12} />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none"
                    />
                  </div>

                  {/* Start Time */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <Clock size={12} />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <RotateCw size={12} />
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value) || 0)}
                      className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none"
                      min="1"
                      step="15"
                    />
                  </div>
                </>
              )}

              {mode === 'floating' && (
                <>
                  {/* Due Date (no time) */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      <Calendar size={12} />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none"
                    />
                  </div>
                </>
              )}

              {/* Grid 1: Timelines & Status (only for deadline and timeBox? we put status always) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Status */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    <Tag size={12} />
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    <Flag size={12} />
                    Priority
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${priority === p
                          ? 'text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                          }`}
                        style={
                          priority === p
                            ? { backgroundColor: PRIORITY_COLORS[p] }
                            : {}
                        }
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Tag */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: TASK_COLOR_OPTIONS.find((c) => c.value === colorTag)?.hex ?? '#7dd3fc' }} />
                    Color
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {TASK_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColorTag(c.value)}
                        title={c.label}
                        className={`w-6 h-6 rounded-full transition-all ${colorTag === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Link to Note */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  <FileText size={12} />
                  Link to Note
                </label>
                <select
                  value={linkedNoteId ?? ''}
                  onChange={(e) => setLinkedNoteId(e.target.value || null)}
                  className="w-full text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 border-none outline-none"
                >
                  <option value="">None</option>
                  {notes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title || 'Untitled'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || saving}
                  className="flex items-center gap-2 px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {task ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}