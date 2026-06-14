-- ============================================================
-- NOTESCAPE — RLS FIX v2  (fixes infinite recursion)
-- Run this entire script in your Supabase SQL Editor.
--
-- ROOT CAUSE OF THE BUG
-- ---------------------
-- The previous policies created a circular dependency:
--   • notes policies queried note_collaborators
--   • note_collaborators policies queried notes
-- Postgres evaluates RLS policies recursively, so each table
-- kept triggering the other's policy → infinite recursion.
--
-- THE FIX
-- -------
-- Replace the subquery in note_collaborators policies with a
-- SECURITY DEFINER helper function.  A SECURITY DEFINER function
-- runs as its *definer* (postgres superuser), so it bypasses RLS
-- when reading notes.  This breaks the cycle entirely.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. Helper function — bypasses RLS to check note ownership
--    safely, used only in note_collaborators policies.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_note_owner(p_note_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER          -- runs as superuser, skips RLS on notes
SET search_path = public  -- pin search_path for safety
AS $$
  SELECT user_id FROM notes WHERE id = p_note_id;
$$;


-- ────────────────────────────────────────────────────────────
-- 1. NOTES TABLE — drop ALL old policies and rebuild
-- ────────────────────────────────────────────────────────────

-- Drop every known policy name (safe even if they don't exist)
DROP POLICY IF EXISTS "Allow public access to shared notes"    ON notes;
DROP POLICY IF EXISTS "Allow collaborator access"              ON notes;
DROP POLICY IF EXISTS "Allow collaborator updates"             ON notes;
DROP POLICY IF EXISTS "Users can view own notes"               ON notes;
DROP POLICY IF EXISTS "Users can insert own notes"             ON notes;
DROP POLICY IF EXISTS "Users can update own notes"             ON notes;
DROP POLICY IF EXISTS "Users can delete own notes"             ON notes;
DROP POLICY IF EXISTS "Enable read access for all users"       ON notes;
DROP POLICY IF EXISTS "Owners can select own notes"            ON notes;
DROP POLICY IF EXISTS "Owners can insert own notes"            ON notes;
DROP POLICY IF EXISTS "Owners can update own notes"            ON notes;
DROP POLICY IF EXISTS "Owners can delete own notes"            ON notes;
DROP POLICY IF EXISTS "Collaborators can select shared notes"  ON notes;
DROP POLICY IF EXISTS "Editors can update shared notes"        ON notes;
DROP POLICY IF EXISTS "Public notes are readable by anyone"    ON notes;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD on their own notes
CREATE POLICY "Owners can select own notes" ON notes
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert own notes" ON notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own notes" ON notes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete own notes" ON notes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Collaborators: read access via note_collaborators
-- (note_collaborators has NO subquery back into notes, so no cycle)
CREATE POLICY "Collaborators can select shared notes" ON notes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM note_collaborators
            WHERE note_collaborators.note_id = notes.id
              AND note_collaborators.user_id = auth.uid()
        )
    );

-- Collaborators: write access for 'editor' role only
CREATE POLICY "Editors can update shared notes" ON notes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM note_collaborators
            WHERE note_collaborators.note_id = notes.id
              AND note_collaborators.user_id = auth.uid()
              AND note_collaborators.role = 'editor'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM note_collaborators
            WHERE note_collaborators.note_id = notes.id
              AND note_collaborators.user_id = auth.uid()
              AND note_collaborators.role = 'editor'
        )
    );

-- Public: anonymous read for notes marked is_public
CREATE POLICY "Public notes are readable by anyone" ON notes
    FOR SELECT
    USING (is_public = true);


-- ────────────────────────────────────────────────────────────
-- 2. NOTE_COLLABORATORS TABLE — drop ALL old policies and rebuild
--    Uses get_note_owner() to avoid querying notes under RLS
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Note owners can manage collaborators"    ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can view collaborators"      ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can add collaborators"       ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can update collaborators"    ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can remove collaborators"    ON note_collaborators;
DROP POLICY IF EXISTS "Collaborators can view own entry"        ON note_collaborators;
DROP POLICY IF EXISTS "Collaborators can view all collaborators on shared notes" ON note_collaborators;

ALTER TABLE note_collaborators ENABLE ROW LEVEL SECURITY;

-- Note owner can see the full collaborator list for their notes
CREATE POLICY "Note owners can view collaborators" ON note_collaborators
    FOR SELECT
    USING (auth.uid() = public.get_note_owner(note_id));

-- Each collaborator can see their own row (so the app can verify their access)
CREATE POLICY "Collaborators can view own entry" ON note_collaborators
    FOR SELECT
    USING (auth.uid() = user_id);

-- Collaborators can see ALL collaborators on notes they have access to
-- (enables the full collaborator list to render for non-owners)
-- Uses get_note_owner() via a helper to avoid recursion; the check here is:
-- "is the current user a collaborator on this note?" without querying notes under RLS.
CREATE OR REPLACE FUNCTION public.is_note_collaborator(p_note_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM note_collaborators
    WHERE note_id = p_note_id AND user_id = p_user_id
  );
$$;

CREATE POLICY "Collaborators can view all collaborators on shared notes" ON note_collaborators
    FOR SELECT
    USING (public.is_note_collaborator(note_id, auth.uid()));

-- Only note owners can add collaborators
CREATE POLICY "Note owners can add collaborators" ON note_collaborators
    FOR INSERT
    WITH CHECK (auth.uid() = public.get_note_owner(note_id));

-- Only note owners can change collaborator roles
CREATE POLICY "Note owners can update collaborators" ON note_collaborators
    FOR UPDATE
    USING (auth.uid() = public.get_note_owner(note_id));

-- Only note owners can remove collaborators
CREATE POLICY "Note owners can remove collaborators" ON note_collaborators
    FOR DELETE
    USING (auth.uid() = public.get_note_owner(note_id));


-- ────────────────────────────────────────────────────────────
-- 3. PROFILES TABLE — clean rebuild
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile."       ON profiles;
DROP POLICY IF EXISTS "Users can update own profile."            ON profiles;
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"       ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile"       ON profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read profiles (needed for email lookup in share sheet)
CREATE POLICY "Profiles are readable by authenticated users" ON profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can only create/update their own profile row
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
