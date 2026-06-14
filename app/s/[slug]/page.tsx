'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

export default function ShortLinkPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    const resolve = async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('id')
        .eq('share_slug', slug)
        .eq('is_public', true)
        .single();

      if (error || !data) {
        setError('This link is invalid or the note is no longer public.');
        return;
      }
      router.replace(`/shared/${data.id}`);
    };
    resolve();
  }, [slug, router]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f5] dark:bg-zinc-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-zinc-200">Link Not Found</h2>
          <p className="text-gray-500 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#f7f7f5] dark:bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}
