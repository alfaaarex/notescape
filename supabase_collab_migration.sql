-- ============================================================
-- NOTESCAPE — Collaboration Enhancement Migration
-- Run AFTER supabase_rls_fix_v2.sql
-- ============================================================

-- 1. Add share_slug column for short shareable links
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS share_slug TEXT UNIQUE;

-- Pre-populate slugs for existing public notes (optional back-fill)
-- Each slug is 7 chars from a safe alphabet (no ambiguous chars like 0/O, 1/l)
UPDATE notes
SET share_slug = (
  SELECT string_agg(
    substr('abcdefghijkmnpqrstuvwxyz23456789', (random()*31)::int + 1, 1), ''
  )
  FROM generate_series(1,7)
)
WHERE is_public = true AND share_slug IS NULL;

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS notes_share_slug_idx ON notes (share_slug)
WHERE share_slug IS NOT NULL;

-- 2. Enable Supabase Realtime on notes (required for postgres_changes)
-- Go to: Dashboard → Database → Replication → enable notes table
-- (Can't be done via SQL — use the dashboard toggle)

-- 3. Enable Broadcast + Presence on the realtime publication
-- Supabase enables this by default for all channels; no SQL needed.

-- 4. Grant realtime schema usage (already granted by Supabase by default,
--    included here in case of custom Postgres setups)
-- GRANT USAGE ON SCHEMA realtime TO anon, authenticated;

-- ============================================================
-- RLS POLICY: share_slug visibility
-- The slug is only useful when the note is public, so the
-- existing "Public notes are readable by anyone" policy already
-- covers reads. No new policy needed.
-- ============================================================

-- Sanity check — list public notes with their short links:
-- SELECT id, title, share_slug, is_public FROM notes WHERE is_public = true;
