-- ============================================================
-- Add is_active to profiles
-- Run this in the Supabase SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- RPC to fetch emails for all users in an org (needs service-role or SECURITY DEFINER).
-- auth.users is not accessible via RLS so we wrap it in a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION get_org_user_emails(p_org_id uuid)
RETURNS TABLE(id uuid, email text) LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Caller must be in the same org and be an admin
  IF NOT (SELECT is_admin FROM profiles WHERE profiles.id = auth.uid() AND profiles.org_id = p_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT au.id, au.email::text
    FROM auth.users au
    INNER JOIN profiles p ON p.id = au.id
    WHERE p.org_id = p_org_id;
END;
$$;

-- Admin RPC to toggle a user's active status.
-- SECURITY DEFINER so it can bypass the owner-only RLS update policy.
CREATE OR REPLACE FUNCTION set_user_active(p_user_id uuid, p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Caller must be an admin
  IF NOT (SELECT is_admin FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Prevent admins from deactivating themselves
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  UPDATE profiles SET is_active = p_is_active WHERE id = p_user_id;
END;
$$;
