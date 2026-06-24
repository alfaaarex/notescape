'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotes } from '@/lib/storage';
import { useTasks } from '@/lib/tasks';
import { useAuth } from '@/components/auth-provider';
import type { Task } from '@/lib/types';
import type { NlpParsedTask } from '@/components/nlp-task-input';
import { Sidebar, SidebarView } from '@/components/sidebar';
import { NoteGrid } from '@/components/note-grid';
import { Editor } from '@/components/editor';
import { TaskBoard } from '@/components/task-board';
import { TaskCalendar } from '@/components/task-calendar';
import { TaskEditorModal } from '@/components/task-editor-modal';
import { CommandPalette } from '@/components/command-palette';
import { SettingsModal } from '@/components/settings-modal';
import { NotificationBanner } from '@/components/notification-banner';
import { Menu, X } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { 
    notes, 
    loading: notesLoading, 
    saveNote, 
    deleteNote, 
    togglePin, 
    togglePublicShare,
    getCollaborators,
    addCollaborator,
    removeCollaborator,
    updateCollaborator
  } = useNotes();
  const { tasks, loading: tasksLoading, saveTask, deleteTask, updateTaskStatus } = useTasks();

  const [view, setView]                       = useState<SidebarView>('notes');
  const [selectedNoteId, setSelectedNoteId]   = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen]     = useState(false);
  const [editingTask, setEditingTask]         = useState<Task | null>(null);
  const [prefillDate, setPrefillDate]         = useState<string | undefined>();
  const [nlpPrefill, setNlpPrefill]           = useState<NlpParsedTask | null>(null);
  const [cmdOpen, setCmdOpen]                 = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Auth guard — redirect to login if no session
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;
  const showEditor   = view === 'notes' && selectedNoteId !== null;

  const handleCreateNote = useCallback(() => {
    setSelectedNoteId('new');
    setView('notes');
    setMobileSidebarOpen(false);
  }, []);

  const handleSelectNote = useCallback((note: { id: string }) => {
    setSelectedNoteId(note.id);
    setView('notes');
    setMobileSidebarOpen(false);
  }, []);

  const handleOpenTaskModal = useCallback((date?: string) => {
    setEditingTask(null);
    setNlpPrefill(null);
    setPrefillDate(date);
    setTaskModalOpen(true);
  }, []);

  const handleNlpTask = useCallback((parsed: NlpParsedTask) => {
    setEditingTask(null);
    setNlpPrefill(parsed);
    setPrefillDate(undefined);
    setTaskModalOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setPrefillDate(undefined);
    setTaskModalOpen(true);
  }, []);

  const isLoading = authLoading || notesLoading || tasksLoading || !user;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background te-noise te-grid-bg">
        <div className="flex flex-col items-center gap-5 te-surface rounded-2xl px-10 py-8 relative">
          <div className="absolute top-2 left-2 te-screw" />
          <div className="absolute top-2 right-2 te-screw" />
          <div className="absolute bottom-2 left-2 te-screw" />
          <div className="absolute bottom-2 right-2 te-screw" />
          <div className="te-lcd rounded-lg px-6 py-3 text-[11px] font-bold tracking-[0.2em] uppercase">
            BOOTING...
          </div>
          <div className="w-32 h-1.5 rounded-full te-inset overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <p className="te-label">NOTESCAPE / SYSTEM INIT</p>
        </div>
      </div>
    );
  }

  const noteForEditor = selectedNoteId === 'new' ? null : selectedNote;

  return (
    <>
      <div className="flex h-screen bg-background font-sans overflow-hidden p-1.5 sm:p-2 md:p-3 te-chassis">
        <div className="flex flex-1 min-w-0 overflow-hidden rounded-xl te-bezel relative te-noise flex-row">

        {/* ── Mobile sidebar overlay ── */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <motion.div
              key="mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/50 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Sidebar ── */}
        {/* Desktop: always visible. Mobile: slide-in drawer. */}
        <div className={`
          fixed top-0 left-0 md:relative z-40 md:z-auto h-full overflow-hidden
          transition-transform duration-300 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar
            notes={notes}
            activeView={view}
            selectedNoteId={selectedNoteId}
            onSelectNote={handleSelectNote}
            onCreateNote={handleCreateNote}
            onChangeView={(v) => {
              setView(v);
              if (v !== 'notes') setSelectedNoteId(null);
              setMobileSidebarOpen(false);
            }}
            onOpenCommand={() => { setCmdOpen(true); setMobileSidebarOpen(false); }}
            onOpenSettings={() => { setSettingsOpen(true); setMobileSidebarOpen(false); }}
          />
        </div>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 overflow-hidden relative flex flex-col bg-background">
          {/* Mobile top bar — hardware status strip */}
          <div className="flex md:hidden items-center h-11 px-3 border-b border-border flex-shrink-0 te-inset rounded-none">
            <button
              onClick={() => setMobileSidebarOpen((o) => !o)}
              className="p-2 rounded-lg te-button text-muted-foreground"
            >
              {mobileSidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <div className="ml-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full te-led te-led-on" />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-foreground">{view}</span>
            </div>
            <span className="ml-auto te-module-label">NS-01</span>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {view === 'notes' && showEditor ? (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex"
                >
                  <Editor
                    note={noteForEditor}
                    onSave={async (note) => {
                      await saveNote(note);
                      if (selectedNoteId === 'new') setSelectedNoteId(note.id);
                    }}
                    onDelete={async () => {
                      if (selectedNoteId && selectedNoteId !== 'new') await deleteNote(selectedNoteId);
                      setSelectedNoteId(null);
                    }}
                    onClose={() => setSelectedNoteId(null)}
                    onTogglePin={togglePin}
                    onTogglePublicShare={togglePublicShare}
                    getCollaborators={getCollaborators}
                    addCollaborator={addCollaborator}
                    removeCollaborator={removeCollaborator}
                    updateCollaborator={updateCollaborator}
                  />
                </motion.div>
              ) : view === 'notes' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 overflow-y-auto"
                >
                  <NoteGrid
                    notes={notes}
                    onSelectNote={handleSelectNote}
                    onDeleteNote={async (id) => {
                      await deleteNote(id);
                      if (selectedNoteId === id) setSelectedNoteId(null);
                    }}
                  />
                </motion.div>
              ) : view === 'tasks' ? (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex flex-col overflow-hidden"
                >
                  <TaskBoard
                    tasks={tasks}
                    onNewTask={() => handleOpenTaskModal()}
                    onNlpTask={handleNlpTask}
                    onEditTask={handleEditTask}
                    onDeleteTask={deleteTask}
                    onUpdateStatus={updateTaskStatus}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex flex-col overflow-hidden"
                >
                  <TaskCalendar
                    tasks={tasks}
                    onNewTask={handleOpenTaskModal}
                    onEditTask={handleEditTask}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
        </div>
      </div>

      <TaskEditorModal
        open={taskModalOpen}
        task={editingTask}
        notes={notes}
        prefillDate={prefillDate}
        nlpPrefill={nlpPrefill}
        onSave={saveTask}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null); setNlpPrefill(null); }}
      />

      <CommandPalette
        open={cmdOpen}
        notes={notes}
        tasks={tasks}
        onClose={() => setCmdOpen(false)}
        onSelectNote={handleSelectNote}
        onSelectTask={handleEditTask}
        onCreateNote={handleCreateNote}
        onCreateTask={() => handleOpenTaskModal()}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <NotificationBanner />
    </>
  );
}
