-- Sprint Goals optional scheduling/points support
-- Run this in Supabase SQL editor for existing databases before deploying the app changes.

ALTER TABLE sprint_goals
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE sprint_goals
  ALTER COLUMN points DROP NOT NULL,
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL,
  ALTER COLUMN original_end_date DROP NOT NULL;

ALTER TABLE sprint_goals
  DROP CONSTRAINT IF EXISTS sprint_goals_points_check,
  ADD CONSTRAINT sprint_goals_points_check CHECK (points IS NULL OR points > 0);

ALTER TABLE sprint_goals
  DROP CONSTRAINT IF EXISTS sprint_goals_date_order,
  ADD CONSTRAINT sprint_goals_date_order CHECK (
    (start_date IS NULL AND end_date IS NULL) OR
    (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
  );

CREATE INDEX IF NOT EXISTS idx_sprint_goals_sprint_id ON sprint_goals (sprint_id);
