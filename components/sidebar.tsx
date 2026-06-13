'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  CheckSquare,
  CalendarDays,
  Plus,
  Search,
  Command,
  Pin,
  LogOut,
} from 'lucide-react';
import type { Note } from '@/lib/storage';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/components/auth-provider';

export type SidebarView = 'notes' | 'tasks' | 'calendar';

interface SidebarProps {
  notes: Note[];
  activeView: SidebarView;
  selectedNoteId: string | null;
  onSelectNote: (note: Note) => void;
  onCreateNote: () => void;
  onChangeView: (view: SidebarView) => void;
  onOpenCommand: () => void;
  onOpenSettings?: () => void;
}

const NAV_ITEMS: Array<{ id: SidebarView; label: string; icon: React.ReactNode }> = [
  { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} /> },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

export function Sidebar({
  notes,
  activeView,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onChangeView,
  onOpenCommand,
  onOpenSettings,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags || []))).sort();

  const pinnedNotes = notes.filter((n) => n.pinned && (!selectedTag || n.tags?.includes(selectedTag)));
  const unpinnedNotes = notes.filter((n) => !n.pinned && (!selectedTag || n.tags?.includes(selectedTag)));

  const filteredNotes =
    searchQuery.trim()
      ? notes.filter(
          (n) =>
            (n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.content.toLowerCase().includes(searchQuery.toLowerCase())) &&
            (!selectedTag || n.tags?.includes(selectedTag)),
        )
      : null;

  const notesToRender = filteredNotes ?? unpinnedNotes;

  return (
    <aside className="w-60 bg-[#f7f7f5] dark:bg-zinc-950 border-r border-gray-200/60 dark:border-zinc-800 flex flex-col">
      {/* Logo + Command Button */}
      <div className="flex h-14 items-center justify-between px-4">
        <span className="text-[13px] font-bold tracking-widest text-gray-400 dark:text-zinc-500 uppercase select-none">
          Notescape
        </span>
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-400 dark:text-zinc-500 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors text-[11px]"
          title="Open Command Palette (Cmd+K)"
        >
          <Command size={11} />
          <span>K</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200/60 dark:bg-zinc-800 text-gray-400">
          <Search size={13} className="flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-xs text-gray-600 dark:text-gray-400 placeholder:text-gray-400 dark:placeholder:text-zinc-600 border-none outline-none"
          />
        </div>
      </div>

      {/* Nav */}
      <div className="px-2 mb-4 flex flex-col gap-0.5 relative">
        {NAV_ITEMS.map((nav) => {
          const isActive = activeView === nav.id;
          return (
            <button
              key={nav.id}
              onClick={() => { onChangeView(nav.id); setSelectedTag(null); }}
              className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 z-10 ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-lg shadow-sm -z-10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              {nav.icon}
              {nav.label}
            </button>
          );
        })}
      </div>

      {/* Tags */}
      {activeView === 'notes' && allTags.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                  selectedTag === tag
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                    : 'bg-transparent text-gray-500 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes List */}
      {activeView === 'notes' && (
        <>
          <div className="flex items-center justify-between px-4 mb-2">
            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
              {searchQuery ? 'Results' : 'Notes'}
            </span>
            <button
              onClick={onCreateNote}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
              aria-label="New note"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <motion.div
              className="flex flex-col gap-0.5"
              variants={container}
              initial="hidden"
              animate="show"
              key={searchQuery}
            >
              {/* Pinned */}
              {!searchQuery && pinnedNotes.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
                    <Pin size={9} />
                    Pinned
                  </div>
                  {pinnedNotes.map((note) => (
                    <NoteLink
                      key={note.id}
                      note={note}
                      isSelected={selectedNoteId === note.id}
                      onClick={() => onSelectNote(note)}
                    />
                  ))}
                  <div className="h-px bg-gray-200/80 dark:bg-zinc-800 mx-3 my-1" />
                </>
              )}

              {/* All / Filtered notes */}
              {notesToRender.map((note) => (
                <NoteLink
                  key={note.id}
                  note={note}
                  isSelected={selectedNoteId === note.id}
                  onClick={() => onSelectNote(note)}
                />
              ))}

              {notesToRender.length === 0 && (
                <p className="px-3 py-6 text-xs text-gray-400 text-center">
                  {searchQuery ? 'No notes found' : 'No notes yet'}
                </p>
              )}
            </motion.div>
          </div>
        </>
      )}

      {activeView !== 'notes' && <div className="flex-1" />}

      {/* User Profile Section */}
      {user && (
        <div 
          onClick={onOpenSettings}
          className="px-3 py-2 border-t border-gray-200/60 dark:border-zinc-800 flex items-center justify-between gap-2 bg-gray-50/50 dark:bg-zinc-900/10 hover:bg-gray-200/50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors duration-150"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-zinc-950 dark:bg-zinc-100 border border-zinc-200/10 flex items-center justify-center text-zinc-100 dark:text-zinc-950 text-[10px] font-semibold select-none flex-shrink-0 overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-medium text-gray-700 dark:text-zinc-200 truncate">
                {userName}
              </span>
              <span className="text-[9px] text-gray-400 dark:text-zinc-500 truncate">
                {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); signOut(); }}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200/60 dark:hover:bg-zinc-900 transition-all active:scale-95"
            title="Sign Out"
          >
            <LogOut size={12} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/60 dark:border-zinc-800">
        <span className="text-[10px] font-medium text-gray-400 dark:text-zinc-600">
          {notes.length} notes
        </span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function NoteLink({
  note,
  isSelected,
  onClick,
}: {
  note: Note;
  isSelected: boolean;
  onClick: () => void;
}) {
  const COLOR_HEX: Record<string, string> = {
    alabaster: '#F9F9F6', sage: '#EEF2EE', linen: '#FDF8F5',
    slate: '#F0F1F4', lavender: '#F3EFFF',
  };
  const dotColor = COLOR_HEX[note.color] ?? '#e5e7eb';

  return (
    <motion.button
      variants={item}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 ${
        isSelected
          ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 shadow-sm'
          : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-900/60 hover:text-gray-700 dark:hover:text-zinc-200'
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black/5" style={{ backgroundColor: dotColor }} />
      <span className="flex-1 text-xs font-medium truncate">
        {note.title || 'Untitled'}
      </span>
      {note.pinned && <Pin size={9} className="flex-shrink-0 text-gray-400" />}
    </motion.button>
  );
}