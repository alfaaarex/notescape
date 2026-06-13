'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Flag, Tag, FileText, Loader2 } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  TASK_COLOR_OPTIONS,
} from '@/lib/types';
import type { Note } from '@/lib/storage';

interface TaskEditorModalProps {
  open: boolean;
  task?: Task | null;
  notes: Note[];
  prefillDate?: string;
  onSave: (task: Task) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low', 'none'];
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

export function TaskEditorModal({
  open,
  task,
  notes,
  prefillDate,
  onSave,
  onClose,
}: TaskEditorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [colorTag, setColorTag] = useState('sky');
  const [dueDate, setDueDate] = useState('');
  const [linkedNoteId, setLinkedNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setStatus(task.status);
      setColorTag(task.colorTag);
      setDueDate(task.dueDate ?? '');
      setLinkedNoteId(task.linkedNoteId);
    } else {
      setTitle('');
      setDescription('');
      setPriority('none');
      setStatus('todo');
      setColorTag('sky');
      setDueDate(prefillDate ?? '');
      setLinkedNoteId(null);
    }
  }, [task, open, prefillDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: task?.id ?? crypto.randomUUID(),
        title: title.trim(),
        description,
        priority,
        status,
        colorTag,
        dueDate: dueDate || null,
        linkedNoteId,
        createdAt: task?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      });
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
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 border border-gray-100 dark:border-zinc-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {task ? 'Edit Task' : 'New Task'}
              </h2>
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

              {/* Metadata Row */}
              <div className="grid grid-cols-2 gap-3">
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
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          priority === p
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
