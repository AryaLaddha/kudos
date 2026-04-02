export type GoalDefinition = {
  id: string
  category: GoalCategory
  title: string
  points: number
}

export type GoalCategory =
  | 'Learning & Certification'
  | 'Sprint Contribution'
  | 'Productivity & Efficiency'
  | 'Practice Growth'
  | 'Collaboration & Quality'

export const GOAL_CATEGORIES: GoalCategory[] = [
  'Learning & Certification',
  'Sprint Contribution',
  'Productivity & Efficiency',
  'Practice Growth',
  'Collaboration & Quality',
]

export const GOALS: GoalDefinition[] = [
  // ── Learning & Certification ─────────────────────────────────
  {
    id: 'learning_trailhead_badge',
    category: 'Learning & Certification',
    title: 'Complete a Salesforce Trailhead badge related to current sprint work',
    points: 5,
  },
  {
    id: 'learning_certification',
    category: 'Learning & Certification',
    title: 'Earn a new Salesforce certification (e.g. Admin, Platform App Builder)',
    points: 50,
  },
  {
    id: 'learning_superbadge',
    category: 'Learning & Certification',
    title: 'Complete a Superbadge on Trailhead',
    points: 20,
  },
  {
    id: 'learning_webinar_summary',
    category: 'Learning & Certification',
    title: 'Attend and summarise a Salesforce webinar/event (written summary shared with team)',
    points: 10,
  },
  {
    id: 'learning_onboarding',
    category: 'Learning & Certification',
    title: 'Complete onboarding to a new Salesforce product/feature relevant to the roadmap',
    points: 15,
  },

  // ── Sprint Contribution ──────────────────────────────────────
  {
    id: 'sprint_on_time_delivery',
    category: 'Sprint Contribution',
    title: 'Deliver all assigned sprint tasks on time with zero carry-over for 2 consecutive sprints',
    points: 20,
  },
  {
    id: 'sprint_bug_before_uat',
    category: 'Sprint Contribution',
    title: 'Raise and resolve a bug before it reaches UAT',
    points: 15,
  },
  {
    id: 'sprint_user_story',
    category: 'Sprint Contribution',
    title: 'Submit a documented user story that gets accepted into a sprint without revision',
    points: 10,
  },
  {
    id: 'sprint_spike_task',
    category: 'Sprint Contribution',
    title: 'Complete a spike/research task and present findings to the team',
    points: 15,
  },
  {
    id: 'sprint_exceeds_expectation',
    category: 'Sprint Contribution',
    title: 'Deliver a sprint task rated "exceeds expectation" in sprint review',
    points: 20,
  },

  // ── Productivity & Efficiency ─────────────────────────────────
  {
    id: 'productivity_reusable_component',
    category: 'Productivity & Efficiency',
    title: 'Build and document a reusable Salesforce component or flow used by the team',
    points: 25,
  },
  {
    id: 'productivity_process_improvement',
    category: 'Productivity & Efficiency',
    title: 'Identify and implement a process improvement that reduces manual effort (documented + approved)',
    points: 30,
  },
  {
    id: 'productivity_team_template',
    category: 'Productivity & Efficiency',
    title: 'Create or improve a team template (e.g. user story, test script, deployment checklist) adopted by the team',
    points: 15,
  },
  {
    id: 'productivity_automation',
    category: 'Productivity & Efficiency',
    title: 'Reduce average case resolution time by contributing a new automation (measured over 1 month)',
    points: 25,
  },
  {
    id: 'productivity_code_review',
    category: 'Productivity & Efficiency',
    title: 'Complete peer code/config review for 5 sprint deliverables',
    points: 10,
  },

  // ── Practice Growth ───────────────────────────────────────────
  {
    id: 'growth_onboard_mentor',
    category: 'Practice Growth',
    title: 'Onboard and mentor a new team member through their first sprint',
    points: 20,
  },
  {
    id: 'growth_demo_session',
    category: 'Practice Growth',
    title: 'Present a demo or knowledge-share session to the wider team',
    points: 15,
  },
  {
    id: 'growth_document_process',
    category: 'Practice Growth',
    title: 'Document an undocumented process or integration in the team wiki/Confluence',
    points: 15,
  },
  {
    id: 'growth_post_implementation_review',
    category: 'Practice Growth',
    title: 'Contribute to a post-implementation review with actionable insights adopted by the team',
    points: 20,
  },
  {
    id: 'growth_feature_proposal',
    category: 'Practice Growth',
    title: 'Propose a new feature or improvement that gets added to the product backlog',
    points: 10,
  },

  // ── Collaboration & Quality ───────────────────────────────────
  {
    id: 'collab_stakeholder_feedback',
    category: 'Collaboration & Quality',
    title: 'Receive positive stakeholder feedback submitted via a formal channel (e.g. email, survey)',
    points: 15,
  },
  {
    id: 'collab_cross_functional_pairing',
    category: 'Collaboration & Quality',
    title: 'Complete cross-functional pairing with another squad member on a sprint task',
    points: 10,
  },
  {
    id: 'collab_zero_defects',
    category: 'Collaboration & Quality',
    title: 'Achieve zero critical defects raised against your deliverables over one full quarter',
    points: 25,
  },
  {
    id: 'collab_qa_improvements',
    category: 'Collaboration & Quality',
    title: "Submit 3 accepted improvements to the team's QA/testing process",
    points: 20,
  },
]

/** Look up a goal definition by its id. Returns undefined if not found. */
export function getGoalById(id: string): GoalDefinition | undefined {
  return GOALS.find((g) => g.id === id)
}

/** Returns goals grouped by category, preserving GOAL_CATEGORIES order. */
export function getGoalsByCategory(): Record<GoalCategory, GoalDefinition[]> {
  return GOAL_CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat] = GOALS.filter((g) => g.category === cat)
      return acc
    },
    {} as Record<GoalCategory, GoalDefinition[]>,
  )
}
