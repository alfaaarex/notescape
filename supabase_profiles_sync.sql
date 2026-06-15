-- ============================================================
-- NOTESCAPE — Profile Sync Fix
-- Run in Supabase SQL Editor.
--
-- WHY THIS IS NEEDED
-- ------------------
-- The handle_new_user trigger only fires on INSERT into auth.users.
-- Users who signed up via Google OAuth before this trigger existed,
-- or whose metadata was populated after signup (e.g. on token refresh),
-- end up with NULL full_name / avatar_url in the profiles table.
-- This causes the share sheet to show email twice and no avatar.
-- ============================================================


-- ── 1. Backfill existing users ────────────────────────────────
-- Handles both 'full_name' (Supabase default) and 'name' (Google OAuth)
-- as the display name key. Upserts so it's safe to run multiple times.

INSERT INTO public.profiles (id, email, full_name, avatar_url, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    NULL
  ) AS full_name,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(u.raw_user_meta_data->>'picture', ''),
    NULL
  ) AS avatar_url,
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  email      = EXCLUDED.email,
  full_name  = COALESCE(EXCLUDED.full_name,  profiles.full_name),
  avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
  updated_at = NOW();


-- ── 2. Replace the trigger function to handle both key names ──
-- Also runs on UPDATE so token refreshes keep profiles current.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', '')
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'picture', '')
    ),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name,  profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. Recreate trigger — fires on INSERT and UPDATE ──────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ── 4. Sanity check — view results ───────────────────────────
-- SELECT id, email, full_name, avatar_url FROM public.profiles ORDER BY updated_at DESC LIMIT 20;
