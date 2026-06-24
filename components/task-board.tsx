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
  { id: 'todo',        label: 'TODO',        icon: <Circle size={14} />,       color: '#9ca3af' },
  { id: 'in_progress', label: 'IN PROGRESS', icon: <Clock size={14} />,        color: '#fb923c' },
  { id: 'done',        label: 'DONE',        icon: <CheckCircle2 size={14} />, color: '#4ade80' },
  { id: 'cancelled',   label: 'CANCELLED',   icon: <XCircle size={14} />,      color: '#f87171' },
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
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 border border-black/20 dark:border-white/20"
      style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      title={`Priority: ${PRIORITY_LABELS[priority]}`}
    />
  );
}

function ColorDot({ colorTag }: { colorTag: string }) {
  const found = TASK_COLOR_OPTIONS.find((c) => c.value === colorTag);
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/20 dark:border-white/20 shadow-inner"
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
      className={`flex items-center gap-1 text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded uppercase border border-border ${
        isOverdue
          ? 'text-destructive bg-destructive/10'
          : isToday
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground te-inset'
      }`}
    >
      <Calendar size={9} />
      {isToday
        ? 'TODAY'
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
      className="group relative te-surface rounded-lg p-3 sm:p-4 shadow-sm hover:te-glow transition-all duration-200 cursor-pointer border-l-4"
      style={{ borderLeftColor: colorHex }}
    >
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onCycleStatus(); }}
          className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {task.status === 'done' ? (
            <CheckCircle2 size={16} className="text-primary" />
          ) : task.status === 'in_progress' ? (
            <Clock size={16} className="text-amber-500" />
          ) : task.status === 'cancelled' ? (
            <XCircle size={16} className="text-destructive" />
          ) : (
            <Circle size={16} />
          )}
        </button>

        <div className="flex-1 min-w-0" onClick={onEdit}>
          <p
            className={`text-sm font-bold font-sans uppercase tracking-wide leading-snug ${
              task.status === 'done' || task.status === 'cancelled'
                ? 'line-through text-muted-foreground opacity-70'
                : 'text-foreground'
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 text-[11px] font-mono text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
          <div className="flex items-center flex-wrap gap-2 mt-3">
            <div className="flex items-center gap-1">
              <PriorityDot priority={task.priority} />
              {task.priority !== 'none' && (
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color: PRIORITY_COLORS[task.priority] }}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              )}
            </div>
            <DueDateBadge dueDate={task.dueDate} />
          </div>
        </div>

        {/* Context menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded te-button text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <MoreHorizontal size={14} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-7 z-20 w-32 te-surface rounded-lg shadow-xl overflow-hidden"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-bold font-mono tracking-widest uppercase text-foreground hover:bg-muted"
                  >
                    <Edit3 size={11} /> EDIT
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-bold font-mono tracking-widest uppercase text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={11} /> DELETE
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
    <div className="flex flex-col h-full overflow-hidden te-noise bg-background">
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-col gap-4 px-4 sm:px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 te-label mb-1">
              <span className="w-2 h-2 rounded-full te-led te-led-on" />
              TASK MANAGER / MODULE 2
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold font-sans tracking-tight uppercase te-emboss">Tasks</h1>
              <div className="bg-primary text-primary-foreground font-mono font-bold text-[10px] px-2 py-0.5 rounded shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                {tasks.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle - Physical Rocker */}
            <div className="flex items-center te-inset rounded-lg p-0.5 font-mono">
              <button
                onClick={() => setView('board')}
                className={`flex items-center justify-center p-1.5 w-8 rounded-md transition-all ${view === 'board' ? 'te-surface text-primary' : 'text-muted-foreground'}`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center justify-center p-1.5 w-8 rounded-md transition-all ${view === 'list' ? 'te-surface text-primary' : 'text-muted-foreground'}`}
              >
                <List size={14} />
              </button>
            </div>

            <button
              onClick={onNewTask}
              className="flex items-center gap-1.5 px-3 py-1.5 te-button-primary text-[10px] font-bold font-mono tracking-widest rounded shadow-sm"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">NEW TASK</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 te-inset rounded-lg p-1 overflow-x-auto scrollbar-none w-fit">
          <span className="text-[9px] font-mono font-bold tracking-widest text-muted-foreground ml-2 mr-1 uppercase">PRIORITY:</span>
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`flex-shrink-0 px-2.5 py-1 text-[9px] font-bold font-mono uppercase tracking-widest rounded transition-all ${
                filterPriority === p
                  ? 'te-surface text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'all' ? 'ALL' : PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── NLP Input ──────────────────────────────────────────────────── */}
      <NlpTaskInput onParsed={onNlpTask} />

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-6 py-16">
          <div className="w-16 h-16 rounded-2xl te-inset flex items-center justify-center shadow-inner border border-border">
            <CheckCircle2 size={24} className="text-muted-foreground opacity-50" />
          </div>
          <div>
            <p className="font-bold font-sans text-xl uppercase te-emboss">No Active Tasks</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">// INITIALIZE NEW TASK SEQUENCE TO BEGIN</p>
          </div>
          <button
            onClick={onNewTask}
            className="flex items-center gap-2 px-4 py-2 te-button-primary text-[10px] font-bold font-mono uppercase tracking-widest mt-2"
          >
            <Plus size={14} /> CREATE TASK
          </button>
        </div>
      ) : view === 'board' ? (
        /* ── Board View ──────────────────────────────────────────────── */
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:h-full sm:min-w-max">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="w-full sm:w-72 md:w-80 flex flex-col gap-3 rounded-xl te-inset p-3 border border-border bg-black/5 dark:bg-white/5">
                  {/* Column header */}
                  <div className="flex items-center gap-2 px-2 py-1 bg-background/50 rounded shadow-sm border border-border/50">
                    <span className="w-2 h-2 rounded-full border border-black/20 dark:border-white/20" style={{ backgroundColor: col.color }} />
                    <span className="text-[10px] font-bold font-mono tracking-widest uppercase text-foreground">
                      {col.label}
                    </span>
                    <span className="ml-auto flex items-center justify-center w-5 h-5 rounded te-inset text-[10px] font-mono font-bold text-muted-foreground bg-background border border-border/50">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="sm:flex-1 sm:overflow-y-auto pb-2 pr-1">
                    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-3">
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
                        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 flex items-center justify-center text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground/60">
                          // EMPTY SLOT
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col rounded-xl te-surface overflow-hidden border border-border divide-y divide-border"
          >
            {/* Desktop header row */}
            <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-muted/50 text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest">
              <span>TASK TITLE</span>
              <span>PRIORITY</span>
              <span>STATUS</span>
              <span>DUE DATE</span>
              <span />
            </div>

            {filtered.map((task) => (
              <motion.div
                key={task.id}
                variants={item}
                className="group px-4 sm:px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                {/* Mobile layout */}
                <div className="flex items-start gap-3 sm:hidden">
                  <ColorDot colorTag={task.colorTag} />
                  <button onClick={() => onUpdateStatus(task.id, getNextStatus(task.status))} className="flex-shrink-0 mt-0.5">
                    {task.status === 'done' ? (
                      <CheckCircle2 size={16} className="text-primary" />
                    ) : task.status === 'in_progress' ? (
                      <Clock size={16} className="text-amber-500" />
                    ) : task.status === 'cancelled' ? (
                      <XCircle size={16} className="text-destructive" />
                    ) : (
                      <Circle size={16} className="text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => onEditTask(task)}>
                    <span className={`text-xs font-bold font-sans uppercase tracking-wide ${task.status === 'done' ? 'line-through text-muted-foreground opacity-60' : 'text-foreground'}`}>
                      {task.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <PriorityDot priority={task.priority} />
                      <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-muted-foreground">{STATUS_LABELS[task.status]}</span>
                      <DueDateBadge dueDate={task.dueDate} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onEditTask(task)} className="p-1.5 rounded te-button text-muted-foreground">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => onDeleteTask(task.id)} className="p-1.5 rounded te-button-destructive text-white">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <ColorDot colorTag={task.colorTag} />
                    <button onClick={() => onUpdateStatus(task.id, getNextStatus(task.status))} className="flex-shrink-0">
                      {task.status === 'done' ? <CheckCircle2 size={14} className="text-primary" /> : <Circle size={14} className="text-muted-foreground" />}
                    </button>
                    <span className={`text-xs font-bold font-sans uppercase tracking-wide truncate ${task.status === 'done' ? 'line-through text-muted-foreground opacity-60' : 'text-foreground'}`}>
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityDot priority={task.priority} />
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: PRIORITY_COLORS[task.priority] }}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-muted-foreground te-inset px-2 py-0.5 rounded w-fit bg-background border-none">
                    {STATUS_LABELS[task.status]}
                  </span>
                  <div>
                    <DueDateBadge dueDate={task.dueDate} />
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button onClick={() => onEditTask(task)} className="p-1 rounded te-button text-muted-foreground hover:text-foreground">
                      <Edit3 size={11} />
                    </button>
                    <button onClick={() => onDeleteTask(task.id)} className="p-1 rounded te-button text-muted-foreground hover:text-destructive">
                      <Trash2 size={11} />
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
