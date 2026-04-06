-- ============================================================
-- Sprint Leaderboard Privacy & Access Patch
-- Allows org members to see only COMPLETED sprint results
-- ============================================================

-- 1. Allow org members to see the existence of sprints (names/dates)
DROP POLICY IF EXISTS "Org members can read sprints" ON public.sprints;
CREATE POLICY "Org members can read sprints" ON public.sprints
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 2. Allow org members to read participant scores ONLY for completed sprints
DROP POLICY IF EXISTS "Team members can view completed sprint results" ON public.sprint_participants;
CREATE POLICY "Team members can view completed sprint results" ON public.sprint_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sprints 
      WHERE sprints.id = sprint_participants.sprint_id 
      AND sprints.org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
      AND (
        sprints.status = 'completed' OR 
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
      )
    )
  );
