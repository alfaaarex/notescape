'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownAZ,
  Clock3,
  FileText,
  Grid2X2,
  LayoutList,
  Pin,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import type { Note } from '@/lib/storage';

interface NoteGridProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

const COLOR_HEX: Record<string, string> = {
  alabaster: '#F9F9F6',
  sage: '#EEF2EE',
  linen: '#FDF8F5',
  slate: '#F0F1F4',
  lavender: '#F3EFFF',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const card = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

type SortMode = 'recent' | 'title' | 'length';
type ViewMode = 'grid' | 'list';

export function NoteGrid({ notes, onSelectNote, onDeleteNote }: NoteGridProps) {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const tags = useMemo(() => Array.from(new Set(notes.flatMap((note) => note.tags ?? []))).sort(), [notes]);
  const totalWords = useMemo(() => notes.reduce((sum, note) => sum + countWords(note.content), 0), [notes]);

  const visibleNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notes
      .filter((note) => {
        const matchesQuery =
          !normalizedQuery ||
          note.title.toLowerCase().includes(normalizedQuery) ||
          note.content.toLowerCase().includes(normalizedQuery) ||
          note.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery));
        const matchesTag = !selectedTag || note.tags?.includes(selectedTag);
        return matchesQuery && matchesTag;
      })
      .sort((a, b) => {
        if (sortMode === 'title') return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
        if (sortMode === 'length') return countWords(b.content) - countWords(a.content);
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, query, selectedTag, sortMode]);

  const pinned = visibleNotes.filter((n) => n.pinned);
  const unpinned = visibleNotes.filter((n) => !n.pinned);

  if (notes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#fbfbfa] px-6 py-24 text-center dark:bg-zinc-900">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-zinc-800 dark:ring-zinc-700">
          <FileText className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No notes yet</p>
          <p className="mt-1 max-w-sm text-sm text-gray-400 dark:text-zinc-500">Create a note from the sidebar and it will appear here with tags, pins, and quick previews.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#fbfbfa] dark:bg-zinc-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-5 sm:p-8">
        <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                Notes workspace
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-zinc-50">Your notes</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-zinc-400">
                Browse, filter, and jump back into your thinking without digging through the sidebar.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[25rem]">
              <Metric label="Notes" value={notes.length.toString()} />
              <Metric label="Pinned" value={notes.filter((note) => note.pinned).length.toString()} />
              <Metric label="Words" value={compactNumber(totalWords)} />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <Search size={16} className="flex-shrink-0 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, note text, or tags..."
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-zinc-200"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ControlButton active={sortMode === 'recent'} onClick={() => setSortMode('recent')} icon={<Clock3 size={14} />} label="Recent" />
              <ControlButton active={sortMode === 'title'} onClick={() => setSortMode('title')} icon={<ArrowDownAZ size={14} />} label="Title" />
              <ControlButton active={sortMode === 'length'} onClick={() => setSortMode('length')} icon={<FileText size={14} />} label="Length" />
              <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800" />
              <ControlButton active={viewMode === 'grid'} onClick={() => setViewMode('grid')} icon={<Grid2X2 size={14} />} label="Grid" compact />
              <ControlButton active={viewMode === 'list'} onClick={() => setViewMode('list')} icon={<LayoutList size={14} />} label="List" compact />
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${!selectedTag ? 'border-gray-950 bg-gray-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950' : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900'}`}
              >
                All tags
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selectedTag === tag ? 'border-gray-950 bg-gray-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950' : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900'}`}
                >
                  <Tag size={11} />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </section>

        {visibleNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center text-sm text-gray-400 dark:border-zinc-800 dark:bg-zinc-950/50">
            No notes match that filter.
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <NoteSection
                title="Pinned"
                icon={<Pin size={13} />}
                notes={pinned}
                viewMode={viewMode}
                onSelectNote={onSelectNote}
                onDeleteNote={onDeleteNote}
              />
            )}

            <NoteSection
              title={pinned.length > 0 ? 'All notes' : 'Latest notes'}
              notes={unpinned}
              viewMode={viewMode}
              onSelectNote={onSelectNote}
              onDeleteNote={onDeleteNote}
            />
          </>
        )}
      </div>
    </div>
  );
}

function NoteSection({
  title,
  icon,
  notes,
  viewMode,
  onSelectNote,
  onDeleteNote,
}: {
  title: string;
  icon?: React.ReactNode;
  notes: Note[];
  viewMode: ViewMode;
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}) {
  if (notes.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
        {icon}
        {title}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400 dark:bg-zinc-800">{notes.length}</span>
      </div>
      <motion.div
        className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-3'}
        variants={container}
        initial="hidden"
        animate="show"
      >
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} viewMode={viewMode} onSelect={onSelectNote} onDelete={onDeleteNote} />
        ))}
      </motion.div>
    </section>
  );
}

function NoteCard({
  note,
  viewMode,
  onSelect,
  onDelete,
}: {
  note: Note;
  viewMode: ViewMode;
  onSelect: (n: Note) => void;
  onDelete: (id: string) => void;
}) {
  const bg = COLOR_HEX[note.color] ?? COLOR_HEX.alabaster;
  const words = countWords(note.content);
  const preview = cleanPreview(note.content);

  return (
    <motion.article
      layoutId={`note-${note.id}`}
      variants={card}
      whileHover={{ y: viewMode === 'grid' ? -3 : 0, boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)' }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(note)}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-black/[0.05] shadow-sm transition-colors duration-200 dark:border-white/5 ${viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'p-5'}`}
      style={{ backgroundColor: bg }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/45 to-transparent" />
      {note.pinned && <Pin size={12} className="absolute right-4 top-4 rotate-45 text-gray-400" />}

      <div className={viewMode === 'list' ? 'min-w-0 flex-1' : 'flex min-h-[155px] flex-col'}>
        <div className="mb-3 flex items-center gap-2 pr-8">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10 bg-white/70" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{formatDate(note.updatedAt)}</span>
        </div>

        <h3 className="mb-2 line-clamp-2 text-[16px] font-bold leading-snug tracking-tight text-gray-950">
          {note.title || 'Untitled'}
        </h3>
        <p className={`${viewMode === 'list' ? 'line-clamp-1' : 'line-clamp-5 flex-1'} text-sm leading-relaxed text-gray-600`}>
          {preview || 'Empty note'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {note.tags?.slice(0, viewMode === 'list' ? 4 : 3).map((tag) => (
            <span key={tag} className="rounded-full bg-white/55 px-2 py-1 text-[10px] font-semibold text-gray-500 ring-1 ring-black/5">
              #{tag}
            </span>
          ))}
          {note.tags && note.tags.length > (viewMode === 'list' ? 4 : 3) && (
            <span className="text-[10px] font-semibold text-gray-400">+{note.tags.length - (viewMode === 'list' ? 4 : 3)}</span>
          )}
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-gray-400">{words} words</span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(note.id);
        }}
        className="absolute bottom-4 right-4 rounded-full bg-white/70 p-1.5 text-gray-400 opacity-0 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:text-red-500 group-hover:opacity-100"
        aria-label="Delete note"
      >
        <Trash2 size={13} />
      </button>
    </motion.article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100 dark:bg-zinc-900 dark:ring-zinc-800">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-950 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  icon,
  label,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${active ? 'bg-gray-950 text-white dark:bg-zinc-100 dark:text-zinc-950' : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-zinc-950 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-900'}`}
      aria-label={label}
      title={label}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </button>
  );
}

function cleanPreview(content: string) {
  return content
    .replace(/^#{1,6}\s/gm, '')
    .replace(/^- \[[ xX]\]\s/gm, '')
    .replace(/^[->]\s/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function countWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
