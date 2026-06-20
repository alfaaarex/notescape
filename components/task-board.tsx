'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Trash2,
  Edit3,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { Task, TaskPriority } from '@/lib/types';
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_COLOR_OPTIONS,
} from '@/lib/types';
import { NlpTaskInput, type NlpParsedTask } from '@/components/nlp-task-input';

interface TaskBoardProps {
  tasks: Task[];
  onNewTask: () => void;
  onNlpTask: (parsed: NlpParsedTask, raw: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onUpdateStatus: (id: string, status: Task['status']) => void;
}

type ViewMode = 'board' | 'list';

const STATUS_COLUMNS: Array<{
  id: Task['status'];
  label: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { id: 'todo',        label: 'Todo',        icon: <Circle size={14} />,       color: '#9ca3af' },
  { id: 'in_progress', label: 'In Progress', icon: <Clock size={14} />,        color: '#fb923c' },
  { id: 'done',        label: 'Done',        icon: <CheckCircle2 size={14} />, color: '#4ade80' },
  { id: 'cancelled',   label: 'Cancelled',   icon: <XCircle size={14} />,      color: '#f87171' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      title={`Priority: ${PRIORITY_LABELS[priority]}`}
    />
  );
}

function ColorDot({ colorTag }: { colorTag: string }) {
  const found = TASK_COLOR_OPTIONS.find((c) => c.value === colorTag);
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: found?.hex ?? '#7dd3fc' }}
    />
  );
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const date = new Date(dueDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = date < today;
  const isToday = date.getTime() === today.getTime();
  return (
    <span
      className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
        isOverdue
          ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
          : isToday
          ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
          : 'text-gray-500 bg-gray-100 dark:bg-zinc-800'
      }`}
    >
      <Calendar size={10} />
      {isToday
        ? 'Today'
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
    </span>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onCycleStatus,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onCycleStatus: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const colorHex = TASK_COLOR_OPTIONS.find((c) => c.value === task.colorTag)?.hex ?? '#7dd3fc';

  return (
    <motion.div
      layout
      variants={item}
      className="group relative bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md rounded-xl border border-white/40 dark:border-white/10 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      style={{ borderLeft: `3px solid ${colorHex}` }}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          onClick={onCycleStatus}
          className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {task.status === 'done' ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : task.status === 'in_progress' ? (
            <Clock size={18} className="text-amber-400" />
          ) : task.status === 'cancelled' ? (
            <XCircle size={18} className="text-red-400" />
          ) : (
            <Circle size={18} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug ${
              task.status === 'done' || task.status === 'cancelled'
                ? 'line-through text-gray-400 dark:text-zinc-500'
                : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <PriorityDot priority={task.priority} />
            {task.priority !== 'none' && (
              <span className="text-[11px] font-medium" style={{ color: PRIORITY_COLORS[task.priority] }}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            <DueDateBadge dueDate={task.dueDate} />
          </div>
        </div>

        {/* Context menu — always visible on touch devices */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all
                       opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <MoreHorizontal size={14} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Backdrop to close */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-7 z-20 w-36 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 py-1 overflow-hidden"
                >
                  <button
                    onClick={() => { onEdit(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => { onDelete(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function getNextStatus(current: Task['status']): Task['status'] {
  const cycle: Task['status'][] = ['todo', 'in_progress', 'done'];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
}

export function TaskBoard({
  tasks,
  onNewTask,
  onNlpTask,
  onEditTask,
  onDeleteTask,
  onUpdateStatus,
}: TaskBoardProps) {
  const [view, setView] = useState<ViewMode>('board');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');

  const filtered = filterPriority === 'all'
    ? tasks
    : tasks.filter((t) => t.priority === filterPriority);

  const isEmpty = tasks.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-zinc-800">

        {/* Top row: title + new task */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Tasks</h1>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {tasks.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setView('board')}
                className={`p-1.5 rounded-md transition-all ${view === 'board' ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-800 dark:text-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                aria-label="Board view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-800 dark:text-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                aria-label="List view"
              >
                <List size={14} />
              </button>
            </div>

            <button
              onClick={onNewTask}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs sm:text-sm font-semibold rounded-lg hover:opacity-90 transition-all whitespace-nowrap"
            >
              <Plus size={14} />
              <span className="hidden xs:inline sm:inline">New Task</span>
              <span className="xs:hidden sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* Bottom row: priority filters (scrollable on mobile) */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg p-1 overflow-x-auto scrollbar-none">
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterPriority === p
                  ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              style={filterPriority === p && p !== 'all' ? { color: PRIORITY_COLORS[p] } : {}}
            >
              {p === 'all' ? 'All' : PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── NLP Input ──────────────────────────────────────────────────── */}
      <NlpTaskInput onParsed={onNlpTask} />

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6 py-16">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
            <CheckCircle2 size={26} className="text-gray-300 dark:text-zinc-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300">No tasks yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first task to get started</p>
          </div>
          <button
            onClick={onNewTask}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            <Plus size={15} /> New Task
          </button>
        </div>
      ) : view === 'board' ? (

        /* ── Board View ──────────────────────────────────────────────── */
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-5">
          {/* On mobile: stack columns vertically; on sm+: horizontal scroll row */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:h-full sm:min-w-max">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="w-full sm:w-64 md:w-72 flex flex-col gap-2">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-1 py-1">
                    <span style={{ color: col.color }}>{col.icon}</span>
                    <span className="text-xs font-bold tracking-wider uppercase text-gray-500 dark:text-gray-400">
                      {col.label}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="sm:flex-1 sm:overflow-y-auto pb-2 sm:pb-4 sm:pr-1">
                    <motion.div
                      variants={container}
                      initial="hidden"
                      animate="show"
                      className="flex flex-col gap-2"
                    >
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={() => onEditTask(task)}
                          onDelete={() => onDeleteTask(task.id)}
                          onCycleStatus={() => onUpdateStatus(task.id, getNextStatus(task.status))}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700 p-4 text-center text-xs text-gray-400">
                          No tasks
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (

        /* ── List View ───────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800 rounded-xl border border-white/20 dark:border-white/10 overflow-hidden glass"
          >
            {/* Desktop header row — hidden on mobile */}
            <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              <span>Title</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Due</span>
              <span />
            </div>

            {filtered.map((task) => (
              <motion.div
                key={task.id}
                variants={item}
                className="group px-3 sm:px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* Mobile layout: stacked */}
                <div className="flex items-start gap-2.5 sm:hidden">
                  <ColorDot colorTag={task.colorTag} />
                  <button
                    onClick={() => onUpdateStatus(task.id, getNextStatus(task.status))}
                    className="flex-shrink-0 mt-0.5"
                  >
                    {task.status === 'done' ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : task.status === 'in_progress' ? (
                      <Clock size={16} className="text-amber-400" />
                    ) : task.status === 'cancelled' ? (
                      <XCircle size={16} className="text-red-400" />
                    ) : (
                      <Circle size={16} className="text-gray-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                    >
                      {task.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <PriorityDot priority={task.priority} />
                      {task.priority !== 'none' && (
                        <span className="text-[11px]" style={{ color: PRIORITY_COLORS[task.priority] }}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 dark:text-zinc-500">
                        {STATUS_LABELS[task.status]}
                      </span>
                      <DueDateBadge dueDate={task.dueDate} />
                    </div>
                  </div>
                  {/* Always-visible actions on mobile */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
                      aria-label="Edit"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Desktop layout: grid row */}
                <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <ColorDot colorTag={task.colorTag} />
                    <button
                      onClick={() => onUpdateStatus(task.id, getNextStatus(task.status))}
                      className="flex-shrink-0"
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      ) : (
                        <Circle size={15} className="text-gray-300" />
                      )}
                    </button>
                    <span
                      className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                    >
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PriorityDot priority={task.priority} />
                    <span className="text-xs" style={{ color: PRIORITY_COLORS[task.priority] }}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {STATUS_LABELS[task.status]}
                  </span>
                  <DueDateBadge dueDate={task.dueDate} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
