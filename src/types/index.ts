export type Organization = {
  id: string;
  name: string;
  slug: string;
  monthly_allowance: number;
  created_at: string;
};

export type Profile = {
  id: string;
  org_id: string | null;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  job_title: string | null;
  monthly_allowance: number;
  points_balance: number;
  created_at: string;
};

export type Recognition = {
  id: string;
  org_id: string;
  giver_id: string;
  receiver_id: string;
  message: string;
  points: number;
  hashtags: string[];
  created_at: string;
  giver?: Profile;
  receiver?: Profile;
  reactions?: Reaction[];
};

export type Reaction = {
  id: string;
  recognition_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
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
