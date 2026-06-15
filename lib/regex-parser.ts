/**
 * regex-parser.ts
 * Supercharged NLP-style task parser using pure regex — zero AI latency.
 *
 * Handles:
 *  - Recurring events: "every Mon, Wed, Fri" / "daily" / "weekly on Tuesday"
 *  - Time-blocking: "at 6am for 1h" / "from 2pm to 4pm"
 *  - Priority tags: "priority:high" / "urgent" / "!!" / "#high"
 *  - Auto color-coding by domain keywords
 *  - Absolute & relative dates: "tomorrow", "next Friday", "Jan 15"
 */

import type { TaskPriority, TaskStatus } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export type RecurrenceDays = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface RecurrenceRule {
    type: 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'custom';
    days: RecurrenceDays[]; // populated for 'custom' and 'weekly'
    interval: number;       // every N weeks/days (default 1)
}

export interface ParsedTask {
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string | null;        // ISO YYYY-MM-DD (first occurrence for recurring)
    dueTime: string | null;        // HH:mm 24h
    colorTag: string;
    mode: 'deadline' | 'timeBox' | 'floating';
    start?: string | null;         // ISO datetime for timeBox
    duration?: number;             // minutes
    recurrence?: RecurrenceRule | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, RecurrenceDays> = {
    monday: 'mon', mon: 'mon',
    tuesday: 'tue', tue: 'tue',
    wednesday: 'wed', wed: 'wed',
    thursday: 'thu', thu: 'thu',
    friday: 'fri', fri: 'fri',
    saturday: 'sat', sat: 'sat',
    sunday: 'sun', sun: 'sun',
};

const DAY_INDEX: Record<RecurrenceDays, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

// Domain → color mappings (checked against full cleaned input)
const COLOR_RULES: [RegExp, string][] = [
    [/\b(bug|fix|error|crash|issue|hotfix|incident|debug)\b/i, 'rose'],
    [/\b(review|deadline|report|submit|approval|meeting|standup|sync)\b/i, 'amber'],
    [/\b(feature|build|implement|develop|create|add|ship|launch|release)\b/i, 'emerald'],
    [/\b(doc|docs|documentation|write|wiki|readme|notes|admin|plan|spec)\b/i, 'sky'],
    [/\b(design|ui|ux|figma|prototype|wireframe|mockup|brand|layout|css|style)\b/i, 'violet'],
    [/\b(gym|workout|run|yoga|exercise|swim|train|walk|hike|stretch|sport)\b/i, 'emerald'],
    [/\b(study|learn|read|course|class|lecture|research|practice|drill|exam)\b/i, 'sky'],
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function offsetISO(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function nextWeekdayISO(wd: RecurrenceDays): string {
    const target = DAY_INDEX[wd];
    const d = new Date();
    const diff = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}

function to24h(hour: number, min: number, meridiem: string | undefined): string {
    let h = hour;
    if (meridiem) {
        const m = meridiem.toLowerCase();
        if (m === 'pm' && h !== 12) h += 12;
        if (m === 'am' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── Strip helpers ────────────────────────────────────────────────────────────

/**
 * Remove matched range [start, end) from string — returns trimmed remainder.
 */
function stripRange(s: string, match: RegExpExecArray): string {
    return (s.slice(0, match.index) + s.slice(match.index + match[0].length)).replace(/\s{2,}/g, ' ').trim();
}

function stripAll(s: string, ...patterns: RegExp[]): string {
    let out = s;
    for (const p of patterns) {
        out = out.replace(p, ' ');
    }
    return out.replace(/\s{2,}/g, ' ').trim();
}

// ─── Sub-parsers ──────────────────────────────────────────────────────────────

/** priority:high | #high | urgent | !! → TaskPriority */
function parsePriority(raw: string): { priority: TaskPriority; remainder: string } {
    // Explicit tag: priority:high / p:medium / priority=low
    const tagRx = /\bpriority[:=]\s*(high|medium|low|urgent|critical|normal|none)\b/i;
    let m = tagRx.exec(raw);
    if (m) {
        const val = m[1].toLowerCase();
        const p: TaskPriority = val === 'urgent' || val === 'critical' ? 'high'
            : val === 'normal' ? 'none'
                : val as TaskPriority;
        return { priority: p, remainder: stripRange(raw, m) };
    }

    // Hash tag: #high #urgent
    const hashRx = /#(high|medium|low|urgent|critical|normal)\b/i;
    m = hashRx.exec(raw);
    if (m) {
        const val = m[1].toLowerCase();
        const p: TaskPriority = val === 'urgent' || val === 'critical' ? 'high'
            : val === 'normal' ? 'none'
                : val as TaskPriority;
        return { priority: p, remainder: stripRange(raw, m) };
    }

    // Exclamation shorthand !! = high, ! = medium
    if (/!!/.test(raw)) return { priority: 'high', remainder: raw.replace(/!!+/, '').trim() };
    if (/!(?!\w)/.test(raw)) return { priority: 'medium', remainder: raw.replace(/!(?!\w)/, '').trim() };

    // Keyword hints
    if (/\b(urgent|asap|critical|important|high[\s-]priority)\b/i.test(raw)) {
        return { priority: 'high', remainder: stripAll(raw, /\b(urgent|asap|critical|important|high[\s-]priority)\b/gi) };
    }
    if (/\b(medium[\s-]priority|normal[\s-]priority|soon)\b/i.test(raw)) {
        return { priority: 'medium', remainder: stripAll(raw, /\b(medium[\s-]priority|normal[\s-]priority|soon)\b/gi) };
    }
    if (/\b(low[\s-]priority|whenever|eventually|someday)\b/i.test(raw)) {
        return { priority: 'low', remainder: stripAll(raw, /\b(low[\s-]priority|whenever|eventually|someday)\b/gi) };
    }

    return { priority: 'none', remainder: raw };
}

/** every Mon, Wed, Fri / daily / weekly on Tuesday / weekdays */
function parseRecurrence(raw: string): { recurrence: RecurrenceRule | null; remainder: string } {
    // "every day" / "daily"
    if (/\b(every\s+day|daily)\b/i.test(raw)) {
        return {
            recurrence: { type: 'daily', days: [], interval: 1 },
            remainder: stripAll(raw, /\b(every\s+day|daily)\b/gi),
        };
    }

    // "weekdays" / "every weekday"
    if (/\b(every\s+)?weekdays?\b/i.test(raw)) {
        return {
            recurrence: { type: 'weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'], interval: 1 },
            remainder: stripAll(raw, /\b(every\s+)?weekdays?\b/gi),
        };
    }

    // "weekends" / "every weekend"
    if (/\b(every\s+)?weekends?\b/i.test(raw)) {
        return {
            recurrence: { type: 'weekends', days: ['sat', 'sun'], interval: 1 },
            remainder: stripAll(raw, /\b(every\s+)?weekends?\b/gi),
        };
    }

    // "every week" / "weekly"
    const weeklyRx = /\b(every\s+week|weekly)\b/i;
    if (weeklyRx.test(raw)) {
        return {
            recurrence: { type: 'weekly', days: [], interval: 1 },
            remainder: stripAll(raw, weeklyRx),
        };
    }

    // "every Mon, Wed, Fri" / "every Monday and Wednesday"
    const everyDaysRx = /\bevery\s+((?:(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:[,\s&]+(?:and\s+)?)?)+)/gi;
    const m = everyDaysRx.exec(raw);
    if (m) {
        const chunk = m[1];
        const dayTokenRx = /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi;
        const days: RecurrenceDays[] = [];
        let dt: RegExpExecArray | null;
        while ((dt = dayTokenRx.exec(chunk)) !== null) {
            const key = dt[1].toLowerCase().slice(0, 3) as RecurrenceDays;
            if (!days.includes(key)) days.push(key);
        }
        // Sort by day index
        days.sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
        return {
            recurrence: { type: 'custom', days, interval: 1 },
            remainder: (raw.slice(0, m.index) + raw.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim(),
        };
    }

    return { recurrence: null, remainder: raw };
}

/** at 6am / at 2:30pm / at 14:00 */
function parseTime(raw: string): { time: string | null; remainder: string } {
    // "at HH:MM am/pm" or "at H am/pm" or "at HH:MM"
    const timeRx = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const m = timeRx.exec(raw);
    if (m) {
        const hour = parseInt(m[1], 10);
        const min = parseInt(m[2] || '0', 10);
        const meridiem = m[3];
        const time = to24h(hour, min, meridiem);
        return { time, remainder: stripRange(raw, m) };
    }
    return { time: null, remainder: raw };
}

/** for 1h / for 30min / for 1.5 hours / for 45 mins */
function parseDuration(raw: string): { duration: number; remainder: string } {
    // "for N hour(s)" or "for N h"
    const hourRx = /\bfor\s+(\d+(?:\.\d+)?)\s*h(?:ours?)?\b/i;
    let m = hourRx.exec(raw);
    if (m) {
        const mins = Math.round(parseFloat(m[1]) * 60);
        return { duration: mins, remainder: stripRange(raw, m) };
    }

    // "for N min(s)"
    const minRx = /\bfor\s+(\d+)\s*(?:mins?|minutes?)\b/i;
    m = minRx.exec(raw);
    if (m) {
        return { duration: parseInt(m[1], 10), remainder: stripRange(raw, m) };
    }

    // "from X to Y" time block — compute diff
    const rangeRx = /\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    m = rangeRx.exec(raw);
    if (m) {
        const startH = to24h(parseInt(m[1]), parseInt(m[2] || '0'), m[3]);
        const endH = to24h(parseInt(m[4]), parseInt(m[5] || '0'), m[6]);
        const [sh, sm] = startH.split(':').map(Number);
        const [eh, em] = endH.split(':').map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        return { duration: Math.max(0, mins), remainder: stripRange(raw, m) };
    }

    return { duration: 0, remainder: raw };
}

/** tomorrow / today / next Friday / Jan 15 / in 3 days */
function parseDate(raw: string): { date: string | null; remainder: string } {
    if (/\btoday\b/i.test(raw)) {
        return { date: todayISO(), remainder: stripAll(raw, /\btoday\b/gi) };
    }
    if (/\btomorrow\b/i.test(raw)) {
        return { date: offsetISO(1), remainder: stripAll(raw, /\btomorrow\b/gi) };
    }
    if (/\byesterday\b/i.test(raw)) {
        return { date: offsetISO(-1), remainder: stripAll(raw, /\byesterday\b/gi) };
    }
    if (/\bnext\s+week\b/i.test(raw)) {
        return { date: offsetISO(7), remainder: stripAll(raw, /\bnext\s+week\b/gi) };
    }
    if (/\bin\s+(\d+)\s+days?\b/i.test(raw)) {
        const m = /\bin\s+(\d+)\s+days?\b/i.exec(raw)!;
        return { date: offsetISO(parseInt(m[1])), remainder: stripRange(raw, m) };
    }

    // "next Monday" / "on Friday" / bare weekday
    const nextDayRx = /\b(?:next\s+|on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
    const m = nextDayRx.exec(raw);
    if (m) {
        const key = m[1].toLowerCase().slice(0, 3) as RecurrenceDays;
        return { date: nextWeekdayISO(key), remainder: stripRange(raw, m) };
    }

    // Month names: "Jan 15" / "March 3rd"
    const monthRx = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
    const mm = monthRx.exec(raw);
    if (mm) {
        const monthNames: Record<string, number> = {
            jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
        };
        const key = mm[1].toLowerCase().slice(0, 3);
        const month = monthNames[key];
        const day = parseInt(mm[2]);
        const year = new Date().getFullYear();
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date, remainder: stripRange(raw, mm) };
    }

    return { date: null, remainder: raw };
}

/** Infer color from domain keywords */
function inferColor(text: string): string {
    for (const [rx, color] of COLOR_RULES) {
        if (rx.test(text)) return color;
    }
    return 'slate';
}

/** Build ISO date string for first occurrence of recurring event */
function firstOccurrenceISO(rule: RecurrenceRule, fallback: string | null): string {
    if (rule.type === 'daily' || rule.type === 'weekdays' || rule.type === 'weekends') {
        return todayISO();
    }
    if (rule.type === 'custom' && rule.days.length > 0) {
        // Find the soonest upcoming day
        const today = new Date().getDay();
        let minDiff = 8;
        for (const d of rule.days) {
            const diff = (DAY_INDEX[d] - today + 7) % 7;
            if (diff < minDiff) minDiff = diff;
        }
        return offsetISO(minDiff);
    }
    if (rule.type === 'weekly' && rule.days.length > 0) {
        return nextWeekdayISO(rule.days[0]);
    }
    return fallback ?? todayISO();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseTaskInput(input: string): ParsedTask {
    let remainder = input.trim();

    // 1. Priority — strip from remainder so it doesn't contaminate title
    const { priority, remainder: r1 } = parsePriority(remainder);
    remainder = r1;

    // 2. Recurrence
    const { recurrence, remainder: r2 } = parseRecurrence(remainder);
    remainder = r2;

    // 3. Duration (before time, so "at 6am for 1h" doesn't confuse order)
    const { duration, remainder: r3 } = parseDuration(remainder);
    remainder = r3;

    // 4. Time
    const { time, remainder: r4 } = parseTime(remainder);
    remainder = r4;

    // 5. Date (only relevant for non-recurring, or as anchor for first occurrence)
    const { date, remainder: r5 } = parseDate(remainder);
    remainder = r5;

    // 6. Color — run against full original to catch domain keywords in title
    const colorTag = inferColor(input);

    // 7. Determine mode
    let mode: 'deadline' | 'timeBox' | 'floating' = 'deadline';
    if (duration > 0 || time !== null) {
        mode = 'timeBox';
    } else if (!date && !recurrence) {
        // No time info at all — floating
        mode = 'floating';
    }

    // 8. Resolve dueDate
    let dueDate: string | null = date;
    if (recurrence) {
        dueDate = firstOccurrenceISO(recurrence, date);
    }

    // 9. Build start for timeBox
    let start: string | null = null;
    if (mode === 'timeBox' && time) {
        const base = dueDate ?? todayISO();
        start = `${base}T${time}:00`;
    }

    // 10. Clean up title — what's left is the task title
    // Remove stray punctuation and connectors at edges
    const title = remainder
        .replace(/^(at|on|for|by|every|from|to)\s+/i, '')
        .replace(/\s+(at|on|for|by)$/i, '')
        .replace(/[,;]+$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim() || input.trim();

    return {
        title,
        description: '',
        priority,
        status: 'todo',
        dueDate,
        dueTime: time,
        colorTag,
        mode,
        start,
        duration,
        recurrence,
    };
}

// ─── Human-readable recurrence label ─────────────────────────────────────────

export function recurrenceLabel(rule: RecurrenceRule): string {
    const dayLabels: Record<RecurrenceDays, string> = {
        mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
        fri: 'Fri', sat: 'Sat', sun: 'Sun',
    };
    switch (rule.type) {
        case 'daily': return 'Every day';
        case 'weekdays': return 'Weekdays';
        case 'weekends': return 'Weekends';
        case 'weekly':
            return rule.days.length ? `Weekly on ${rule.days.map(d => dayLabels[d]).join(', ')}` : 'Weekly';
        case 'custom':
            return `Every ${rule.days.map(d => dayLabels[d]).join(', ')}`;
    }
}