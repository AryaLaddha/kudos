-- ============================================================
-- Capacity Planning v2 — Role requirements & role-based assignments
-- Run this in the Supabase SQL Editor.
--
-- Builds on supabase/sprint_goals.sql. Adds the role dimension the
-- redesigned Capacity Planning tab depends on:
--   • sprint_goals.role_requirements — roles + % needed to complete a goal
--   • goal_assignments               — goal × role × person allocation
--   • sprint_participants.role        — each member's capacity role
--
-- Also retires the leave calendar feature: the `leaves` table and its
-- read-time capacity deductions are removed. Capacity deductions are now
-- manual only (sprint_participants.manual_deducted_points).
-- ============================================================

-- ── Role requirements on goals ────────────────────────────────────────────────
-- Array of { "role": text, "pct": int } objects, e.g. [{"role":"Dev","pct":100}].
ALTER TABLE sprint_goals
  ADD COLUMN IF NOT EXISTS role_requirements jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── Role-based assignments (goal × role × person) ─────────────────────────────
-- Supersedes sprint_participants.goal_allocations for the capacity planner.
-- One row per person filling a role on a goal within a sprint.
CREATE TABLE IF NOT EXISTS goal_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sprint_id      uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  goal_id        uuid NOT NULL REFERENCES sprint_goals(id) ON DELETE CASCADE,
  role           text NOT NULL,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  allocation_pct int  NOT NULL DEFAULT 0 CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- One assignment per (sprint, goal, role): a role on a goal is filled by one person.
  CONSTRAINT goal_assignments_unique UNIQUE (sprint_id, goal_id, role)
);
CREATE INDEX IF NOT EXISTS idx_goal_assignments_sprint ON goal_assignments (sprint_id);
CREATE INDEX IF NOT EXISTS idx_goal_assignments_goal   ON goal_assignments (goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_assignments_user   ON goal_assignments (user_id);

ALTER TABLE goal_assignments ENABLE ROW LEVEL SECURITY;

-- Capacity artifacts — admin-only direct access (sprint managers act via the
-- service-role path), mirroring the sprint_goals privacy model.
CREATE POLICY "admins manage goal_assignments" ON goal_assignments
  FOR ALL USING (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- ── Capacity role on participants ─────────────────────────────────────────────
-- Each sprint member has a single capacity role (Dev, BA, QA, Designer, PM, …).
ALTER TABLE sprint_participants
  ADD COLUMN IF NOT EXISTS role text;

-- ── Retire the leave calendar ─────────────────────────────────────────────────
-- The leave feature is removed. goal_delays.sprint_id etc. are unaffected; only
-- the standalone leaves table goes. Drop is idempotent.
DROP TABLE IF EXISTS leaves;

-- The old per-person goal_allocations column is superseded by goal_assignments.
-- Kept (not dropped) for now so historical data is preserved; safe to drop later:
--   ALTER TABLE sprint_participants DROP COLUMN IF EXISTS goal_allocations;
