'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { Note, Task } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Perform initial migration if user is newly authenticated
      if (currentSession?.user) {
        migrateLocalData(currentSession.user.id);
      }
      
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        migrateLocalData(currentSession.user.id);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Wipe mock auth local storage session if exists
    localStorage.removeItem('notescape-auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper for migrating local data to Supabase
async function migrateLocalData(userId: string) {
  if (typeof window === 'undefined') return;

  const migratedKey = `notescape-migrated-${userId}`;
  if (localStorage.getItem(migratedKey) === 'true') {
    return; // Already migrated for this user
  }

  try {
    const localNotesRaw = localStorage.getItem('notescape-notes');
    const localTasksRaw = localStorage.getItem('notescape-tasks');

    const localNotes = localNotesRaw ? JSON.parse(localNotesRaw) : [];
    const localTasks = localTasksRaw ? JSON.parse(localTasksRaw) : [];

    if (localNotes.length === 0 && localTasks.length === 0) {
      localStorage.setItem(migratedKey, 'true');
      return;
    }

    console.log('Migrating local storage data to Supabase database for user:', userId);

    // Sync Notes
    if (localNotes.length > 0) {
      const notesToInsert = localNotes.map((note: Note) => ({
        id: note.id,
        user_id: userId,
        title: note.title,
        content: note.content,
        color: note.color,
        summary: note.summary || null,
        tags: note.tags || [],
        pinned: note.pinned || false,
        updated_at: note.updatedAt || Date.now(),
      }));

      // Upsert in Supabase notes table
      const { error: notesError } = await supabase.from('notes').upsert(notesToInsert);
      if (notesError) {
        console.error('Error migrating local notes to Supabase:', notesError);
        return; // Don't mark as migrated yet if there's an error
      }
    }

    // Sync Tasks
    if (localTasks.length > 0) {
      const tasksToInsert = localTasks.map((task: Task) => ({
        id: task.id,
        user_id: userId,
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'none',
        status: task.status || 'todo',
        color_tag: task.colorTag || 'slate',
        due_date: task.dueDate || null,
        linked_note_id: task.linkedNoteId || null,
        created_at: task.createdAt || Date.now(),
        updated_at: task.updatedAt || Date.now(),
      }));

      // Upsert in Supabase tasks table
      const { error: tasksError } = await supabase.from('tasks').upsert(tasksToInsert);
      if (tasksError) {
        console.error('Error migrating local tasks to Supabase:', tasksError);
        return;
      }
    }

    // Mark as migrated
    localStorage.setItem(migratedKey, 'true');
    console.log('Migration to Supabase completed successfully!');
  } catch (err) {
    console.error('Failed to run migration:', err);
  }
}
