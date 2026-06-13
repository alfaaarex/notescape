'use client';

import { motion } from 'framer-motion';
import { Trash2, Pin } from 'lucide-react';
import type { Note } from '@/lib/storage';

interface NoteGridProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

const COLOR_HEX: Record<string, string> = {
  alabaster: '#F9F9F6',
  sage:      '#EEF2EE',
  linen:     '#FDF8F5',
  slate:     '#F0F1F4',
  lavender:  '#F3EFFF',
};

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const card = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

export function NoteGrid({ notes, onSelectNote, onDeleteNote }: NoteGridProps) {
  const pinned   = notes.filter((n) => n.pinned);
  const unpinned = notes.filter((n) => !n.pinned);

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 py-24 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-600 dark:text-gray-400">No notes yet</p>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">Click the + button in the sidebar to create your first note</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 overflow-y-auto h-full">
      {pinned.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Pin size={12} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Pinned</span>
          </div>
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {pinned.map((note) => (
              <NoteCard key={note.id} note={note} onSelect={onSelectNote} onDelete={onDeleteNote} />
            ))}
          </motion.div>
          <div className="h-px bg-gray-100 dark:bg-zinc-800 mt-8 mb-6" />
        </section>
      )}

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {unpinned.map((note) => (
          <NoteCard key={note.id} note={note} onSelect={onSelectNote} onDelete={onDeleteNote} />
        ))}
      </motion.div>
    </div>
  );
}

function NoteCard({
  note,
  onSelect,
  onDelete,
}: {
  note: Note;
  onSelect: (n: Note) => void;
  onDelete: (id: string) => void;
}) {
  const bg = COLOR_HEX[note.color] ?? COLOR_HEX.alabaster;

  return (
    <motion.div
      layoutId={`note-${note.id}`}
      variants={card}
      onClick={() => onSelect(note)}
      className="group relative rounded-2xl border border-black/[0.04] dark:border-white/5 p-5 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
      style={{ backgroundColor: bg }}
    >
      {note.pinned && (
        <Pin size={11} className="absolute top-3.5 right-3.5 text-gray-400 rotate-45" />
      )}
      <div className="flex flex-col min-h-[120px]">
        <h3 className="text-[15px] font-bold text-gray-900 line-clamp-2 leading-snug tracking-tight mb-2">
          {note.title || 'Untitled'}
        </h3>
        <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed flex-1">
          {note.content.replace(/\n/g, ' ')}
        </p>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded-full bg-black/5 text-[10px] font-medium text-gray-500">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
            {new Date(note.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Delete on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
        className="absolute bottom-3.5 right-3.5 p-1.5 rounded-full bg-white/60 backdrop-blur-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:text-red-500 hover:bg-white shadow-sm"
        aria-label="Delete note"
      >
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
}