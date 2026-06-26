export type Organization = {
  id: string;
  name: string;
  slug: string;
  monthly_allowance: number;
  price_per_seat: number;
  created_at: string;
};

export type Profile = {
  id: string;
  org_id: string | null;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  job_title: string | null;
  // Optional — only fetched when the current user's own profile is loaded
  monthly_allowance?: number;
  points_balance?: number;
  is_admin?: boolean;
  is_active?: boolean;
  created_at: string;
};

export type Recognition = {
  id: string;
  org_id: string;
  giver_id: string;
  receiver_id: string;
  receiver_ids?: string[];
  message: string;
  points: number;
  hashtags: string[];
  created_at: string;
  giver?: Profile;
  receiver?: Profile;
  receivers?: Profile[];
  reactions?: Reaction[];
  comments?: Comment[];
};

export type Reaction = {
  id: string;
  recognition_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: Pick<Profile, "id" | "full_name">;
};

export type Comment = {
  id: string;
  recognition_id: string;
  user_id: string;
  message: string;
  points_tip: number;
  created_at: string;
  user?: Pick<Profile, "id" | "full_name" | "avatar_url">;
};

export type PointTransaction = {
  id: string;
  org_id: string;
  user_id: string;
  recognition_id: string | null;
  amount: number;
  kind: "given" | "received" | "monthly_reset";
  created_at: string;
};

export type ReviewStatus = "review" | "approved" | "rejected";

export type UserGoal = {
  id: string;
  user_id: string;
  org_id: string;
  goal_id: string;
  status: "aim" | "achieved";
  description: string;
  created_at: string;
  review_status: ReviewStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type GoalDefinition = {
  id: string;
  org_id: string;
  category: string;
  title: string;
  points: number;
  created_at: string;
};

// ── Sprint Goals · Capacity Planning ──────────────────────────────────────────

export type Stream = {
  id: string;
  name: string;
  is_archived: boolean;
};

export type CapacityRoleDefinition = {
  id: string;
  name: string;
  is_archived: boolean;
};

export type GoalStatus = "on_track" | "delayed" | "completed" | "carried_over";

// A role requirement row on a goal. Multiple rows can use the same role.
export type RoleRequirement = {
  id: string;
  role: string;
  points: number | null;
};

// One person filling one role on a goal within a sprint.
export type GoalAssignment = {
  id: string;
  org_id: string;
  sprint_id: string;
  goal_id: string;
  role_requirement_id: string | null;
  role: string;
  user_id: string;
  allocated_points: number;
  created_at: string;
};

export type GoalSubtask = {
  id: string;
  goal_id: string;
  name: string;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  sort_order: number;
  created_at: string;
};

export type GoalDelay = {
  id: string;
  goal_id: string;
  sprint_id: string | null;
  subtask_id: string | null;
  reason: string;
  new_due_date: string | null;
  reported_by: string | null;
  created_at: string;
  // Embedded on read
  reporter_name?: string | null;
  subtask_name?: string | null;
};

export type SprintGoal = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  points: number | null;
  sprint_id: string | null;
  start_date: string | null;
  end_date: string | null;
  original_end_date: string | null;
  status: GoalStatus;
  stream_ids: string[];
  tags: string[];
  role_requirements: RoleRequirement[];
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  // Embedded on read
  subtasks?: GoalSubtask[];
  delays?: GoalDelay[];
};

// Lightweight sprint reference for the Goal History journey.
export type SprintRef = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

// A sprint_participants row enriched with capacity fields + profile.
export type CapacityParticipant = {
  user_id: string;
  sprint_id: string;
  base_points: number;
  scores: Record<string, number>;
  goal_allocations: Record<string, number>;
  expected_override: number | null;
  role: string | null;
  stream_ids: string[];
  profile: { id: string; full_name: string; avatar_url: string | null; job_title: string | null };
};

export type EnrichedUserGoal = UserGoal & {
  title: string;
  category: string;
  points: number;
};

export type PendingGoal = {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  goal_id: string;
  title: string;
  category: string;
  points: number;
  status: "aim" | "achieved";
  description: string;
  created_at: string;
};
