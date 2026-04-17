-- ============================================================
-- Dynamic Goals Management
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Everyone in the org can read goals
CREATE POLICY "org members can read goals" ON goals
  FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Only admins can manage goals (ALL: insert, update, delete)
CREATE POLICY "admins can manage goals" ON goals
  FOR ALL USING (
    org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()) AND
    (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Function to seed goals for an organization from the static list
-- This is useful when a new org is created or when migrating.
CREATE OR REPLACE FUNCTION seed_default_goals(p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO goals (org_id, category, title, points)
  VALUES 
    (p_org_id, 'Learning & Certification', 'Complete a Salesforce Trailhead badge related to current sprint work', 5),
    (p_org_id, 'Learning & Certification', 'Earn a new Salesforce certification (e.g. Admin, Platform App Builder)', 50),
    (p_org_id, 'Learning & Certification', 'Complete a Superbadge on Trailhead', 20),
    (p_org_id, 'Learning & Certification', 'Attend and summarise a Salesforce webinar/event (written summary shared with team)', 10),
    (p_org_id, 'Learning & Certification', 'Complete onboarding to a new Salesforce product/feature relevant to the roadmap', 15),
    (p_org_id, 'Sprint Contribution', 'Deliver all assigned sprint tasks on time with zero carry-over for 2 consecutive sprints', 20),
    (p_org_id, 'Sprint Contribution', 'Raise and resolve a bug before it reaches UAT', 15),
    (p_org_id, 'Sprint Contribution', 'Submit a documented user story that gets accepted into a sprint without revision', 10),
    (p_org_id, 'Sprint Contribution', 'Complete a spike/research task and present findings to the team', 15),
    (p_org_id, 'Sprint Contribution', 'Deliver a sprint task rated "exceeds expectation" in sprint review', 20),
    (p_org_id, 'Productivity & Efficiency', 'Build and document a reusable Salesforce component or flow used by the team', 25),
    (p_org_id, 'Productivity & Efficiency', 'Identify and implement a process improvement that reduces manual effort (documented + approved)', 30),
    (p_org_id, 'Productivity & Efficiency', 'Create or improve a team template (e.g. user story, test script, deployment checklist) adopted by the team', 15),
    (p_org_id, 'Productivity & Efficiency', 'Reduce average case resolution time by contributing a new automation (measured over 1 month)', 25),
    (p_org_id, 'Productivity & Efficiency', 'Complete peer code/config review for 5 sprint deliverables', 10),
    (p_org_id, 'Practice Growth', 'Onboard and mentor a new team member through their first sprint', 20),
    (p_org_id, 'Practice Growth', 'Present a demo or knowledge-share session to the wider team', 15),
    (p_org_id, 'Practice Growth', 'Document an undocumented process or integration in the team wiki/Confluence', 15),
    (p_org_id, 'Practice Growth', 'Contribute to a post-implementation review with actionable insights adopted by the team', 20),
    (p_org_id, 'Practice Growth', 'Propose a new feature or improvement that gets added to the product backlog', 10),
    (p_org_id, 'Collaboration & Quality', 'Receive positive stakeholder feedback submitted via a formal channel (e.g. email, survey)', 15),
    (p_org_id, 'Collaboration & Quality', 'Complete cross-functional pairing with another squad member on a sprint task', 10),
    (p_org_id, 'Collaboration & Quality', 'Achieve zero critical defects raised against your deliverables over one full quarter', 25),
    (p_org_id, 'Collaboration & Quality', 'Submit 3 accepted improvements to the team''s QA/testing process', 20)
  ON CONFLICT DO NOTHING;
END;
$$;
