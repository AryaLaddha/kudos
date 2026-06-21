-- Sprint Goals decimal points support
-- Run this if supabase/sprint_goals_optional_fields.sql was already applied before decimal points were added.

ALTER TABLE sprint_goals
  ALTER COLUMN points TYPE numeric USING points::numeric;

ALTER TABLE sprint_goals
  DROP CONSTRAINT IF EXISTS sprint_goals_points_check,
  ADD CONSTRAINT sprint_goals_points_check CHECK (points IS NULL OR points > 0);
