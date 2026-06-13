import { useState, useEffect, useCallback } from 'react';

// Define the Note interface
export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  summary?: string;
  updatedAt: number; // timestamp
}

// Storage key for localStorage
const STORAGE_KEY = 'notes-app-notes';

// Simulated async service for localStorage
export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load notes from localStorage on mount
  useEffect(() => {
    const loadNotes = async () => {
      // Check if we're on the client (to avoid SSR issues)
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            setNotes(parsed);
          } else {
            setNotes([]);
          }
        } catch (error) {
          console.error('Failed to load notes from localStorage:', error);
          setNotes([]);
        }
      }
      setLoading(false);
    };

    loadNotes();
  }, []);

  // Save notes to localStorage
  const saveNotes = useCallback(async (updatedNotes: Note[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes));
        setNotes(updatedNotes);
      } catch (error) {
        console.error('Failed to save notes to localStorage:', error);
      }
    }
  }, []);

  // Get all notes
  const getNotes = useCallback(async (): Promise<Note[]> => {
    // Return a copy of the current state
    return [...notes];
  }, [notes]);

  // Save a single note (create or update)
  const saveNote = useCallback(async (note: Note) => {
    setNotes(prev => {
      const existingIndex = prev.findIndex(n => n.id === note.id);
      const updatedNotes = [...prev];
      if (existingIndex >= 0) {
        updatedNotes[existingIndex] = note;
      } else {
        updatedNotes.push(note);
      }
      // Persist to localStorage
      saveNotes(updatedNotes);
      return updatedNotes;
    });
  }, [saveNotes]);

  // Delete a note by ID
  const deleteNote = useCallback(async (id: string) => {
    setNotes(prev => {
      const updatedNotes = prev.filter(note => note.id !== id);
      saveNotes(updatedNotes);
      return updatedNotes;
    });
  }, [saveNotes]);

  return {
    notes,
    loading,
    getNotes,
    saveNote,
    deleteNote,
  };
};