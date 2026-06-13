import { useState, useEffect, useCallback } from 'react';
import type { Note } from './types';
import { supabase } from './supabaseClient';
import { useAuth } from '@/components/auth-provider';

export type { Note };

const STORAGE_KEY = 'notescape-notes';

export const useNotes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load notes
  useEffect(() => {
    const fetchNotes = async () => {
      setLoading(true);
      if (user) {
        try {
          const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('updated_at', { ascending: false });

          if (error) {
            console.error('Error fetching notes from Supabase:', error);
          } else if (data) {
            // Map table fields to Note interface
            const mapped: Note[] = data.map((n: any) => ({
              id: n.id,
              title: n.title,
              content: n.content,
              color: n.color,
              summary: n.summary,
              tags: n.tags || [],
              pinned: n.pinned || false,
              updatedAt: n.updated_at,
            }));
            setNotes(mapped);
          }
        } catch (err) {
          console.error('Failed to load notes from Supabase:', err);
        }
      } else {
        // Fall back to local storage
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed: Note[] = stored ? JSON.parse(stored) : [];
            const migrated = parsed.map((n) => ({
              ...n,
              tags: n.tags ?? [],
              pinned: n.pinned ?? false,
            }));
            setNotes(migrated);
          } catch {
            setNotes([]);
          }
        }
      }
      setLoading(false);
    };

    fetchNotes();
  }, [user]);

  // Persist locally
  const persistLocal = useCallback((updated: Note[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        console.error('Failed to save notes to local storage');
      }
    }
  }, []);

  const saveNote = useCallback(
    async (note: Note) => {
      // Update state first for instant UX feel
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === note.id);
        const next = [...prev];
        if (idx >= 0) next[idx] = note;
        else next.push(note);
        if (!user) {
          persistLocal(next);
        }
        return next;
      });

      // Sync with Supabase
      if (user) {
        const { error } = await supabase.from('notes').upsert({
          id: note.id,
          user_id: user.id,
          title: note.title,
          content: note.content,
          color: note.color,
          summary: note.summary || null,
          tags: note.tags,
          pinned: note.pinned,
          updated_at: note.updatedAt,
        });

        if (error) {
          console.error('Error saving note to Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (!user) {
          persistLocal(next);
        }
        return next;
      });

      if (user) {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) {
          console.error('Error deleting note from Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  const togglePin = useCallback(
    async (id: string) => {
      let updatedNote: Note | undefined;

      setNotes((prev) => {
        const next = prev.map((n) => {
          if (n.id === id) {
            updatedNote = { ...n, pinned: !n.pinned, updatedAt: Date.now() };
            return updatedNote;
          }
          return n;
        });
        if (!user) {
          persistLocal(next);
        }
        return next;
      });

      if (user && updatedNote) {
        const { error } = await supabase
          .from('notes')
          .update({ pinned: updatedNote.pinned, updated_at: updatedNote.updatedAt })
          .eq('id', id);

        if (error) {
          console.error('Error toggling pin in Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  return { notes, loading, saveNote, deleteNote, togglePin };
};