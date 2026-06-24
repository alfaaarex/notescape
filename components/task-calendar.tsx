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
  RotateCw,
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
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
const DAYS_LONG = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const DAYS_SHORT = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function getColorHex(task: Task) {
  return TASK_COLOR_OPTIONS.find((c) => c.value === task.colorTag)?.hex ?? PRIORITY_COLORS[task.priority];
}

function getDeadlineColor(task: Task): string {
  if (task.mode !== 'deadline' || !task.dueDate) return getColorHex(task);

  const dueDateTime = task.dueTime
    ? new Date(`${task.dueDate}T${task.dueTime}:00`)
    : new Date(`${task.dueDate}T00:00:00`);

  const now = new Date();
  const diffMs = dueDateTime.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return '#ef4444'; // Overdue
  if (diffHours < 1) return '#f97316'; // < 1 hr
  if (diffHours < 24) return '#eab308'; // < 24 hrs
  return '#10b981'; // > 24 hrs
}

function StatusIcon({ status }: { status: Task['status'] }) {
  if (status === 'done') return <CheckCircle2 size={13} className="text-primary flex-shrink-0" />;
  if (status === 'in_progress') return <Clock size={13} className="text-amber-500 flex-shrink-0" />;
  if (status === 'cancelled') return <XCircle size={13} className="text-destructive flex-shrink-0" />;
  return <Circle size={13} className="text-muted-foreground flex-shrink-0" />;
}

function StatsBar({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const overdue = tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done' || t.status === 'cancelled') return false;
    const checkTime = t.dueTime ? `T${t.dueTime}:00` : 'T23:59:59';
    return new Date(t.dueDate + checkTime) < new Date();
  }).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 sm:gap-6 px-4 sm:px-6 py-3 border-b border-border te-inset rounded-none flex-shrink-0">
      <Stat icon={<CalendarCheck size={14} className="text-primary" />} label="DONE" value={done} />
      <Stat icon={<Clock size={14} className="text-amber-500" />} label="ACTIVE" value={inProgress} />
      <Stat icon={<TrendingUp size={14} className="text-destructive" />} label="OVERDUE" value={overdue} />
      <Stat icon={<CalendarDays size={14} className="text-muted-foreground" />} label="TOTAL" value={total} />
      {total > 0 && (
        <div className="ml-auto flex items-center gap-3 flex-shrink-0 bg-background border border-border px-3 py-1.5 rounded-lg shadow-inner">
          <span className="text-[10px] font-mono font-bold tracking-widest text-primary">{pct}%</span>
          <div className="w-24 h-1.5 rounded-full te-inset overflow-hidden bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary shadow-[0_0_5px_rgba(255,107,53,0.8)]"
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0 te-surface px-2 py-1 rounded border border-border">
      {icon}
      <span className="text-xs font-mono font-bold text-foreground mx-1">{value}</span>
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground hidden sm:inline">{label}</span>
    </div>
  );
}

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
  const firstDay = getFirstDayOfMonth(year, month);

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
        <div className="grid grid-cols-7 mb-2">
          {DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-muted-foreground uppercase py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="te-inset opacity-30 rounded-xl" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const iso = toISO(year, month, day);
            const dayTasks = tasksByDate[iso] ?? [];
            const isToday = iso === todayISO;
            const isSelected = selectedDay === iso;
            const hasOverdue = dayTasks.some((t) => t.status !== 'done' && t.status !== 'cancelled' && iso < todayISO);

            return (
              <button
                key={iso}
                onClick={() => onSelectDay(iso)}
                className={`group relative flex flex-col items-center rounded-xl p-1 sm:p-2 min-h-[64px] sm:min-h-[84px] transition-all duration-150 border-2 ${isSelected
                  ? 'te-surface border-primary shadow-[inset_0_0_0_2px_var(--primary),0_4px_12px_rgba(0,0,0,0.1)]'
                  : isToday
                    ? 'te-surface border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]'
                    : hasOverdue
                      ? 'te-inset border-destructive/50 hover:border-destructive'
                      : 'te-inset border-transparent hover:te-glow'
                  }`}
              >
                <span className={`text-[11px] sm:text-xs font-sans font-bold w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center rounded-full ${isSelected ? 'bg-primary text-primary-foreground'
                  : isToday ? 'bg-foreground text-background'
                    : 'text-foreground'
                  }`}>
                  {day}
                </span>

                <div className="flex flex-wrap gap-1 justify-center mt-1 px-1">
                  {dayTasks.slice(0, 3).map((t, index) => {
                    let bgColor = getColorHex(t);
                    if (t.mode === 'deadline') bgColor = getDeadlineColor(t);
                    else if (t.mode === 'timeBox') bgColor = '#8b5cf6';
                    else if (t.mode === 'floating') bgColor = '#6366f1';

                    return (
                      <span
                        key={`${t.id}-${index}`}
                        className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[2px] flex-shrink-0 border border-black/20 dark:border-white/20 shadow-inner"
                        style={{ backgroundColor: bgColor }}
                      />
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] font-mono font-bold text-muted-foreground ml-0.5">+{dayTasks.length - 3}</span>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onNewTask(iso); }}
                  className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-md te-button text-muted-foreground transition-all hidden sm:block"
                >
                  <Plus size={10} />
                </button>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

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
      dayName: DAYS_SHORT[d.getDay()],
    };
  });

  return (
    <div className="flex gap-2 sm:gap-3 h-full">
      {weekDays.map(({ iso, day, dayName }) => {
        const dayTasks = tasksByDate[iso] ?? [];
        const isToday = iso === todayISO;
        const isSelected = selectedDay === iso;
        return (
          <div
            key={iso}
            className={`flex-1 flex flex-col rounded-xl border-2 transition-all ${isSelected ? 'te-surface border-primary' :
              isToday ? 'te-surface border-foreground' :
                'te-inset border-transparent'
              }`}
          >
            <button
              onClick={() => onSelectDay(iso)}
              className="flex flex-col items-center py-3 border-b border-border bg-black/5 dark:bg-white/5"
            >
              <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">{dayName}</span>
              <span className={`mt-1 text-sm sm:text-lg font-sans font-black ${isToday || isSelected ? 'text-primary' : 'text-foreground'
                }`}>{day}</span>
            </button>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
              {dayTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onNewTask(iso)}
                  className="w-full text-left rounded-md p-2 text-[10px] sm:text-xs font-mono font-bold leading-tight truncate transition-colors hover:opacity-80 border border-black/10 dark:border-white/10"
                  style={{
                    backgroundColor: getColorHex(task) + '22',
                    color: getColorHex(task),
                    borderLeft: `3px solid ${getColorHex(task)}`,
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="truncate uppercase">{task.title}</span>
                    {task.dueTime && (
                      <span className="text-[8px] font-bold opacity-75 flex items-center gap-1">
                        <Clock size={9} /> {task.dueTime}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => onNewTask(iso)}
                className="w-full rounded-md p-2 text-[10px] font-mono font-bold tracking-widest text-muted-foreground te-button flex items-center justify-center gap-1.5"
              >
                <Plus size={10} /> ADD
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaView({ tasks, onEditTask, onNewTask }: {
  tasks: Task[];
  onEditTask: (t: Task) => void;
  onNewTask: (date?: string) => void;
}) {
  const now = new Date();
  const todayISO = toISO(now.getFullYear(), now.getMonth(), now.getDate());

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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16 te-noise">
        <div className="w-16 h-16 rounded-2xl te-inset border border-border shadow-inner flex items-center justify-center">
          <List size={24} className="text-muted-foreground opacity-50" />
        </div>
        <div>
          <p className="font-bold font-sans text-xl uppercase te-emboss">NO TASKS SCHEDULED</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">// AGENDA EMPTY</p>
        </div>
        <button onClick={() => onNewTask()} className="te-button-primary px-4 py-2 mt-2 rounded text-[10px] font-mono font-bold uppercase">CREATE TASK</button>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pb-8 pr-2">
      {grouped.dates.map((iso) => {
        const d = new Date(iso + 'T00:00:00');
        const isToday = iso === todayISO;
        const isPast = iso < todayISO;
        return (
          <div key={iso} className="mb-4">
            <div className={`sticky top-0 flex items-center gap-3 px-4 sm:px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-widest z-10 te-surface border-y border-border shadow-sm mb-2 ${isToday
              ? 'text-primary'
              : isPast
                ? 'text-destructive'
                : 'text-foreground'
              }`}>
              <span className="flex items-center gap-2">
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                {isToday ? 'TODAY / ' : ''}{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="ml-auto flex items-center justify-center w-5 h-5 rounded te-inset text-[9px] font-bold text-muted-foreground bg-background border border-border/50">
                {grouped.map[iso].length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {grouped.map[iso].map((task) => (
                <button
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className="flex items-center gap-3 px-4 py-3 text-left te-surface rounded-lg hover:te-glow transition-all group border border-border"
                >
                  <StatusIcon status={task.status} />
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/20 dark:border-white/20 shadow-inner"
                    style={{ backgroundColor: getColorHex(task) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold font-sans uppercase tracking-wide truncate ${task.status === 'done' ? 'line-through text-muted-foreground opacity-60' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.dueTime && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded te-inset text-muted-foreground bg-background">
                          <Clock size={9} />
                          {task.dueTime}
                        </span>
                      )}
                      {task.description && (
                        <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">{task.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-muted-foreground flex-shrink-0 te-inset px-2 py-1 rounded bg-background border-none">
                    {STATUS_LABELS[task.status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {grouped.noDate.length > 0 && (
        <div className="mt-6">
          <div className="sticky top-0 flex items-center gap-3 px-4 sm:px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-widest z-10 te-surface border-y border-border shadow-sm mb-2 text-muted-foreground">
            <span>NO DUE DATE</span>
            <span className="ml-auto flex items-center justify-center w-5 h-5 rounded te-inset text-[9px] font-bold text-muted-foreground bg-background border border-border/50">
              {grouped.noDate.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {grouped.noDate.map((task) => (
              <button
                key={task.id}
                onClick={() => onEditTask(task)}
                className="flex items-center gap-3 px-4 py-3 text-left te-surface rounded-lg hover:te-glow transition-all group border border-border"
              >
                <StatusIcon status={task.status} />
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/20 dark:border-white/20 shadow-inner" style={{ backgroundColor: getColorHex(task) }} />
                <p className={`text-xs font-bold font-sans uppercase tracking-wide flex-1 truncate ${task.status === 'done' ? 'line-through text-muted-foreground opacity-60' : 'text-foreground'}`}>
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
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="border-l border-border bg-background te-noise overflow-y-auto flex flex-col flex-shrink-0"
    >
      <div className="min-w-[320px] h-full flex flex-col p-5">
        <div className="flex flex-col mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 te-label mb-2">
              <span className={`w-2 h-2 rounded-full te-led ${isToday ? 'te-led-on bg-primary' : 'te-led-off'}`} />
              {isToday ? 'TODAY' : 'DATE SELECTED'}
            </div>
            <button
              onClick={() => onNewTask(selectedDay)}
              className="te-button px-2 py-1 rounded text-[9px] font-mono font-bold tracking-widest text-foreground flex items-center gap-1 uppercase"
            >
              <Plus size={10} /> ADD
            </button>
          </div>
          <h3 className={`text-5xl font-sans font-black tracking-tighter uppercase te-emboss ${isToday ? 'text-primary' : 'text-foreground'}`}>
            {d.getDate()} <span className="text-2xl text-muted-foreground">{MONTHS[d.getMonth()]}</span>
          </h3>
          <p className="text-[10px] font-mono font-bold text-muted-foreground mt-1 uppercase tracking-widest">
            {DAYS_LONG[d.getDay()]} {d.getFullYear()}
          </p>
        </div>

        {selectedTasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center opacity-50">
            <div className="w-12 h-12 rounded-xl te-inset border border-border shadow-inner flex items-center justify-center">
              <CalendarDays size={20} className="text-muted-foreground" />
            </div>
            <p className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">// NO TASKS SCHEDULED</p>
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          >
            {selectedTasks.map((task) => {
              const hex = getColorHex(task);
              let bgColor = hex + '1A';
              let borderColor = `3px solid ${hex}`;
              if (task.mode === 'deadline') {
                bgColor = getDeadlineColor(task) + '1A';
                borderColor = `3px solid ${getDeadlineColor(task)}`;
              } else if (task.mode === 'timeBox') {
                bgColor = '#8b5cf61A';
                borderColor = '3px solid #8b5cf6';
              } else if (task.mode === 'floating') {
                bgColor = '#6366f11A';
                borderColor = '3px solid #6366f1';
              }
              return (
                <motion.button
                  key={task.id}
                  variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}
                  onClick={() => onEditTask(task)}
                  className="text-left flex items-start gap-3 p-4 rounded-xl transition-all hover:opacity-80 group border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: bgColor, borderLeft: borderColor }}
                >
                  <StatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold font-sans uppercase tracking-wide leading-snug ${task.status === 'done' ? 'line-through opacity-50' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      {task.dueTime && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-widest text-foreground bg-background/50 px-1.5 py-0.5 rounded shadow-sm border border-border/50">
                          <Clock size={9} />
                          {task.dueTime}
                        </span>
                      )}
                      {task.priority !== 'none' && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-background/50 border border-border/50" style={{ color: PRIORITY_COLORS[task.priority] }}>
                          {task.priority}
                        </span>
                      )}
                    </div>
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

export function TaskCalendar({ tasks, onNewTask, onEditTask }: TaskCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calView, setCalView] = useState<CalView>('month');
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
    month: <LayoutGrid size={13} />,
    week: <CalendarDays size={13} />,
    agenda: <List size={13} />,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden te-noise bg-background">
      <div className="flex-shrink-0 flex flex-col gap-4 px-4 sm:px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 te-label mb-1">
              <span className="w-2 h-2 rounded-full te-led te-led-on" />
              CALENDAR / MODULE 3
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 te-inset p-1 rounded-lg">
                <button onClick={prevMonth} className="p-1 rounded te-button text-muted-foreground hover:text-foreground">
                  <ChevronLeft size={16} />
                </button>
                <div className="w-28 text-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={`${year}-${month}`}
                      initial={{ opacity: 0, y: direction * -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: direction * 10 }}
                      transition={{ duration: 0.15 }}
                      className="text-lg font-sans font-black uppercase tracking-tight text-foreground te-emboss leading-none py-1"
                    >
                      {MONTHS[month]} <span className="text-muted-foreground ml-1">{year}</span>
                    </motion.h2>
                  </AnimatePresence>
                </div>
                <button onClick={nextMonth} className="p-1 rounded te-button text-muted-foreground hover:text-foreground">
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-widest te-button text-muted-foreground"
              >
                TODAY
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center te-inset rounded-lg p-0.5 font-mono">
              {(['month', 'week', 'agenda'] as CalView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 w-auto rounded-md transition-all ${calView === v ? 'te-surface text-primary' : 'text-muted-foreground'}`}
                >
                  {VIEW_ICONS[v]}
                  <span className="hidden sm:inline text-[9px] font-bold tracking-widest uppercase">{v}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => onNewTask()}
              className="flex items-center gap-1.5 px-3 py-1.5 te-button-primary text-[10px] font-bold font-mono tracking-widest rounded shadow-sm"
            >
              <Plus size={14} /> <span className="hidden sm:inline">NEW TASK</span>
            </button>
          </div>
        </div>
      </div>

      <StatsBar tasks={tasks} />

      <div className="flex flex-1 overflow-hidden relative z-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6">
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
            <div className="h-full min-h-[400px]">
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

      {/* ── Mobile View Sheets Panel ── */}
      <AnimatePresence>
        {selectedDay && calView === 'month' && (
          <motion.div
            key="mobile-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="sm:hidden fixed bottom-0 left-0 right-0 z-50 te-surface rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] border-t border-border max-h-[70vh] flex flex-col"
          >
            <div className="flex justify-center py-4 flex-shrink-0">
              <div className="w-12 h-1.5 rounded-full te-inset shadow-inner" />
            </div>
            <div className="flex items-center justify-between px-6 pb-4 flex-shrink-0 border-b border-border">
              <div>
                <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}
                </p>
                <p className="text-3xl font-sans font-black text-foreground leading-tight uppercase te-emboss">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onNewTask(selectedDay)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg te-button-primary text-[10px] font-mono font-bold uppercase tracking-widest"
                >
                  <Plus size={12} /> ADD
                </button>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-2 rounded-lg te-button text-muted-foreground"
                >
                  <XCircle size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {(tasksByDate[selectedDay] ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <CalendarDays size={24} className="text-muted-foreground mb-3" />
                  <p className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">// NO TASKS SCHEDULED</p>
                </div>
              ) : (
                (tasksByDate[selectedDay] ?? []).map((task) => {
                  const hex = getColorHex(task);
                  let bgColor = hex + '1A';
                  let borderColor = `3px solid ${hex}`;
                  if (task.mode === 'deadline') {
                    bgColor = getDeadlineColor(task) + '1A';
                    borderColor = `3px solid ${getDeadlineColor(task)}`;
                  } else if (task.mode === 'timeBox') {
                    bgColor = '#8b5cf61A';
                    borderColor = '3px solid #8b5cf6';
                  } else if (task.mode === 'floating') {
                    bgColor = '#6366f11A';
                    borderColor = '3px solid #6366f1';
                  }
                  return (
                    <button
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className="text-left flex items-start gap-3 p-4 rounded-xl border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: bgColor, borderLeft: borderColor }}
                    >
                      <StatusIcon status={task.status} />
                      <div className="flex-1 min-w-0 mt-0.5">
                        <p className="text-sm font-sans font-bold uppercase tracking-wide text-foreground truncate">{task.title}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-2">
                          {task.dueTime && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-background/50 text-foreground border border-border/50 flex-shrink-0">
                              <Clock size={10} /> {task.dueTime}
                            </span>
                          )}
                          {task.mode === 'timeBox' && (
                            <span className="text-[9px] font-mono font-bold tracking-widest opacity-75 flex items-center gap-1 uppercase">
                              <RotateCw size={10} /> Time Box
                            </span>
                          )}
                        </div>
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