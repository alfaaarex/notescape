/**
 * regex-parser.ts  —  Supercharged NLP task parser (v2)
 *
 * Pipeline:
 *   1. Normalise input
 *   2. Strip priority tokens
 *   3. Strip recurrence tokens
 *   4. Strip duration tokens (before time to avoid am/pm confusion)
 *   5. Strip time tokens
 *   6. Strip date tokens
 *   7. Infer color from full original text
 *   8. Build mode (timeBox / deadline / floating)
 *   9. Clean remaining text → title
 */

import type { TaskPriority, TaskStatus } from './types';

// ─── Public types ────────────────────────────────────────────────────────────

export type RecurrenceDays = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface RecurrenceRule {
    type: 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'custom';
    days: RecurrenceDays[];
    interval: number;
}

export interface ParsedTask {
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string | null;
    dueTime: string | null;
    colorTag: string;
    mode: 'deadline' | 'timeBox' | 'floating';
    start?: string | null;
    duration?: number;
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

// Domain keyword → color (checked against full raw input)
const COLOR_RULES: [RegExp, string][] = [
    [/\b(bug|fix|error|crash|issue|hotfix|incident|debug|patch|broken)\b/i, 'rose'],
    [/\b(review|deadline|report|submit|approval|meeting|standup|sync|demo|pitch)\b/i, 'amber'],
    [/\b(build|implement|develop|create|add|ship|launch|release|feature|deploy|code|refactor|migrate)\b/i, 'emerald'],
    [/\b(doc|docs|documentation|write|wiki|readme|notes|admin|plan|spec|draft|blog|essay)\b/i, 'sky'],
    [/\b(design|ui|ux|figma|prototype|wireframe|mockup|brand|layout|css|style|color|palette)\b/i, 'violet'],
    [/\b(gym|workout|run|yoga|exercise|swim|train|walk|hike|stretch|sport|fitness|lift|cardio)\b/i, 'emerald'],
    [/\b(study|learn|read|course|class|lecture|research|practice|drill|exam|quiz|tutor|revise)\b/i, 'sky'],
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
    const todayDow = d.getDay();
    const diff = (target - todayDow + 7) % 7 || 7; // always forward; 0 → next week
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}

function to24h(hour: number, min: number, meridiem: string | undefined): string {
    let h = Math.min(23, Math.max(0, hour));
    const m = Math.min(59, Math.max(0, min));
    if (meridiem) {
        const mer = meridiem.toLowerCase();
        if (mer === 'pm' && h !== 12) h = Math.min(23, h + 12);
        if (mer === 'am' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── String helpers ───────────────────────────────────────────────────────────

function clean(s: string): string {
    return s.replace(/\s{2,}/g, ' ').trim();
}

function stripMatch(s: string, m: RegExpExecArray): string {
    return clean(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length));
}

function stripRe(s: string, ...patterns: RegExp[]): string {
    let out = s;
    for (const p of patterns) out = out.replace(p, ' ');
    return clean(out);
}

// ─── Normalise ────────────────────────────────────────────────────────────────

/** Lower-case aliases that confuse later patterns */
function normalise(raw: string): string {
    return raw
        .replace(/\bmondays?\b/gi, 'Monday')
        .replace(/\btuesdays?\b/gi, 'Tuesday')
        .replace(/\bwednesdays?\b/gi, 'Wednesday')
        .replace(/\bthursdays?\b/gi, 'Thursday')
        .replace(/\bfridays?\b/gi, 'Friday')
        .replace(/\bsaturdays?\b/gi, 'Saturday')
        .replace(/\bsundays?\b/gi, 'Sunday')
        // "6am" / "6pm" → "6 am" / "6 pm"
        .replace(/(\d)(am|pm)\b/gi, '$1 $2');
}

// ─── Priority ────────────────────────────────────────────────────────────────

function parsePriority(raw: string): { priority: TaskPriority; remainder: string } {
    // Explicit: priority:high | p:medium | priority=low
    const tagRx = /\bpriority[:=]\s*(high|medium|med|low|urgent|critical|normal|none)\b/i;
    let m = tagRx.exec(raw);
    if (m) {
        const v = m[1].toLowerCase();
        const p: TaskPriority = v === 'urgent' || v === 'critical' ? 'high' : v === 'med' ? 'medium' : v === 'normal' ? 'none' : v as TaskPriority;
        return { priority: p, remainder: stripMatch(raw, m) };
    }

    // #high #urgent
    const hashRx = /#(high|medium|med|low|urgent|critical)\b/i;
    m = hashRx.exec(raw);
    if (m) {
        const v = m[1].toLowerCase();
        const p: TaskPriority = v === 'urgent' || v === 'critical' ? 'high' : v === 'med' ? 'medium' : v as TaskPriority;
        return { priority: p, remainder: stripMatch(raw, m) };
    }

    // !! = high, ! = medium (only standalone, not inside words)
    if (/!!+/.test(raw)) return { priority: 'high', remainder: clean(raw.replace(/!!+/g, '')) };
    if (/(?<!\w)!(?!\w)/.test(raw)) return { priority: 'medium', remainder: clean(raw.replace(/(?<!\w)!(?!\w)/, '')) };

    // Keywords (full word, order matters)
    const kw: [RegExp, TaskPriority][] = [
        [/\b(urgent|asap|critical|high[\s-]priority|top[\s-]priority|important)\b/gi, 'high'],
        [/\b(medium[\s-]priority|normal[\s-]priority|soon|moderate)\b/gi, 'medium'],
        [/\b(low[\s-]priority|whenever|eventually|someday|nice[\s-]to[\s-]have)\b/gi, 'low'],
    ];
    for (const [rx, prio] of kw) {
        if (rx.test(raw)) return { priority: prio, remainder: stripRe(raw, new RegExp(rx.source, 'gi')) };
    }

    return { priority: 'none', remainder: raw };
}

// ─── Recurrence ───────────────────────────────────────────────────────────────

const DAY_NAMES = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun';
const DAY_RX = new RegExp(`\\b(${DAY_NAMES})\\b`, 'gi');

function extractDays(chunk: string): RecurrenceDays[] {
    const days: RecurrenceDays[] = [];
    let dt: RegExpExecArray | null;
    const rx = new RegExp(DAY_RX.source, 'gi');
    while ((dt = rx.exec(chunk)) !== null) {
        const key = dt[1].toLowerCase().slice(0, 3) as RecurrenceDays;
        if (DAY_MAP[dt[1].toLowerCase()] && !days.includes(key)) days.push(key);
    }
    return days.sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
}

function parseRecurrence(raw: string): { recurrence: RecurrenceRule | null; remainder: string } {
    // daily / every day
    if (/\b(daily|every\s+day)\b/i.test(raw)) {
        return { recurrence: { type: 'daily', days: [], interval: 1 }, remainder: stripRe(raw, /\b(daily|every\s+day)\b/gi) };
    }

    // weekdays / every weekday
    if (/\b(every\s+)?weekdays?\b/i.test(raw)) {
        return { recurrence: { type: 'weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'], interval: 1 }, remainder: stripRe(raw, /\b(every\s+)?weekdays?\b/gi) };
    }

    // weekends / every weekend
    if (/\b(every\s+)?weekends?\b/i.test(raw)) {
        return { recurrence: { type: 'weekends', days: ['sat', 'sun'], interval: 1 }, remainder: stripRe(raw, /\b(every\s+)?weekends?\b/gi) };
    }

    // every week / weekly (no specific day named yet — kept for bare "every week")
    if (/\b(every\s+week|weekly)\b/i.test(raw)) {
        // Check if any day names follow
        const afterRx = /\b(?:every\s+week|weekly)\s+(?:on\s+)?((?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[\s,&]+(?:and\s+)?)+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b)/i;
        const wm = afterRx.exec(raw);
        if (wm) {
            const days = extractDays(wm[1]);
            return { recurrence: { type: 'custom', days, interval: 1 }, remainder: stripMatch(raw, wm) };
        }
        return { recurrence: { type: 'weekly', days: [], interval: 1 }, remainder: stripRe(raw, /\b(every\s+week|weekly)\b/gi) };
    }

    // "every Mon, Wed, Fri" — most common pattern
    const everyDayRx = /\bevery\s+((?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\s*[,&/]\s*(?:and\s+)?|\s+and\s+)?)+)/gi;
    const em = everyDayRx.exec(raw);
    if (em) {
        const days = extractDays(em[1]);
        if (days.length > 0) {
            return {
                recurrence: { type: days.length === 1 ? 'weekly' : 'custom', days, interval: 1 },
                remainder: stripMatch(raw, em),
            };
        }
    }

    // "Mondays" / "on Wednesdays" (plural implies recurrence)
    const pluralRx = /\b(?:on\s+)?(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)(?:\s*,\s*|\s+and\s+|\s*\/\s*)?((?:Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)(?:\s*[,\/]\s*(?:and\s+)?(?:Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?))*)?/gi;
    const pm = pluralRx.exec(raw);
    if (pm && /s\b/.test(pm[1])) { // only if the first one is plural
        const days = extractDays(pm[0]);
        if (days.length > 0) {
            return {
                recurrence: { type: days.length === 1 ? 'weekly' : 'custom', days, interval: 1 },
                remainder: stripMatch(raw, pm),
            };
        }
    }

    return { recurrence: null, remainder: raw };
}

// ─── Duration ────────────────────────────────────────────────────────────────

function parseDuration(raw: string): { duration: number; remainder: string } {
    // "for 1h 30m" / "for 1.5h" / "for 90 minutes"
    const combinedRx = /\bfor\s+(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+)\s*(?:mins?|minutes?))?\b/i;
    let m = combinedRx.exec(raw);
    if (m) {
        const hours = parseFloat(m[1]);
        const mins = parseInt(m[2] || '0', 10);
        return { duration: Math.round(hours * 60) + mins, remainder: stripMatch(raw, m) };
    }

    // "for 45 mins"
    const minRx = /\bfor\s+(\d+)\s*(?:mins?|minutes?)\b/i;
    m = minRx.exec(raw);
    if (m) return { duration: parseInt(m[1], 10), remainder: stripMatch(raw, m) };

    // "from 2pm to 4pm" — compute diff
    const rangeRx = /\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    m = rangeRx.exec(raw);
    if (m) {
        const startStr = to24h(parseInt(m[1]), parseInt(m[2] || '0'), m[3]);
        const endStr = to24h(parseInt(m[4]), parseInt(m[5] || '0'), m[6]);
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em2] = endStr.split(':').map(Number);
        const mins = (eh * 60 + em2) - (sh * 60 + sm);
        // Keep the start time in the remainder so the time parser picks it up
        const stripped = stripMatch(raw, m);
        return { duration: Math.max(0, mins), remainder: stripped + ` at ${m[1]}${m[2] ? ':' + m[2] : ''} ${m[3] || ''}`.trim() };
    }

    return { duration: 0, remainder: raw };
}

// ─── Time ────────────────────────────────────────────────────────────────────

function parseTime(raw: string): { time: string | null; remainder: string } {
    // "at 6:30 am" / "at 14:00" / "@ 9pm"
    const timeRx = /\b(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const m = timeRx.exec(raw);
    if (m) {
        const hour = parseInt(m[1], 10);
        const min = parseInt(m[2] || '0', 10);
        // Infer meridiem: if no am/pm and hour < 7, assume pm (6 → 18:00); else keep as-is
        const meridiem = m[3] || (hour < 7 ? 'pm' : undefined);
        return { time: to24h(hour, min, meridiem), remainder: stripMatch(raw, m) };
    }

    // Bare time without "at": "6am", "2:30pm"
    const bareTimeRx = /(?<!\w)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
    const bm = bareTimeRx.exec(raw);
    if (bm) {
        return { time: to24h(parseInt(bm[1]), parseInt(bm[2] || '0', 10), bm[3]), remainder: stripMatch(raw, bm) };
    }

    return { time: null, remainder: raw };
}

// ─── Date ────────────────────────────────────────────────────────────────────

function parseDate(raw: string): { date: string | null; remainder: string } {
    if (/\btoday\b/i.test(raw)) return { date: todayISO(), remainder: stripRe(raw, /\btoday\b/gi) };
    if (/\btomorrow\b/i.test(raw)) return { date: offsetISO(1), remainder: stripRe(raw, /\btomorrow\b/gi) };
    if (/\byesterday\b/i.test(raw)) return { date: offsetISO(-1), remainder: stripRe(raw, /\byesterday\b/gi) };
    if (/\bnext\s+week\b/i.test(raw)) return { date: offsetISO(7), remainder: stripRe(raw, /\bnext\s+week\b/gi) };

    // "in N days"
    const inDaysRx = /\bin\s+(\d+)\s+days?\b/i;
    let m = inDaysRx.exec(raw);
    if (m) return { date: offsetISO(parseInt(m[1])), remainder: stripMatch(raw, m) };

    // "in N weeks"
    const inWeeksRx = /\bin\s+(\d+)\s+weeks?\b/i;
    m = inWeeksRx.exec(raw);
    if (m) return { date: offsetISO(parseInt(m[1]) * 7), remainder: stripMatch(raw, m) };

    // "next Monday" / "on Friday" / bare day name
    const nextDayRx = /\b(?:next\s+|on\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i;
    m = nextDayRx.exec(raw);
    if (m) {
        const key = DAY_MAP[m[1].toLowerCase()];
        if (key) return { date: nextWeekdayISO(key), remainder: stripMatch(raw, m) };
    }

    // "Jan 15" / "January 3rd" / "15 Jan"
    const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const mdy = new RegExp(`${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i');
    const dmy = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}`, 'i');

    m = mdy.exec(raw);
    if (m) {
        const month = MONTHS[m[1].toLowerCase().slice(0, 3)];
        const day = parseInt(m[2]);
        const year = new Date().getFullYear() + (new Date().getMonth() + 1 > month ? 1 : 0);
        return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, remainder: stripMatch(raw, m) };
    }
    m = dmy.exec(raw);
    if (m) {
        const day = parseInt(m[1]);
        const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
        const year = new Date().getFullYear() + (new Date().getMonth() + 1 > month ? 1 : 0);
        return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, remainder: stripMatch(raw, m) };
    }

    // ISO: 2025-06-15 or 06/15/2025 or 06/15
    const isoRx = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    m = isoRx.exec(raw);
    if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, remainder: stripMatch(raw, m) };

    const slashRx = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/;
    m = slashRx.exec(raw);
    if (m) {
        const mm = String(parseInt(m[1])).padStart(2, '0');
        const dd = String(parseInt(m[2])).padStart(2, '0');
        const yy = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : new Date().getFullYear().toString();
        return { date: `${yy}-${mm}-${dd}`, remainder: stripMatch(raw, m) };
    }

    return { date: null, remainder: raw };
}

// ─── Color inference ─────────────────────────────────────────────────────────

function inferColor(text: string): string {
    for (const [rx, color] of COLOR_RULES) if (rx.test(text)) return color;
    return 'slate';
}

// ─── First occurrence ────────────────────────────────────────────────────────

function firstOccurrenceISO(rule: RecurrenceRule, fallback: string | null): string {
    if (rule.type === 'daily') return todayISO();
    if (rule.type === 'weekdays') {
        const dow = new Date().getDay();
        return dow === 0 ? offsetISO(1) : dow === 6 ? offsetISO(2) : todayISO();
    }
    if (rule.type === 'weekends') {
        const dow = new Date().getDay();
        const diffSat = (6 - dow + 7) % 7;
        return diffSat === 0 ? todayISO() : offsetISO(diffSat);
    }
    if (rule.days.length > 0) {
        const today = new Date().getDay();
        let minDiff = 8;
        for (const d of rule.days) {
            const diff = (DAY_INDEX[d] - today + 7) % 7;
            if (diff < minDiff) minDiff = diff;
        }
        return offsetISO(minDiff === 0 ? 0 : minDiff);
    }
    return fallback ?? todayISO();
}

// ─── Title cleanup ────────────────────────────────────────────────────────────

const NOISE_WORDS_START = /^(at|on|for|by|every|from|to|the|a|an)\s+/i;
const NOISE_WORDS_END = /\s+(at|on|for|by|from|to)$/i;
const NOISE_PUNCT = /^[,;:\-–—]+|[,;:\-–—]+$/g;

function cleanTitle(s: string): string {
    return s
        .replace(NOISE_WORDS_START, '')
        .replace(NOISE_WORDS_END, '')
        .replace(NOISE_PUNCT, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseTaskInput(input: string): ParsedTask {
    const original = input.trim();
    let remainder = normalise(original);

    // Pipeline — each stage strips its tokens from `remainder`
    const { priority, remainder: r1 } = parsePriority(remainder); remainder = r1;
    const { recurrence, remainder: r2 } = parseRecurrence(remainder); remainder = r2;
    const { duration, remainder: r3 } = parseDuration(remainder); remainder = r3;
    const { time, remainder: r4 } = parseTime(remainder); remainder = r4;
    const { date, remainder: r5 } = parseDate(remainder); remainder = r5;

    // Color — run against the full original to catch domain words in the title
    const colorTag = inferColor(original);

    // Mode
    const hasTime = time !== null;
    const hasDuration = duration > 0;
    const mode: 'deadline' | 'timeBox' | 'floating' =
        hasTime || hasDuration ? 'timeBox' :
            date || recurrence ? 'deadline' :
                'floating';

    // dueDate
    const dueDate = recurrence ? firstOccurrenceISO(recurrence, date) : date;

    // start ISO for timeBox
    const start = mode === 'timeBox' && time
        ? `${dueDate ?? todayISO()}T${time}:00`
        : null;

    // Title — whatever survives the strip passes
    const title = cleanTitle(remainder) || cleanTitle(original);

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

// ─── Human-readable helpers ───────────────────────────────────────────────────

const DAY_LABELS: Record<RecurrenceDays, string> = {
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export function recurrenceLabel(rule: RecurrenceRule): string {
    switch (rule.type) {
        case 'daily': return 'Every day';
        case 'weekdays': return 'Mon – Fri';
        case 'weekends': return 'Sat & Sun';
        case 'weekly':
            return rule.days.length ? `Weekly · ${rule.days.map(d => DAY_LABELS[d]).join(', ')}` : 'Weekly';
        case 'custom':
            return rule.days.map(d => DAY_LABELS[d]).join(', ');
    }
}

export function recurrenceShortLabel(rule: RecurrenceRule): string {
    switch (rule.type) {
        case 'daily': return '∞ Daily';
        case 'weekdays': return '∞ M–F';
        case 'weekends': return '∞ Wknd';
        default: return `∞ ${rule.days.map(d => DAY_LABELS[d]).join('/')}`;
    }
}