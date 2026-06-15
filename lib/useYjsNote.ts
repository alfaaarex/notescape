/**
 * useYjsNote.ts
 *
 * React hook that owns the Y.Doc for a single note and exposes:
 *  - title / content — the current string values (React state, re-renders on change)
 *  - setTitle / setContent — functions that write into the Y.Doc
 *    (changes propagate automatically to all peers via YjsSupabaseProvider)
 *  - isSyncing — true during the initial peer sync window
 *
 * The caller should use setTitle/setContent instead of their own useState
 * setters for the fields you want to co-edit.
 *
 * Non-collaborative fields (color, tags, pinned, isPublic) are NOT managed
 * here — they keep their existing last-writer-wins behaviour via postgres_changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { supabase } from './supabaseClient';
import { YjsSupabaseProvider } from './yjsSupabaseProvider';

export function useYjsNote(noteId: string | undefined, initialTitle: string, initialContent: string) {
  // Y.Doc lives for the lifetime of this hook instance (i.e. while a note is open)
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<YjsSupabaseProvider | null>(null);
  const isLocalChangeRef = useRef(false); // prevents feedback loops

  const [title, setTitleState] = useState(initialTitle);
  const [content, setContentState] = useState(initialContent);
  const [isSyncing, setIsSyncing] = useState(false);

  // Bootstrap or reset the Y.Doc whenever the note changes
  useEffect(() => {
    if (!noteId) return;

    // Tear down previous session
    if (providerRef.current) {
      providerRef.current.destroyWithClient(supabase);
      providerRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const yTitle = ydoc.getText('title');
    const yContent = ydoc.getText('content');

    // Seed the doc with the authoritative values from Supabase (only when empty)
    // This runs before any remote sync so a new joiner sees the saved state
    // immediately rather than a blank page.
    ydoc.transact(() => {
      if (yTitle.length === 0 && initialTitle) {
        yTitle.insert(0, initialTitle);
      }
      if (yContent.length === 0 && initialContent) {
        yContent.insert(0, initialContent);
      }
    }, 'init');

    // Mirror Y.Text → React state
    const onTitleChange = () => {
      isLocalChangeRef.current = true;
      setTitleState(yTitle.toString());
      isLocalChangeRef.current = false;
    };
    const onContentChange = () => {
      isLocalChangeRef.current = true;
      setContentState(yContent.toString());
      isLocalChangeRef.current = false;
    };

    yTitle.observe(onTitleChange);
    yContent.observe(onContentChange);

    // Kick off realtime sync
    setIsSyncing(true);
    const provider = new YjsSupabaseProvider(supabase, noteId, ydoc);
    providerRef.current = provider;

    // Give the initial sync 1.5 s then stop showing spinner
    const syncTimer = setTimeout(() => setIsSyncing(false), 1500);

    return () => {
      clearTimeout(syncTimer);
      yTitle.unobserve(onTitleChange);
      yContent.unobserve(onContentChange);
      provider.destroyWithClient(supabase);
      providerRef.current = null;
      ydoc.destroy();
      ydocRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // When the parent loads a fresh note from DB (navigating between notes),
  // reseed the Y.Doc if the Y.Text is still empty (first open, no peers yet).
  useEffect(() => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const yTitle = ydoc.getText('title');
    const yContent = ydoc.getText('content');
    ydoc.transact(() => {
      if (yTitle.toString() !== initialTitle) {
        yTitle.delete(0, yTitle.length);
        if (initialTitle) yTitle.insert(0, initialTitle);
      }
      if (yContent.toString() !== initialContent) {
        yContent.delete(0, yContent.length);
        if (initialContent) yContent.insert(0, initialContent);
      }
    }, 'remote-load');
    setTitleState(initialTitle);
    setContentState(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTitle, initialContent]);

  // Public setters — write into Y.Doc so changes broadcast to peers
  const setTitle = useCallback((val: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) { setTitleState(val); return; }
    const yTitle = ydoc.getText('title');
    const current = yTitle.toString();
    if (current === val) return;
    // Compute a simple diff: replace entire content
    // For a title field this is fine; for body content Yjs handles merges anyway.
    ydoc.transact(() => {
      yTitle.delete(0, yTitle.length);
      if (val) yTitle.insert(0, val);
    }, 'local');
    setTitleState(val);
  }, []);

  const setContent = useCallback((val: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) { setContentState(val); return; }
    const yContent = ydoc.getText('content');
    const current = yContent.toString();
    if (current === val) return;
    ydoc.transact(() => {
      yContent.delete(0, yContent.length);
      if (val) yContent.insert(0, val);
    }, 'local');
    setContentState(val);
  }, []);

  return { title, content, setTitle, setContent, isSyncing };
}
