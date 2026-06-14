-- ============================================================
-- COMPLETE RLS FIX FOR NOTESCAPE
-- Run this entire script in your Supabase SQL Editor.
-- It safely drops all existing policies and rebuilds them correctly.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NOTES TABLE — drop and rebuild all policies
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow public access to shared notes" ON notes;
DROP POLICY IF EXISTS "Allow collaborator access" ON notes;
DROP POLICY IF EXISTS "Allow collaborator updates" ON notes;
-- Drop any owner policies that may have been created previously
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
DROP POLICY IF EXISTS "Enable read access for all users" ON notes;

-- Make sure RLS is enabled
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Owner: full access to their own notes
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

-- Collaborators: read access for any user listed in note_collaborators
CREATE POLICY "Collaborators can select shared notes" ON notes
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM note_collaborators WHERE note_id = notes.id
        )
    );

-- Collaborators: write access only for 'editor' role
CREATE POLICY "Editors can update shared notes" ON notes
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT user_id FROM note_collaborators WHERE note_id = notes.id AND role = 'editor'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM note_collaborators WHERE note_id = notes.id AND role = 'editor'
        )
    );

-- Public: anonymous read access for notes marked is_public
CREATE POLICY "Public notes are readable by anyone" ON notes
    FOR SELECT
    USING (is_public = true);


-- ────────────────────────────────────────────────────────────
-- 2. NOTE_COLLABORATORS TABLE — drop and rebuild all policies
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Note owners can manage collaborators" ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can view collaborators" ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can add collaborators" ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can update collaborators" ON note_collaborators;
DROP POLICY IF EXISTS "Note owners can remove collaborators" ON note_collaborators;

ALTER TABLE note_collaborators ENABLE ROW LEVEL SECURITY;

-- Owners can see who they've shared with
CREATE POLICY "Note owners can view collaborators" ON note_collaborators
    FOR SELECT
    USING (auth.uid() = (SELECT user_id FROM notes WHERE id = note_id));

-- Collaborators can see their own entry (so the app can show them as a collaborator)
CREATE POLICY "Collaborators can view own entry" ON note_collaborators
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only note owners can add collaborators
CREATE POLICY "Note owners can add collaborators" ON note_collaborators
    FOR INSERT
    WITH CHECK (auth.uid() = (SELECT user_id FROM notes WHERE id = note_id));

-- Only note owners can change collaborator roles
CREATE POLICY "Note owners can update collaborators" ON note_collaborators
    FOR UPDATE
    USING (auth.uid() = (SELECT user_id FROM notes WHERE id = note_id));

-- Only note owners can remove collaborators
CREATE POLICY "Note owners can remove collaborators" ON note_collaborators
    FOR DELETE
    USING (auth.uid() = (SELECT user_id FROM notes WHERE id = note_id));


-- ────────────────────────────────────────────────────────────
-- 3. PROFILES TABLE — ensure policies are correct
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read profiles (needed for email search in share sheet)
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
