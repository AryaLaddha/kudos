-- ============================================================
-- Data Integrity & Points Hub Patch
-- Fixes RLS barriers and adds cascading safety
-- ============================================================

-- 1. FIX: Admins can see all goals in their organization
DROP POLICY IF EXISTS "org admins can read org goals" ON user_goals;
CREATE POLICY "org admins can read org goals" ON user_goals
  FOR SELECT USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
  );

-- 2. FIX: Regular employees can READ (select) sprint data for the points hub
DROP POLICY IF EXISTS "Org members can read sprints" ON sprints;
CREATE POLICY "Org members can read sprints" ON sprints
  FOR SELECT USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members can read sprint_participants" ON sprint_participants;
CREATE POLICY "Org members can read sprint_participants" ON sprint_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sprints 
      WHERE sprints.id = sprint_participants.sprint_id 
      AND sprints.org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 3. FIX: Add is_archived to projects to prevent "Black Hole" data loss
-- Instead of deleting projects, admins should archive them.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 4. FIX: Cascade user deletions to performance records
-- (Wait, standard check: if we already have the FK, we need to drop and re-add if we want to change cascade behavior)
-- For now, ensuring participants are deleted if user is deleted:
ALTER TABLE sprint_participants 
  DROP CONSTRAINT IF EXISTS sprint_participants_user_id_fkey,
  ADD CONSTRAINT sprint_participants_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. FIX: Regular employees can see who's achieved what goals (Social Goal Board)
DROP POLICY IF EXISTS "org members can see all achieved goals" ON user_goals;
CREATE POLICY "org members can see all achieved goals" ON user_goals
  FOR SELECT USING (
    status = 'achieved' AND 
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
  );
