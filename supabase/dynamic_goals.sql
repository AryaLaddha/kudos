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
    -- Learning
    (p_org_id, 'Learning', 'Complete a Salesforce Trailhead Badge', 5),
    (p_org_id, 'Learning', 'Complete a Salesforce Trailhead Superbadge', 10),
    (p_org_id, 'Learning', 'Earn a Salesforce Certification', 50),
    -- Knowledge Sessions & Documentation
    (p_org_id, 'Knowledge Sessions & Documentation', 'Host a Knowledge Sharing Session', 15),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Submit a written tip, guide or how-to document', 5),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Confluence Documentation Clean Up — review and clean up existing Confluence documentation covering structure, alignment, consistency and formatting. Must also produce and present a clear maintenance guide that outlines how the whole team should create, update and maintain documentation going forward. The maintenance guide must be approved and adopted by the lead before points are awarded', 20),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Own Backup — covering backup strategy, tools used (e.g. OwnBackup), scheduling, restoration process and data recovery steps', 30),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Release Management Process — covering how releases are planned, environment strategy (Dev, UAT, Prod), change sets or CI/CD pipeline, deployment steps and rollback process', 20),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Development Best Practices — covering coding standards, naming conventions, version control, governor limits, test class requirements and code review process', 20),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Admin Day to Day Activities — covering user management, permission sets, troubleshooting common issues, data management tasks, report building and routine maintenance', 20),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Payments — covering payment gateway setup, transaction flow, reconciliation process, error handling and relevant Salesforce configuration', 20),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Any other approved Salesforce topic — must be pre-approved and relevant to the team', 25),
    (p_org_id, 'Knowledge Sessions & Documentation', 'Consolidate our Delivery Framework — review and consolidate the team''s existing delivery framework covering intake, prioritisation, sprint/release cadence, roles and responsibilities, quality gates and reporting, etc.. Must produce a single consolidated framework document, be approved by the lead and rolled out to the team', 70),
    -- POC
    (p_org_id, 'POC', 'CI/CD Pipeline — e.g. setting up an automated deployment pipeline using tools such as Gearset, Copado, GitHub Actions or SFDX. Must demonstrate at least one successful automated deployment from one environment to another', 60),
    (p_org_id, 'POC', 'AI & Automation — any AI or automation tool or solution that improves how the team works day to day. This is not limited to Salesforce and could include tools such as ChatGPT, Claude, Copilot. Must demonstrate a working output that solves a real operational problem or reduces manual effort for the team', 60),
    (p_org_id, 'POC', 'Process Efficiency — e.g. automating a manual or repetitive process. Must demonstrate a measurable reduction in manual effort or time saved', 50),
    (p_org_id, 'POC', 'Approved Idea — any innovative idea that could benefit the team, improve how we work or solve a known problem. Must be submitted as a proposal, approved by the lead before starting, and result in a working build', 20),
    (p_org_id, 'POC', 'Salesforce Headless 360 — explore and demonstrate a headless Salesforce 360 implementation. Must include a working prototype, documentation of architecture and a team demo', 60),
    (p_org_id, 'POC', 'Build Agents with Claude Code — design and build a working agent using Claude Code that solves a real team or business problem (e.g. automating admin tasks, speeding up development, supporting operations). Must include documentation of the use case, setup and a team demo', 30),
    (p_org_id, 'POC', 'New Agent Builder with Script — build an agent using Salesforce''s new Agent Builder leveraging scripting/Apex to extend its capabilities. Must demonstrate a working agent that handles a real business scenario, with documentation and a team demo', 30),
    (p_org_id, 'POC', 'Salesforce Security Center 2.0 — explore and implement Salesforce Security Center 2.0 capabilities to improve the security posture of our orgs and aligned to Australian policies. Must include a working configuration, key findings or improvements identified, documentation and a team demo', 60),
    -- Workshop
    (p_org_id, 'Workshop', 'Run a Team Retro or Improvement Workshop — plan and facilitate a retrospective or improvement workshop that surfaces actionable improvements for the team. Must include a prepared agenda, facilitated session and a documented list of actions with owners', 15)
  ON CONFLICT DO NOTHING;
END;
$$;
