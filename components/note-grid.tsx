'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  FileText,
  Pin,
  Search,
  Sparkles,
  Trash2,
  List,
  Grid
} from 'lucide-react';
import type { Note } from '@/lib/storage';

interface NoteGridProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

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
      <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center te-noise bg-background">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl te-inset border-border border shadow-inner">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xl font-bold font-sans">NO NOTES YET</p>
          <p className="mt-2 max-w-sm text-xs font-mono text-muted-foreground">
            // Create a note from the sidebar and it will appear here with tags, pins, and quick previews.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background te-noise relative">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-5 sm:p-8 relative z-10">
        
        {/* Header Panel */}
        <section className="rounded-xl te-surface p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 te-label flex items-center gap-2">
                <span className="w-2 h-2 rounded-full te-led te-led-on" />
                SYSTEM / WORKSPACE
              </div>
              <h1 className="text-4xl font-bold tracking-tight uppercase te-emboss">Your Notes</h1>
              
              <div className="mt-5 flex flex-wrap gap-4 items-center">
                <StatGauge label="TOTAL NOTES" value={notes.length} max={100} />
                <StatGauge label="TOTAL WORDS" value={totalWords} max={10000} />
                <StatGauge label="PINNED" value={notes.filter((n) => n.pinned).length} max={notes.length} />
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[300px]">
              {/* Debossed Search */}
              <div className="relative rounded-lg te-inset flex items-center px-3 py-2">
                {/* Screw accents */}
                <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                <div className="absolute bottom-1 left-1 w-1 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                
                <Search className="h-4 w-4 text-muted-foreground mx-1" />
                <input
                  type="text"
                  placeholder="SEARCH..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm font-mono placeholder:text-muted-foreground/60 px-2 uppercase"
                />
              </div>

              {/* Controls Strip */}
              <div className="flex items-center gap-3">
                {/* Sort Toggle */}
                <div className="flex flex-1 p-1 rounded-lg te-inset gap-1">
                  {(['recent', 'title', 'length'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      className={`flex-1 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest transition-all ${
                        sortMode === mode ? 'te-surface text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
                {/* View Toggle */}
                <div className="flex p-1 rounded-lg te-inset gap-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'te-surface text-primary' : 'text-muted-foreground'}`}
                  >
                    <Grid size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'te-surface text-primary' : 'text-muted-foreground'}`}
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 overflow-x-auto pb-1">
              <span className="te-label mr-2">FILTER:</span>
              <button
                onClick={() => setSelectedTag(null)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-mono font-bold transition-all ${
                  selectedTag === null
                    ? 'te-button-primary'
                    : 'te-button text-muted-foreground'
                }`}
              >
                ALL
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-mono font-bold transition-all ${
                    selectedTag === tag
                      ? 'te-button-primary'
                      : 'te-button text-muted-foreground'
                  }`}
                >
                  #{tag.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Content */}
        {visibleNotes.length === 0 ? (
          <div className="py-20 text-center te-label text-muted-foreground">
            -- NO MATCHING RESULTS FOUND --
          </div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-8 pb-12">
            {pinned.length > 0 && (
              <div>
                <div className="mb-4 flex items-center gap-2 te-label">
                  <Pin size={10} className="text-primary" />
                  <span>PINNED NOTES</span>
                </div>
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                  {pinned.map((note) => (
                    <NoteCard key={note.id} note={note} onSelect={onSelectNote} onDelete={onDeleteNote} />
                  ))}
                </div>
              </div>
            )}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 te-label">
                    <FileText size={10} className="text-muted-foreground" />
                    <span>ALL NOTES</span>
                  </div>
                )}
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                  {unpinned.map((note) => (
                    <NoteCard key={note.id} note={note} onSelect={onSelectNote} onDelete={onDeleteNote} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onSelect, onDelete }: { note: Note; onSelect: (note: Note) => void; onDelete: (id: string) => void }) {
  const contentPreview = getPreview(note.content, 120);
  
  return (
    <motion.div
      layoutId={`note-${note.id}`}
      variants={card}
      whileHover={{ y: -2 }}
      className="group relative flex flex-col rounded-xl te-surface cursor-pointer hover:te-glow transition-all"
      onClick={() => onSelect(note)}
    >
      {/* Decorative tape / header strip */}
      <div className="h-2 w-full rounded-t-xl bg-gradient-to-r from-border/50 to-transparent border-b border-border/50" />
      
      <div className="flex flex-1 flex-col p-4 relative">
        {note.pinned && (
          <div className="absolute top-3 right-3 text-primary drop-shadow-md">
            <Pin size={14} fill="currentColor" className="rotate-45" />
          </div>
        )}
        
        <h3 className="text-base font-bold text-foreground line-clamp-2 pr-6">
          {note.title || 'Untitled'}
        </h3>
        
        <p className="mt-2 text-xs font-mono text-muted-foreground/80 leading-relaxed line-clamp-3 flex-1 break-words">
          {contentPreview || '...'}
        </p>

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {note.tags?.slice(0, 2).map((tag) => (
              <span key={tag} className="px-1.5 py-0.5 rounded te-inset text-[9px] font-mono font-bold tracking-wider text-muted-foreground truncate uppercase border-none bg-muted/50">
                {tag}
              </span>
            ))}
            {note.tags && note.tags.length > 2 && (
              <span className="text-[9px] font-mono text-muted-foreground">+{note.tags.length - 2}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-[9px] font-mono text-muted-foreground uppercase flex items-center gap-1">
              <Clock size={9} />
              {formatTimeAgo(note.updatedAt)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="p-1.5 rounded-full bg-background border border-border shadow-sm text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white hover:border-destructive -mr-1"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatGauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
      <div className="flex flex-col">
        <span className="text-[9px] font-mono font-bold text-muted-foreground tracking-widest">{label}</span>
        <span className="text-sm font-mono font-bold text-primary leading-none mt-0.5">{value}</span>
      </div>
      <div className="w-16 h-1.5 rounded-full te-inset overflow-hidden">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function countWords(str: string): number {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

function getPreview(str: string, length = 120): string {
  const plainText = str.replace(/[#*`_\[\]()]/g, '').trim();
  if (plainText.length <= length) return plainText;
  return plainText.substring(0, length) + '...';
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  if (diffHours < 24) return `${diffHours}H AGO`;
  if (diffDays < 7) return `${diffDays}D AGO`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}
