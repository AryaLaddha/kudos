-- ============================================================
-- Sprint Goals · Capacity Planning · Goal History
-- Run this in the Supabase SQL Editor.
--
-- Adds the work-item layer the capacity planner depends on:
--   • streams        — org-managed catalogue of work streams (AI, Service, …)
--   • sprint_goals   — date-ranged work items (auto-appear in any sprint they overlap)
--   • goal_subtasks  — checklist items per goal
--   • goal_delays    — append-only delay log (powers history + delay strips)
--   • sprint_participants capacity columns (goal allocations, expected override,
--     manual deductions, member streams)
--
-- Capacity points are standalone: they do NOT touch the kudos points system or
-- the won/deducted scoring grid. Leave-based deductions are computed at read
-- time from the `leaves` table (1 point per working day on leave in the sprint).
-- ============================================================

-- ── Streams catalogue ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_streams_org_id ON streams (org_id);

ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read streams" ON streams
  FOR SELECT USING (org_id = get_my_org_id());

CREATE POLICY "admins manage streams" ON streams
  FOR ALL USING (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Seed the default stream catalogue for every existing org (idempotent — safe to
-- re-run). Streams are created/archived by admins; they are never deleted.
INSERT INTO streams (org_id, name)
SELECT o.id, s.name
FROM organizations o
CROSS JOIN (VALUES
  ('AI'),
  ('Service'),
  ('Sales'),
  ('Marketing'),
  ('Field Service'),
  ('Software Engineering')
) AS s(name)
WHERE NOT EXISTS (
  SELECT 1 FROM streams st WHERE st.org_id = o.id AND st.name = s.name
);

-- ── Sprint goals (date-ranged work items) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprint_goals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sprint_id         uuid REFERENCES sprints(id) ON DELETE SET NULL,
  title             text NOT NULL,
  description       text,
  points            int CHECK (points IS NULL OR points > 0),
  start_date        date,
  end_date          date,
  -- original_end_date is captured at creation; end_date may be pushed out by a delay.
  original_end_date date,
  status            text NOT NULL DEFAULT 'on_track'
                      CHECK (status IN ('on_track','delayed','completed','carried_over')),
  stream_ids        uuid[] NOT NULL DEFAULT '{}',
  tags              text[] NOT NULL DEFAULT '{}',
  completed_at      timestamptz,
  completed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sprint_goals_date_order CHECK (
    (start_date IS NULL AND end_date IS NULL) OR
    (start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date)
  )
);
CREATE INDEX IF NOT EXISTS idx_sprint_goals_org_dates ON sprint_goals (org_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_sprint_goals_sprint_id ON sprint_goals (sprint_id);

ALTER TABLE sprint_goals ENABLE ROW LEVEL SECURITY;

-- Sprint goals are management artifacts — admin-only direct access, mirroring the
-- existing sprints privacy model. Sprint managers act via the service-role path.
CREATE POLICY "admins manage sprint_goals" ON sprint_goals
  FOR ALL USING (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- ── Goal subtasks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_subtasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid NOT NULL REFERENCES sprint_goals(id) ON DELETE CASCADE,
  name       text NOT NULL,
  due_date   date,
  is_done    boolean NOT NULL DEFAULT false,
  done_at    timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goal_subtasks_goal_id ON goal_subtasks (goal_id);

ALTER TABLE goal_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage goal_subtasks" ON goal_subtasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sprint_goals g
      WHERE g.id = goal_subtasks.goal_id
        AND g.org_id = get_my_org_id()
        AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sprint_goals g
      WHERE g.id = goal_subtasks.goal_id
        AND g.org_id = get_my_org_id()
        AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

-- ── Goal delays (append-only log) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_delays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      uuid NOT NULL REFERENCES sprint_goals(id) ON DELETE CASCADE,
  sprint_id    uuid REFERENCES sprints(id) ON DELETE SET NULL,
  subtask_id   uuid REFERENCES goal_subtasks(id) ON DELETE SET NULL,
  reason       text NOT NULL,
  new_due_date date,
  reported_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goal_delays_goal_id ON goal_delays (goal_id);

ALTER TABLE goal_delays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage goal_delays" ON goal_delays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sprint_goals g
      WHERE g.id = goal_delays.goal_id
        AND g.org_id = get_my_org_id()
        AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sprint_goals g
      WHERE g.id = goal_delays.goal_id
        AND g.org_id = get_my_org_id()
        AND (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

-- ── Capacity columns on sprint participants ───────────────────────────────────
-- goal_allocations: { goal_id: percent } — supersedes project_allocations.
-- expected_override: NULL = use auto (Σ goal points × allocation %); set = absolute.
ALTER TABLE sprint_participants
  ADD COLUMN IF NOT EXISTS goal_allocations       jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS expected_override      int,
  ADD COLUMN IF NOT EXISTS manual_deducted_points int    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stream_ids             uuid[] NOT NULL DEFAULT '{}';
