"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { GOALS } from "@/lib/goals";
import type { PendingGoal, UserGoal } from "@/types";

const MAX_REASON_LENGTH = 500;

/**
 * Verifies the caller is an org admin and returns a service-role client so the
 * approval queue can read/update goals belonging to other users (bypassing the
 * per-user RLS policies). Authorization is enforced here via the is_admin check.
 */
async function requireApprovalClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin || !profile.org_id) throw new Error("Forbidden");

  return { admin: createAdminClient(), user, orgId: profile.org_id as string };
}

/**
 * Returns every goal awaiting review in the caller's org, enriched with the
 * submitting user's name and the goal definition (title/category/points).
 */
export async function listPendingGoals(): Promise<PendingGoal[]> {
  const { admin, orgId } = await requireApprovalClient();

  const { data: rows } = await admin
    .from("user_goals")
    .select("id, user_id, goal_id, status, description, created_at, org_id")
    .eq("org_id", orgId)
    .eq("review_status", "review")
    .order("created_at", { ascending: true });

  const goals = (rows as UserGoal[]) ?? [];
  if (goals.length === 0) return [];

  // Resolve goal definitions (static + org-specific dynamic goals).
  const { data: dbDefinitions } = await admin
    .from("goals")
    .select("*")
    .eq("org_id", orgId);
  const definitions = dbDefinitions ?? [];

  // Resolve submitter names/avatars.
  const userIds = [...new Set(goals.map((g) => g.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return goals.flatMap((g) => {
    const def =
      definitions.find((d) => d.id === g.goal_id) ||
      GOALS.find((d) => d.id === g.goal_id);
    if (!def) return [];
    const profile = profileMap.get(g.user_id);
    return [{
      id: g.id,
      user_id: g.user_id,
      user_name: profile?.full_name ?? "Unknown user",
      user_avatar: profile?.avatar_url ?? null,
      goal_id: g.goal_id,
      title: def.title,
      category: def.category,
      points: def.points,
      status: g.status,
      description: g.description,
      created_at: g.created_at,
    }];
  });
}

export async function approveGoal(id: string): Promise<{ error?: string }> {
  if (!id) return { error: "Invalid goal." };

  const { admin, user, orgId } = await requireApprovalClient();

  const { error } = await admin
    .from("user_goals")
    .update({
      review_status: "approved",
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("review_status", "review");

  if (error) return { error: "Something went wrong. Please try again." };

  revalidatePath("/admin/goal-approvals");
  revalidatePath("/goals");
  return {};
}

export async function rejectGoal(
  id: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!id) return { error: "Invalid goal." };

  const trimmed = (reason ?? "").trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { error: `Reason must be ${MAX_REASON_LENGTH} characters or fewer.` };
  }

  const { admin, user, orgId } = await requireApprovalClient();

  const { error } = await admin
    .from("user_goals")
    .update({
      review_status: "rejected",
      // Reason is optional — store null when none was provided.
      rejection_reason: trimmed || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("review_status", "review");

  if (error) return { error: "Something went wrong. Please try again." };

  revalidatePath("/admin/goal-approvals");
  revalidatePath("/goals");
  return {};
}
