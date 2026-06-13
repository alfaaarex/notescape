import { useState, useEffect, useCallback } from 'react';
import type { Task } from './types';
import { supabase } from './supabaseClient';
import { useAuth } from '@/components/auth-provider';

const STORAGE_KEY = 'notescape-tasks';

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      if (user) {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error fetching tasks from Supabase:', error);
          } else if (data) {
            const mapped: Task[] = data.map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description || '',
              priority: t.priority,
              status: t.status,
              colorTag: t.color_tag,
              dueDate: t.due_date || null,
              linkedNoteId: t.linked_note_id || null,
              createdAt: t.created_at,
              updatedAt: t.updated_at,
            }));
            setTasks(mapped);
          }
        } catch (err) {
          console.error('Failed to load tasks from Supabase:', err);
        }
      } else {
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            setTasks(stored ? JSON.parse(stored) : []);
          } catch {
            setTasks([]);
          }
        }
      }
      setLoading(false);
    };

    fetchTasks();
  }, [user]);

  const persistLocal = useCallback((updated: Task[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      console.error('Failed to persist tasks locally');
    }
  }, []);

  const saveTask = useCallback(
    async (task: Task) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        const next = [...prev];
        if (idx >= 0) next[idx] = task;
        else next.push(task);
        if (!user) {
          persistLocal(next);
        }
        return next;
      });

      if (user) {
        const { error } = await supabase.from('tasks').upsert({
          id: task.id,
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          color_tag: task.colorTag,
          due_date: task.dueDate || null,
          linked_note_id: task.linkedNoteId || null,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
        });

        if (error) {
          console.error('Error saving task to Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (!user) {
          persistLocal(next);
        }
        return next;
      });

      if (user) {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) {
          console.error('Error deleting task from Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: Task['status']) => {
      let updatedTask: Task | undefined;

      setTasks((prev) => {
        const next = prev.map((t) => {
          if (t.id === id) {
            updatedTask = { ...t, status, updatedAt: Date.now() };
            return updatedTask;
          }
          return t;
        });
        if (!user) {
          persistLocal(next);
        }
        return next;
      });

      if (user && updatedTask) {
        const { error } = await supabase
          .from('tasks')
          .update({ status: updatedTask.status, updated_at: updatedTask.updatedAt })
          .eq('id', id);

        if (error) {
          console.error('Error updating task status in Supabase:', error);
          throw error;
        }
      }
    },
    [user, persistLocal],
  );

  return { tasks, loading, saveTask, deleteTask, updateTaskStatus };
};
