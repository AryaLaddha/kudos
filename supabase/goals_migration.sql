-- ============================================================
-- Goals Feature Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE TABLE user_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id     text NOT NULL,
  status      text NOT NULL CHECK (status IN ('aim', 'achieved')),
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id, status)
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

-- Users can only read their own goals
CREATE POLICY "users can read own goals" ON user_goals
  FOR SELECT USING (user_id = auth.uid());

-- Users can only insert their own goals
CREATE POLICY "users can insert own goals" ON user_goals
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only delete their own goals
CREATE POLICY "users can delete own goals" ON user_goals
  FOR DELETE USING (user_id = auth.uid());

-- No UPDATE policy — goals cannot be edited after creation

-- ============================================================
-- Future admin policy (uncomment when admin view is built):
-- CREATE POLICY "org admins can read org goals" ON user_goals
--   FOR SELECT USING (
--     org_id = get_my_org_id() AND
--     (SELECT is_admin FROM profiles WHERE id = auth.uid())
--   );
-- ============================================================
