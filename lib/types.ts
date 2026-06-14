// ─────────────────────────────────────────────────────────────────
// Shared types for Notescape
// ─────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  summary?: string;
  tags: string[];
  pinned: boolean;
  updatedAt: number;
  isPublic?: boolean;
  shareToken?: string;
}

export type CollaboratorRole = 'viewer' | 'editor';

export interface Collaborator {
  noteId: string;
  userId: string;
  role: CollaboratorRole;
  createdAt: string;
}

export type TaskPriority = 'high' | 'medium' | 'low' | 'none';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  colorTag: string; // hex or named color key
  dueDate: string | null; // ISO date string: 'YYYY-MM-DD'
  linkedNoteId: string | null;
  createdAt: number;
  updatedAt: number;
  dueTime?: string;      // <-- Ensure this is present
  mode?: 'deadline' | 'timeBox' | 'floating'; // <-- Ensure this is present
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: '#f87171',
  medium: '#fb923c',
  low: '#60a5fa',
  none: '#9ca3af',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const TASK_COLOR_OPTIONS = [
  { label: 'Rose', value: 'rose', hex: '#fda4af' },
  { label: 'Amber', value: 'amber', hex: '#fcd34d' },
  { label: 'Emerald', value: 'emerald', hex: '#6ee7b7' },
  { label: 'Sky', value: 'sky', hex: '#7dd3fc' },
  { label: 'Violet', value: 'violet', hex: '#c4b5fd' },
  { label: 'Slate', value: 'slate', hex: '#94a3b8' },
];
