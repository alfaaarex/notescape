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


-- ============================================================
-- FIX: Add FK from note_collaborators.user_id → profiles.id
-- This was missing — the original FK only pointed to auth.users,
-- which is why Supabase's auto-join returned null for profiles.
-- ============================================================

-- Add the FK (safe — only adds if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'note_collaborators_user_id_profiles_fkey'
      AND table_name = 'note_collaborators'
  ) THEN
    ALTER TABLE note_collaborators
      ADD CONSTRAINT note_collaborators_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill profiles for any auth.users who signed up before the trigger existed
-- (safe to run multiple times — ON CONFLICT DO NOTHING)
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
