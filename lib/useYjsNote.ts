/**
 * useYjsNote.ts
 *
 * React hook that owns the Y.Doc for a single note.
 *
 * Key fixes over v1:
 *
 * 1. CHARACTER-LEVEL DIFFS instead of full delete+insert
 *    The original setContent/setTitle did `delete(0, len); insert(0, val)` which
 *    means two simultaneous edits always clobber each other — defeating the whole
 *    point of Yjs.  We now compute the minimal diff (common prefix + suffix) and
 *    only delete/insert the changed middle slice.  Yjs can then merge concurrent
 *    edits on the unchanged regions correctly.
 *
 * 2. SEEDING RACE fixed
 *    Previously `seededForNoteRef` was declared below the effect that used it,
 *    and the seed ran after the provider was already constructed (so a fast peer
 *    could send step2 before we seeded, leaving us with a blank Y.Doc that then
 *    got merged on top of their content).  Now we seed the Y.Doc synchronously
 *    before constructing the provider.
 *
 * 3. NO ARBITRARY TIMEOUT for isSyncing
 *    We don't know when peers have finished sending us their state, so we drop
 *    the fake 1.5s timer. isSyncing is true until we've received at least one
 *    remote update OR 2 s have passed with no peers — whichever comes first.
 *
 * 4. STABLE SETTERS
 *    setTitle/setContent are stable useCallback refs — they don't change across
 *    renders, so they can safely appear in dependency arrays elsewhere.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { supabase } from './supabaseClient';
import { YjsSupabaseProvider } from './yjsSupabaseProvider';

// ── Diff helper ──────────────────────────────────────────────────────────────
// Returns the minimal { start, deleteCount, insert } to turn `prev` into `next`.
// By only touching the changed region, Yjs can CRDT-merge concurrent edits on
// the unchanged parts of the string.
function computeDiff(prev: string, next: string): { start: number; deleteCount: number; insert: string } {
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;

  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }

  return {
    start,
    deleteCount: endPrev - start,
    insert: next.slice(start, endNext),
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useYjsNote(
  noteId: string | undefined,
  initialTitle: string,
  initialContent: string,
) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YjsSupabaseProvider | null>(null);

  const [title, setTitleState] = useState(initialTitle);
  const [content, setContentState] = useState(initialContent);
  const [isSyncing, setIsSyncing] = useState(false);

  // Bootstrap / reset whenever the open note changes
  useEffect(() => {
    if (!noteId) return;

    // ── Tear down previous session ───────────────────────────────
    providerRef.current?.destroyWithClient(supabase);
    providerRef.current = null;
    ydocRef.current?.destroy();
    ydocRef.current = null;

    // ── Create doc and seed from DB synchronously ────────────────
    // Seeding BEFORE constructing the provider means the doc already has
    // content when we send step1, so peers immediately get a full state-vector.
    const ydoc = new Y.Doc();
    const yTitle = ydoc.getText('title');
    const yContent = ydoc.getText('content');

    ydoc.transact(() => {
      if (initialTitle) yTitle.insert(0, initialTitle);
      if (initialContent) yContent.insert(0, initialContent);
    }, 'db-seed');

    setTitleState(initialTitle);
    setContentState(initialContent);

    ydocRef.current = ydoc;

    // ── Mirror Y.Text changes → React state ─────────────────────
    const onTitleChange = () => setTitleState(yTitle.toString());
    const onContentChange = () => setContentState(yContent.toString());
    yTitle.observe(onTitleChange);
    yContent.observe(onContentChange);

    // ── Start syncing ────────────────────────────────────────────
    setIsSyncing(true);

    // Stop spinner after first remote update or 2 s timeout
    let synced = false;
    const syncTimeout = setTimeout(() => { synced = true; setIsSyncing(false); }, 2000);
    const onRemoteUpdate = (_: Uint8Array, origin: unknown) => {
      if (origin !== null && !synced) {
        synced = true;
        clearTimeout(syncTimeout);
        setIsSyncing(false);
      }
    };
    ydoc.on('update', onRemoteUpdate);

    // ── Construct provider AFTER doc is seeded ───────────────────
    const provider = new YjsSupabaseProvider(supabase, noteId, ydoc);
    providerRef.current = provider;

    return () => {
      clearTimeout(syncTimeout);
      yTitle.unobserve(onTitleChange);
      yContent.unobserve(onContentChange);
      ydoc.off('update', onRemoteUpdate);
      provider.destroyWithClient(supabase);
      providerRef.current = null;
      ydoc.destroy();
      ydocRef.current = null;
    };
    // We intentionally exclude initialTitle/initialContent from deps —
    // the Y.Doc is seeded once on mount; subsequent DB saves come back
    // via the provider's sync, not via prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // ── Public setters ────────────────────────────────────────────────────────
  // These write minimal diffs into Y.Text so concurrent edits on different
  // parts of the string merge correctly instead of clobbering each other.

  const setTitle = useCallback((val: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) { setTitleState(val); return; }
    const yTitle = ydoc.getText('title');
    const current = yTitle.toString();
    if (current === val) return;
    const { start, deleteCount, insert } = computeDiff(current, val);
    ydoc.transact(() => {
      if (deleteCount > 0) yTitle.delete(start, deleteCount);
      if (insert) yTitle.insert(start, insert);
    }, 'local');
  }, []);

  const setContent = useCallback((val: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) { setContentState(val); return; }
    const yContent = ydoc.getText('content');
    const current = yContent.toString();
    if (current === val) return;
    const { start, deleteCount, insert } = computeDiff(current, val);
    ydoc.transact(() => {
      if (deleteCount > 0) yContent.delete(start, deleteCount);
      if (insert) yContent.insert(start, insert);
    }, 'local');
  }, []);

  return { title, content, setTitle, setContent, isSyncing };
}