-- Capacity Planning roles + point-based role assignments.
-- Run after supabase/capacity_roles.sql.

CREATE TABLE IF NOT EXISTS capacity_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capacity_roles_org_id ON capacity_roles (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS capacity_roles_org_lower_name_unique ON capacity_roles (org_id, lower(name));

ALTER TABLE capacity_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read capacity_roles" ON capacity_roles;
CREATE POLICY "org members can read capacity_roles" ON capacity_roles
  FOR SELECT USING (org_id = get_my_org_id());

DROP POLICY IF EXISTS "admins manage capacity_roles" ON capacity_roles;
CREATE POLICY "admins manage capacity_roles" ON capacity_roles
  FOR ALL USING (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    org_id = get_my_org_id() AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

INSERT INTO capacity_roles (org_id, name)
SELECT o.id, role_name
FROM organizations o
CROSS JOIN (VALUES ('Dev'), ('BA'), ('QA'), ('Designer'), ('PM')) AS defaults(role_name)
ON CONFLICT DO NOTHING;

ALTER TABLE sprint_goals
  ADD COLUMN IF NOT EXISTS role_requirements jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE sprint_goals
SET role_requirements = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', COALESCE(item->>'id', gen_random_uuid()::text),
      'role', item->>'role',
      'points',
        CASE
          WHEN item ? 'points' THEN item->'points'
          WHEN item ? 'pct' AND sprint_goals.points IS NOT NULL
            THEN to_jsonb(round(((sprint_goals.points::numeric * (item->>'pct')::numeric) / 100), 2))
          ELSE 'null'::jsonb
        END
    )
  )
  FROM jsonb_array_elements(role_requirements) item
  WHERE item ? 'role'
), '[]'::jsonb)
WHERE role_requirements <> '[]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(role_requirements) item
    WHERE NOT (item ? 'id') OR item ? 'pct'
  );

ALTER TABLE goal_assignments
  ADD COLUMN IF NOT EXISTS role_requirement_id text,
  ADD COLUMN IF NOT EXISTS allocated_points numeric NOT NULL DEFAULT 0;

UPDATE goal_assignments ga
SET role_requirement_id = req.id,
    allocated_points = CASE
      WHEN ga.allocated_points > 0 THEN ga.allocated_points
      WHEN sg.points IS NOT NULL THEN round(((sg.points::numeric * ga.allocation_pct::numeric) / 100), 2)
      ELSE 0
    END
FROM sprint_goals sg,
LATERAL (
  SELECT item->>'id' AS id
  FROM jsonb_array_elements(sg.role_requirements) item
  WHERE item->>'role' = ga.role
  LIMIT 1
) req
WHERE sg.id = ga.goal_id
  AND ga.role_requirement_id IS NULL;

ALTER TABLE goal_assignments
  DROP CONSTRAINT IF EXISTS goal_assignments_unique;

DROP INDEX IF EXISTS goal_assignments_unique;

ALTER TABLE goal_assignments
  DROP CONSTRAINT IF EXISTS goal_assignments_unique_role_row,
  ADD CONSTRAINT goal_assignments_unique_role_row UNIQUE (sprint_id, goal_id, role_requirement_id);

ALTER TABLE goal_assignments
  DROP CONSTRAINT IF EXISTS goal_assignments_allocated_points_check,
  ADD CONSTRAINT goal_assignments_allocated_points_check CHECK (allocated_points >= 0);
