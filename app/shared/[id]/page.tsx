'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { Note } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function SharedNotePage() {
  const params = useParams();
  const id = params.id as string;
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSharedNote = async () => {
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('id', id)
          .eq('is_public', true)
          .single();

        if (error) throw error;

        if (data) {
          setNote({
            id: data.id,
            title: data.title,
            content: data.content,
            color: data.color,
            summary: data.summary,
            tags: data.tags || [],
            pinned: data.pinned || false,
            updatedAt: data.updated_at,
            isPublic: data.is_public,
            shareToken: data.share_token,
          });
        }
      } catch (err: unknown) {
        console.error('Error fetching shared note:', err);
        setError('Note not found or is not public.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchSharedNote();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f5] dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f5] dark:bg-zinc-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-zinc-200">Access Denied</h2>
          <p className="text-gray-500 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-zinc-950 px-4 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                Shared Note
              </span>
              <span className="text-sm text-gray-500 dark:text-zinc-400">
                Last updated: {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-50">{note.title}</h1>
            {note.summary && (
              <p className="text-gray-500 mt-2 italic dark:text-zinc-400">{note.summary}</p>
            )}
            
            <div className="mt-8 border-t border-gray-100 pt-8 dark:border-zinc-800">
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-gray-700 dark:text-zinc-300">
                {note.content}
              </div>
            </div>

            {note.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2 border-t border-gray-100 pt-6 dark:border-zinc-800">
                {note.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-md border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600 transition-colors dark:border-zinc-700 dark:text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
