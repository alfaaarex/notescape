import { useState, useEffect, useCallback } from 'react';
import type { Note, Collaborator, CollaboratorRole } from './types';
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
              userId: n.user_id,
              title: n.title,
              content: n.content,
              color: n.color,
              summary: n.summary,
              tags: n.tags || [],
              pinned: n.pinned || false,
              updatedAt: n.updated_at,
              isPublic: n.is_public || false,
              shareToken: n.share_token || undefined,
              shareSlug: n.share_slug || undefined,
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
        // Build the upsert payload — omit share_token if it's undefined
        // so Supabase uses the column's gen_random_uuid() default on insert.
        const payload: Record<string, unknown> = {
          id: note.id,
          user_id: user.id,
          title: note.title,
          content: note.content,
          color: note.color,
          summary: note.summary || null,
          tags: note.tags,
          pinned: note.pinned,
          updated_at: note.updatedAt,
          is_public: note.isPublic ?? false,
        };
        // Only include share_token when it's a real value
        if (note.shareToken) {
          payload.share_token = note.shareToken;
        }
        // Assign a short slug when one is provided
        if (note.shareSlug) {
          payload.share_slug = note.shareSlug;
        }

        const { error } = await supabase.from('notes').upsert(payload);

        if (error) {
          console.error('Error saving note to Supabase:', error.message, error.details, error.hint);
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

  const togglePublicShare = useCallback(
    async (id: string, isPublic: boolean, shareSlug?: string) => {
      let updatedNote: Note | undefined;

      setNotes((prev) => {
        const next = prev.map((n) => {
          if (n.id === id) {
            updatedNote = { ...n, isPublic, shareSlug: shareSlug ?? n.shareSlug, updatedAt: Date.now() };
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
        const patch: Record<string, unknown> = { is_public: isPublic, updated_at: updatedNote.updatedAt };
        if (shareSlug) patch.share_slug = shareSlug;
        const { error } = await supabase
          .from('notes')
          .update(patch)
          .eq('id', id);

        if (error) {
          console.error('Error toggling share state in Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  const getCollaborators = useCallback(async (noteId: string): Promise<Collaborator[]> => {
    if (!user) return [];

    // Step 1: fetch collaborator rows
    const { data: collabData, error: collabError } = await supabase
      .from('note_collaborators')
      .select('note_id, user_id, role, created_at')
      .eq('note_id', noteId);

    if (collabError) {
      console.error('Error fetching collaborators:', collabError);
      return [];
    }
    if (!collabData || collabData.length === 0) return [];

    // Step 2: fetch profiles for those user IDs in one query
    const userIds = collabData.map((c: any) => c.user_id);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    for (const p of profileData || []) {
      profileMap[p.id] = p;
    }

    return collabData.map((c: any) => {
      const p = profileMap[c.user_id];
      return {
        noteId: c.note_id,
        userId: c.user_id,
        role: c.role,
        createdAt: c.created_at,
        profile: p ? {
          id: p.id,
          email: p.email,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
        } : undefined,
      };
    });
  }, [user]);

  const addCollaborator = useCallback(async (noteId: string, email: string, role: CollaboratorRole) => {
    if (!user) return { error: 'Not authenticated' };
    
    // First find the user by email in profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (profileError || !profiles || profiles.length === 0) {
      return { error: 'User not found' };
    }
    
    const targetUserId = profiles[0].id;
    if (targetUserId === user.id) {
      return { error: 'Cannot add yourself as a collaborator' };
    }

    const { error } = await supabase
      .from('note_collaborators')
      .insert({ note_id: noteId, user_id: targetUserId, role });
      
    if (error) {
      console.error('Error adding collaborator:', error);
      return { error: 'Failed to add collaborator' };
    }
    
    return { success: true };
  }, [user]);

  const removeCollaborator = useCallback(async (noteId: string, targetUserId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('note_collaborators')
      .delete()
      .match({ note_id: noteId, user_id: targetUserId });
      
    if (error) {
      console.error('Error removing collaborator:', error);
    }
  }, [user]);

  const updateCollaborator = useCallback(async (noteId: string, targetUserId: string, role: CollaboratorRole) => {
    if (!user) return;
    const { error } = await supabase
      .from('note_collaborators')
      .update({ role })
      .match({ note_id: noteId, user_id: targetUserId });
      
    if (error) {
      console.error('Error updating collaborator:', error);
    }
  }, [user]);

  return { 
    notes, 
    loading, 
    saveNote, 
    deleteNote, 
    togglePin, 
    togglePublicShare: togglePublicShare as (id: string, isPublic: boolean, shareSlug?: string) => Promise<void>,
    getCollaborators,
    addCollaborator,
    removeCollaborator,
    updateCollaborator
  };
};