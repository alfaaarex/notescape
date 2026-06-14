-- Migration to enable Note Sharing and Collaboration

-- 1. Add 'is_public' flag to existing notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

-- 2. Create note_collaborators table
CREATE TABLE IF NOT EXISTS note_collaborators (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('viewer', 'editor')) DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (note_id, user_id)
);

-- 3. Update RLS on notes table
-- Drop existing policies if necessary or just add new ones
-- Assuming there's an existing policy for the owner.
-- Allow public reading if is_public is true
CREATE POLICY "Allow public access to shared notes" ON notes
    FOR SELECT
    USING (is_public = true);

-- Allow reading if user is an explicit collaborator
CREATE POLICY "Allow collaborator access" ON notes
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM note_collaborators WHERE note_id = id
        )
    );

-- Allow writing if user is an explicit editor
CREATE POLICY "Allow collaborator updates" ON notes
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT user_id FROM note_collaborators WHERE note_id = id AND role = 'editor'
        )
    );

-- 4. Enable RLS on note_collaborators
ALTER TABLE note_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Note owners can manage collaborators" ON note_collaborators
    FOR ALL
    USING (
        auth.uid() = (SELECT user_id FROM notes WHERE id = note_id)
    );

-- 5. Enable Realtime for the notes table
-- Go to Database -> Replication in your Supabase Dashboard and enable it for the 'notes' table.
