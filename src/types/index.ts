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

export type LeaveType = "annual" | "sick" | "public_holiday" | "emergency" | "custom";

export type Leave = {
  id: string;
  org_id: string;
  user_id: string;
  leave_type: LeaveType;
  custom_label: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  created_at: string;
  // Embedded author info (joined on read)
  user_name?: string;
  avatar_url?: string | null;
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
