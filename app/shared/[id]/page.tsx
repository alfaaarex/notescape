'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { Note } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      } catch (err: any) {
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <Card className="shadow-lg border-t-4" style={{ borderTopColor: note.color || 'hsl(var(--primary))' }}>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Badge variant="secondary">Shared Note</Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(note.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <CardTitle className="text-3xl font-bold">{note.title}</CardTitle>
          {note.summary && (
            <p className="text-muted-foreground mt-2 italic">{note.summary}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none mt-6 whitespace-pre-wrap">
            {note.content}
          </div>
          {note.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 border-t pt-4">
              {note.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
