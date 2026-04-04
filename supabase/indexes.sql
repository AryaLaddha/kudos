-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes
-- Run once against your Supabase database via the SQL editor.
-- All indexes are CREATE INDEX IF NOT EXISTS — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- recognitions ----------------------------------------------------------------
-- Most common filters: receiver, giver, org + time (feed, leaderboard, admin)
CREATE INDEX IF NOT EXISTS idx_recognitions_receiver_id
  ON recognitions (receiver_id);

CREATE INDEX IF NOT EXISTS idx_recognitions_giver_id
  ON recognitions (giver_id);

-- Composite: org scoped + time-sorted — used by feed and admin analytics
CREATE INDEX IF NOT EXISTS idx_recognitions_org_created
  ON recognitions (org_id, created_at DESC);

-- comments --------------------------------------------------------------------
-- Every recognition card loads its comments by recognition_id
CREATE INDEX IF NOT EXISTS idx_comments_recognition_id
  ON comments (recognition_id);

-- reactions -------------------------------------------------------------------
-- Every recognition card loads reactions by recognition_id
CREATE INDEX IF NOT EXISTS idx_reactions_recognition_id
  ON reactions (recognition_id);

-- user_goals ------------------------------------------------------------------
-- Profile page + goals page filter by user_id
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id
  ON user_goals (user_id);

-- Org-scoped goal queries (admin analytics)
CREATE INDEX IF NOT EXISTS idx_user_goals_org_id
  ON user_goals (org_id);

-- profiles --------------------------------------------------------------------
-- All org-scoped user lookups (leaderboard, admin, search)
CREATE INDEX IF NOT EXISTS idx_profiles_org_id
  ON profiles (org_id);

-- sprint_participants ----------------------------------------------------------
-- Filtered by sprint_id in admin analytics and sprint detail page
CREATE INDEX IF NOT EXISTS idx_sprint_participants_sprint_id
  ON sprint_participants (sprint_id);

-- sprints ---------------------------------------------------------------------
-- Filtered by org_id on every sprint list fetch
CREATE INDEX IF NOT EXISTS idx_sprints_org_id
  ON sprints (org_id);
