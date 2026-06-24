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
  { id: 'notes', label: 'NOTES', icon: <FileText size={15} /> },
  { id: 'tasks', label: 'TASKS', icon: <CheckSquare size={15} /> },
  { id: 'calendar', label: 'CALENDAR', icon: <CalendarDays size={15} /> },
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
    <aside className="w-60 h-full bg-[#EDE8DC] dark:bg-[#1E1E1E] border-r border-[#D4CCBA] dark:border-[#333] flex flex-col overflow-hidden relative te-noise">
      {/* Logo + Command Button */}
      <div className="relative z-10 flex h-14 items-center justify-between px-4 border-b border-[#D4CCBA] dark:border-[#333]">
        <div className="flex items-center gap-2">
          <div className="te-knob flex-shrink-0 hidden sm:block" aria-hidden />
          <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#6B6358] dark:text-[#8A8070] uppercase select-none te-emboss">
            NOTESCAPE
          </span>
        </div>
        <button
          onClick={onOpenCommand}
          className="flex items-center gap-1 px-2 py-1 rounded-md te-button text-[#8A8070] text-[10px] font-mono font-bold"
          title="Open Command Palette (Cmd+K)"
        >
          <Command size={10} />
          <span>K</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative z-10 px-3 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg te-inset">
          <Search size={13} className="flex-shrink-0 text-[#B8AFA0] dark:text-[#555]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-[#B8AFA0] dark:placeholder:text-[#555] border-none outline-none font-mono"
          />
        </div>
      </div>

      {/* Nav */}
      <div className="relative z-10 px-2 mb-4 flex flex-col gap-1">
        {NAV_ITEMS.map((nav) => {
          const isActive = activeView === nav.id;
          return (
            <button
              key={nav.id}
              onClick={() => { onChangeView(nav.id); setSelectedTag(null); }}
              className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-mono font-bold tracking-wider transition-all duration-150 ${
                isActive
                  ? 'text-[#FF6B35] te-surface'
                  : 'text-[#8A8070] hover:text-foreground hover:bg-[#E8E2D6] dark:hover:bg-[#2A2A2A]'
              }`}
            >
              {/* Orange active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-full bg-[#FF6B35]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
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
        <div className="relative z-10 px-4 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded te-button text-[10px] font-mono font-bold tracking-wider transition-all ${
                  selectedTag === tag
                    ? 'bg-[#FF6B35] !text-white !border-[#D04E20]'
                    : 'text-[#8A8070]'
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
          <div className="relative z-10 flex items-center justify-between px-4 mb-2">
            <span className="te-label">
              {searchQuery ? 'RESULTS' : 'NOTES'}
            </span>
            <button
              onClick={onCreateNote}
              className="p-1.5 rounded-md te-button text-[#8A8070] hover:text-[#FF6B35] transition-colors"
              aria-label="New note"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto px-2 pb-4">
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
                  <div className="flex items-center gap-1.5 px-3 py-1 te-label">
                    <Pin size={9} />
                    PINNED
                  </div>
                  {pinnedNotes.map((note) => (
                    <NoteLink
                      key={note.id}
                      note={note}
                      isSelected={selectedNoteId === note.id}
                      onClick={() => onSelectNote(note)}
                    />
                  ))}
                  <div className="te-divider mx-3 my-1" />
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
                <p className="px-3 py-6 text-xs text-[#B8AFA0] text-center font-mono">
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
          className="relative z-10 px-3 py-2 border-t border-[#D4CCBA] dark:border-[#333] flex items-center justify-between gap-2 hover:bg-[#E8E2D6] dark:hover:bg-[#2A2A2A] cursor-pointer transition-colors duration-150"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full te-inset flex items-center justify-center text-[10px] font-mono font-bold select-none flex-shrink-0 overflow-hidden text-[#8A8070]">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-foreground truncate">
                {userName}
              </span>
              <span className="text-[9px] font-mono text-[#B8AFA0] dark:text-[#555] truncate">
                {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); signOut(); }}
            className="p-1 rounded-md te-button text-[#B8AFA0] hover:text-[#DC2626] transition-all active:scale-95"
            title="Sign Out"
          >
            <LogOut size={12} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-t border-[#D4CCBA] dark:border-[#333]">
        <div className="flex items-center gap-2">
          <span className="te-label">{notes.length}</span>
          {/* Mini VU-meter bar */}
          <div className="w-12 h-1.5 rounded-full bg-[#E8E2D6] dark:bg-[#333] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#FF6B35]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(notes.length * 10, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
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
  return (
    <motion.button
      variants={item}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 ${
        isSelected
          ? 'te-surface text-foreground'
          : 'text-[#8A8070] hover:bg-[#E8E2D6] dark:hover:bg-[#2A2A2A] hover:text-foreground'
      }`}
    >
      {/* Orange dot indicator for selected */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        isSelected ? 'bg-[#FF6B35] shadow-[0_0_6px_rgba(255,107,53,0.4)]' : 'bg-[#D4CCBA] dark:bg-[#3A3A3A]'
      }`} />
      <span className="flex-1 text-xs font-medium truncate">
        {note.title || 'Untitled'}
      </span>
      {note.pinned && <Pin size={9} className="flex-shrink-0 text-[#B8AFA0]" />}
    </motion.button>
  );
}