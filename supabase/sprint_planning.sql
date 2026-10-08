-- ============================================================
-- Sprint planning: availability, holidays, buddies, goal notes
-- Run this in the Supabase SQL Editor (after capacity_roles_points.sql).
--
--   * sprint_participants: location, buddies, deducted points, daily availability
--   * public_holidays:     per-location holiday calendar, applied to availability
--   * goal_notes:          dated, authored progress log on each sprint goal
--
-- Expected points are still stored in sprint_participants.expected_override.
-- The Availability tab recalculates it as (sum of daily availability) - deducted points.
-- ============================================================

ALTER TABLE sprint_participants
  ADD COLUMN IF NOT EXISTS location        text,
  ADD COLUMN IF NOT EXISTS buddy_user_ids  uuid[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deducted_points numeric NOT NULL DEFAULT 0 CHECK (deducted_points >= 0),
  -- { "2026-10-21": 0.5, "2026-10-22": "AL" }: only days that differ from a full day
  ADD COLUMN IF NOT EXISTS availability    jsonb   NOT NULL DEFAULT '{}'::jsonb;

-- expected_override was an int; half days make fractional capacity possible.
ALTER TABLE sprint_participants
  ALTER COLUMN expected_override TYPE numeric;

CREATE TABLE IF NOT EXISTS public_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location     text NOT NULL,
  holiday_date date NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_holidays_unique UNIQUE (org_id, location, holiday_date)
);
CREATE INDEX IF NOT EXISTS idx_public_holidays_org_date ON public_holidays (org_id, holiday_date);

CREATE TABLE IF NOT EXISTS goal_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  goal_id    uuid NOT NULL REFERENCES sprint_goals(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body       text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goal_notes_goal ON goal_notes (goal_id, created_at DESC);

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_notes      ENABLE ROW LEVEL SECURITY;

-- Admin-only direct access, like goal_assignments. Sprint managers act via the
-- service-role path after an application-level check.
DROP POLICY IF EXISTS "admins manage public_holidays" ON public_holidays;
CREATE POLICY "admins manage public_holidays" ON public_holidays
  FOR ALL USING (
    org_id = get_my_org_id() AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  ) WITH CHECK (
    org_id = get_my_org_id() AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS "admins manage goal_notes" ON goal_notes;
CREATE POLICY "admins manage goal_notes" ON goal_notes
  FOR ALL USING (
    org_id = get_my_org_id() AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  ) WITH CHECK (
    org_id = get_my_org_id() AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );
