'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  LayoutGrid,
  CheckCircle2,
  Clock,
  Circle,
  XCircle,
  CalendarCheck,
  TrendingUp,
} from 'lucide-react';
import type { Task } from '@/lib/types';
import { PRIORITY_COLORS, TASK_COLOR_OPTIONS, STATUS_LABELS } from '@/lib/types';

interface TaskCalendarProps {
  tasks: Task[];
  onNewTask: (date?: string) => void;
  onEditTask: (task: Task) => void;
}

type CalView = 'month' | 'week' | 'agenda';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function getColorHex(task: Task) {
  return TASK_COLOR_OPTIONS.find((c) => c.value === task.colorTag)?.hex ?? PRIORITY_COLORS[task.priority];
}

function StatusIcon({ status }: { status: Task['status'] }) {
  if (status === 'done')        return <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />;
  if (status === 'in_progress') return <Clock size={13} className="text-amber-400 flex-shrink-0" />;
  if (status === 'cancelled')   return <XCircle size={13} className="text-red-400 flex-shrink-0" />;
  return <Circle size={13} className="text-gray-300 flex-shrink-0" />;
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────
function StatsBar({ tasks }: { tasks: Task[] }) {
  const done       = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const overdue    = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done' || t.status === 'cancelled') return false;
    return new Date(t.dueDate + 'T00:00:00') < new Date(new Date().toDateString());
  }).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-zinc-800 overflow-x-auto flex-shrink-0">
      <Stat icon={<CalendarCheck size={14} className="text-emerald-500" />} label="Done"        value={done}       color="text-emerald-600 dark:text-emerald-400" />
      <Stat icon={<Clock size={14} className="text-amber-500" />}          label="In progress"  value={inProgress} color="text-amber-600 dark:text-amber-400" />
      <Stat icon={<TrendingUp size={14} className="text-red-400" />}       label="Overdue"      value={overdue}    color="text-red-600 dark:text-red-400" />
      <Stat icon={<CalendarDays size={14} className="text-gray-400" />}    label="Total"        value={total}      color="text-gray-600 dark:text-gray-400" />
      {total > 0 && (
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{pct}%</span>
          <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {icon}
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-400 dark:text-zinc-500 hidden sm:inline">{label}</span>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({
  year, month, tasks, todayISO, selectedDay,
  onSelectDay, onNewTask, direction,
}: {
  year: number; month: number; tasks: Task[];
  todayISO: string; selectedDay: string | null;
  onSelectDay: (iso: string) => void;
  onNewTask: (iso: string) => void;
  direction: number;
}) {
  const tasksByDate = useMemo(() => tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (t.dueDate) acc[t.dueDate] = [...(acc[t.dueDate] ?? []), t];
    return acc;
  }, {}), [tasks]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={`${year}-${month}`}
        custom={direction}
        initial={{ opacity: 0, x: direction * 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -40 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
      >
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[10px] sm:text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const iso = toISO(year, month, day);
            const dayTasks = tasksByDate[iso] ?? [];
            const isToday    = iso === todayISO;
            const isSelected = selectedDay === iso;
            const hasOverdue = dayTasks.some((t) =>
              t.status !== 'done' && t.status !== 'cancelled' && iso < todayISO
            );

            return (
              <button
                key={iso}
                onClick={() => onSelectDay(iso)}
                className={`group relative flex flex-col items-center rounded-xl p-1 sm:p-1.5 min-h-[52px] sm:min-h-[72px] transition-all duration-150 border ${
                  isSelected
                    ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white shadow-md'
                    : isToday
                    ? 'bg-indigo-50 dark:bg-indigo-900/25 border-indigo-200 dark:border-indigo-700'
                    : hasOverdue
                    ? 'border-red-100 dark:border-red-900/30 hover:bg-red-50/50 dark:hover:bg-red-900/10'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-zinc-800/70'
                }`}
              >
                <span className={`text-[11px] sm:text-xs font-bold w-5 sm:w-6 h-5 sm:h-6 flex items-center justify-center rounded-full ${
                  isSelected ? 'text-white dark:text-gray-900'
                  : isToday  ? 'text-indigo-600 dark:text-indigo-400'
                  :             'text-gray-600 dark:text-gray-400'
                }`}>
                  {day}
                </span>

                {/* Task dots */}
                <div className="flex flex-wrap gap-0.5 justify-center mt-0.5 px-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <span
                      key={t.id}
                      className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getColorHex(t) }}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[8px] sm:text-[9px] text-gray-400 leading-none">+{dayTasks.length - 3}</span>
                  )}
                </div>

                {/* Quick-add on hover (desktop only) */}
                <button
                  onClick={(e) => { e.stopPropagation(); onNewTask(iso); }}
                  className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 transition-all hidden sm:block"
                >
                  <Plus size={9} />
                </button>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({
  year, month, selectedDay, tasks, todayISO, onSelectDay, onNewTask,
}: {
  year: number; month: number; selectedDay: string | null; tasks: Task[];
  todayISO: string; onSelectDay: (iso: string) => void; onNewTask: (iso: string) => void;
}) {
  const tasksByDate = useMemo(() => tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (t.dueDate) acc[t.dueDate] = [...(acc[t.dueDate] ?? []), t];
    return acc;
  }, {}), [tasks]);

  // Find the week containing selectedDay (or today)
  const anchor = selectedDay ?? todayISO;
  const anchorDate = new Date(anchor + 'T00:00:00');
  const startOfWeek = new Date(anchorDate);
  startOfWeek.setDate(anchorDate.getDate() - anchorDate.getDay());

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      iso: toISO(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      dayName: DAYS_LONG[d.getDay()].slice(0, 3),
    };
  });

  return (
    <div className="flex gap-1 sm:gap-2 h-full">
      {weekDays.map(({ iso, day, dayName }) => {
        const dayTasks = tasksByDate[iso] ?? [];
        const isToday    = iso === todayISO;
        const isSelected = selectedDay === iso;
        return (
          <div
            key={iso}
            className={`flex-1 flex flex-col rounded-xl border transition-all ${
              isSelected ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/15' :
              isToday    ? 'border-indigo-200 dark:border-indigo-800' :
                           'border-gray-100 dark:border-zinc-800'
            }`}
          >
            <button
              onClick={() => onSelectDay(iso)}
              className="flex flex-col items-center py-2 sm:py-3"
            >
              <span className="text-[10px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase">{dayName}</span>
              <span className={`mt-0.5 text-sm sm:text-base font-bold ${
                isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'
              }`}>{day}</span>
            </button>
            <div className="flex-1 overflow-y-auto px-1 pb-2 flex flex-col gap-1">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onNewTask(iso)}
                  className="w-full text-left rounded-lg p-1.5 text-[10px] sm:text-xs font-medium leading-tight truncate transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: getColorHex(task) + '33',
                    color: getColorHex(task),
                    borderLeft: `3px solid ${getColorHex(task)}`,
                  }}
                >
                  {task.title}
                </button>
              ))}
              <button
                onClick={() => onNewTask(iso)}
                className="w-full rounded-lg p-1.5 text-[10px] text-gray-300 dark:text-zinc-600 hover:text-gray-500 dark:hover:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Agenda View ──────────────────────────────────────────────────────────────
function AgendaView({ tasks, onEditTask, onNewTask }: {
  tasks: Task[];
  onEditTask: (t: Task) => void;
  onNewTask: (date?: string) => void;
}) {
  const now = new Date();
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate());

  // Group by date, sorted
  const grouped = useMemo(() => {
    const withDate = tasks
      .filter((t) => t.dueDate)
      .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1));
    const map: Record<string, Task[]> = {};
    withDate.forEach((t) => {
      map[t.dueDate!] = [...(map[t.dueDate!] ?? []), t];
    });
    const noDate = tasks.filter((t) => !t.dueDate);
    return { map, noDate, dates: Object.keys(map).sort() };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
        <CalendarDays size={32} className="text-gray-200 dark:text-zinc-700" />
        <p className="text-sm font-medium text-gray-400">No tasks scheduled</p>
        <button onClick={() => onNewTask()} className="text-xs text-indigo-500 hover:underline">Create your first task</button>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pb-8">
      {grouped.dates.map((iso) => {
        const d = new Date(iso + 'T00:00:00');
        const isToday = iso === todayISO;
        const isPast  = iso < todayISO;
        return (
          <div key={iso} className="mb-2">
            <div className={`sticky top-0 flex items-center gap-3 px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-widest z-10 ${
              isToday
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/20 backdrop-blur-sm'
                : isPast
                ? 'text-red-400 bg-red-50/60 dark:bg-red-900/10 backdrop-blur-sm'
                : 'text-gray-500 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm'
            }`}>
              <span>{isToday ? 'Today · ' : ''}{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="ml-auto font-normal normal-case text-gray-400 dark:text-zinc-500">{grouped.map[iso].length} task{grouped.map[iso].length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-col divide-y divide-gray-50 dark:divide-zinc-800/50">
              {grouped.map[iso].map((task) => (
                <button
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className="flex items-center gap-3 px-4 sm:px-6 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group"
                >
                  <StatusIcon status={task.status} />
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getColorHex(task) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 flex-shrink-0">
                    {STATUS_LABELS[task.status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {grouped.noDate.length > 0 && (
        <div className="mt-4">
          <div className="px-4 sm:px-6 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-zinc-800">
            No due date
          </div>
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-zinc-800/50">
            {grouped.noDate.map((task) => (
              <button
                key={task.id}
                onClick={() => onEditTask(task)}
                className="flex items-center gap-3 px-4 sm:px-6 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <StatusIcon status={task.status} />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getColorHex(task) }} />
                <p className={`text-sm font-medium flex-1 truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  {task.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayPanel({
  selectedDay, tasksByDate, onNewTask, onEditTask, todayISO,
}: {
  selectedDay: string;
  tasksByDate: Record<string, Task[]>;
  onNewTask: (iso: string) => void;
  onEditTask: (t: Task) => void;
  todayISO: string;
}) {
  const selectedTasks = tasksByDate[selectedDay] ?? [];
  const d = new Date(selectedDay + 'T00:00:00');
  const isToday = selectedDay === todayISO;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 272, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="border-l border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col flex-shrink-0"
    >
      <div className="min-w-[272px] h-full flex flex-col p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">
              {DAYS_LONG[d.getDay()]}
            </p>
            <h3 className={`text-2xl font-black leading-none ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {d.getDate()}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {MONTHS[d.getMonth()]} {d.getFullYear()}
            </p>
          </div>
          <button
            onClick={() => onNewTask(selectedDay)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {selectedTasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
              <CalendarDays size={18} className="text-gray-300 dark:text-zinc-600" />
            </div>
            <p className="text-xs text-gray-400">Nothing due</p>
            <button
              onClick={() => onNewTask(selectedDay)}
              className="text-xs text-indigo-500 hover:underline"
            >
              Add a task
            </button>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-2 overflow-y-auto flex-1"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          >
            {selectedTasks.map((task) => {
              const hex = getColorHex(task);
              return (
                <motion.button
                  key={task.id}
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                  onClick={() => onEditTask(task)}
                  className="text-left flex items-start gap-2.5 p-3 rounded-xl transition-colors hover:opacity-90 group"
                  style={{ backgroundColor: hex + '18', borderLeft: `3px solid ${hex}` }}
                >
                  <StatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-snug ${task.status === 'done' ? 'line-through opacity-50' : 'text-gray-800 dark:text-gray-200'}`}>
                      {task.title}
                    </p>
                    {task.priority !== 'none' && (
                      <p className="text-[10px] mt-0.5 font-medium capitalize" style={{ color: PRIORITY_COLORS[task.priority] }}>
                        {task.priority} priority
                      </p>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function TaskCalendar({ tasks, onNewTask, onEditTask }: TaskCalendarProps) {
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calView, setCalView]   = useState<CalView>('month');
  const [direction, setDirection] = useState(1);

  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate());

  const prevMonth = () => {
    setDirection(-1);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setDirection(1);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const goToToday = () => {
    setDirection(0);
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(todayISO);
  };

  const tasksByDate = useMemo(() => tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (t.dueDate) acc[t.dueDate] = [...(acc[t.dueDate] ?? []), t];
    return acc;
  }, {}), [tasks]);

  const VIEW_ICONS: Record<CalView, React.ReactNode> = {
    month:  <LayoutGrid size={14} />,
    week:   <CalendarDays size={14} />,
    agenda: <List size={14} />,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-900">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-zinc-800">
        {/* Nav */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <motion.h2
            key={`${year}-${month}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight min-w-[140px] text-center"
          >
            {MONTHS[month]} {year}
          </motion.h2>
          <button
            onClick={nextMonth}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Today button */}
        <button
          onClick={goToToday}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-zinc-700"
        >
          Today
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-1 gap-0.5">
          {(['month', 'week', 'agenda'] as CalView[]).map((v) => (
            <button
              key={v}
              onClick={() => setCalView(v)}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                calView === v
                  ? 'bg-white dark:bg-zinc-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {VIEW_ICONS[v]}
              <span className="hidden sm:inline">{v}</span>
            </button>
          ))}
        </div>

        {/* New Task */}
        <button
          onClick={() => onNewTask()}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs sm:text-sm font-semibold rounded-lg hover:opacity-90 transition-all"
        >
          <Plus size={14} /> <span className="hidden sm:inline">New Task</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <StatsBar tasks={tasks} />

      {/* ── Main Calendar Area ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {calView === 'month' && (
            <MonthView
              year={year} month={month} tasks={tasks}
              todayISO={todayISO} selectedDay={selectedDay}
              onSelectDay={(iso) => setSelectedDay(selectedDay === iso ? null : iso)}
              onNewTask={onNewTask}
              direction={direction}
            />
          )}
          {calView === 'week' && (
            <div className="h-full">
              <WeekView
                year={year} month={month}
                selectedDay={selectedDay} tasks={tasks}
                todayISO={todayISO}
                onSelectDay={(iso) => setSelectedDay(iso)}
                onNewTask={onNewTask}
              />
            </div>
          )}
          {calView === 'agenda' && (
            <AgendaView tasks={tasks} onEditTask={onEditTask} onNewTask={onNewTask} />
          )}
        </div>

        {/* ── Day Detail Panel (month + week view only, desktop) ─── */}
        <AnimatePresence>
          {selectedDay && calView !== 'agenda' && (
            <DayPanel
              key="day-panel"
              selectedDay={selectedDay}
              tasksByDate={tasksByDate}
              onNewTask={onNewTask}
              onEditTask={onEditTask}
              todayISO={todayISO}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile: Tap-to-view tasks bottom sheet ─────────────────── */}
      <AnimatePresence>
        {selectedDay && calView === 'month' && (
          <motion.div
            key="mobile-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl border-t border-gray-100 dark:border-zinc-800 max-h-[60vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center py-3 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-zinc-700" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}
                </p>
                <p className="text-lg font-black text-gray-900 dark:text-gray-100 leading-tight">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onNewTask(selectedDay)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold"
                >
                  <Plus size={12} /> Add
                </button>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-500"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-y-auto px-4 pb-6 flex flex-col gap-2">
              {(tasksByDate[selectedDay] ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No tasks for this day</p>
              ) : (
                (tasksByDate[selectedDay] ?? []).map((task) => {
                  const hex = getColorHex(task);
                  return (
                    <button
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className="text-left flex items-center gap-3 p-3.5 rounded-2xl"
                      style={{ backgroundColor: hex + '18', borderLeft: `3px solid ${hex}` }}
                    >
                      <StatusIcon status={task.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                        {task.description && <p className="text-xs text-gray-500 truncate">{task.description}</p>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
