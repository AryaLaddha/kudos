-- ============================================================
-- Goal Approval Flow Migration
-- Run this in the Supabase SQL Editor
--
-- Adds an approval workflow on top of user_goals. The existing
-- `status` column (aim/achieved) is left untouched — review state
-- lives in the new `review_status` column.
-- ============================================================

ALTER TABLE user_goals
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('review', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Existing rows keep review_status = 'approved' (the column default), so nothing
-- already logged is retroactively pulled into the review queue.

-- Speeds up the approval queue query (pending goals per org).
CREATE INDEX IF NOT EXISTS idx_user_goals_review_status
  ON user_goals (org_id, review_status);

-- ------------------------------------------------------------
-- RLS: let org admins read every goal in their org (needed so the
-- approval queue can show goals belonging to other users). Approve /
-- reject mutations are performed server-side with the service-role
-- client after an explicit is_admin check, so no UPDATE policy is added.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "org admins can read org goals" ON user_goals;
CREATE POLICY "org admins can read org goals" ON user_goals
  FOR SELECT USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    AND (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
  );
