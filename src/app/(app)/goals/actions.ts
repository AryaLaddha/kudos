"use server";

import { createClient } from "@/lib/supabase/server";
import { getGoalById } from "@/lib/goals";
import { revalidatePath } from "next/cache";

const MAX_DESCRIPTION_LENGTH = 500;

export async function addGoal(
  goalId: string,
  status: "aim" | "achieved",
  description: string,
  orgId: string,
): Promise<{ error?: string; id?: string; created_at?: string }> {
  // Validate goal exists in static list (prevents fake goal_ids)
  const goalDef = getGoalById(goalId);
  if (!goalDef) {
    return { error: "Invalid goal." };
  }

  // Validate status
  if (status !== "aim" && status !== "achieved") {
    return { error: "Invalid status." };
  }

  // Validate description
  const trimmed = description.trim();
  if (!trimmed) {
    return { error: "Description is required." };
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` };
  }

  const supabase = await createClient();

  // Verify authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Not authenticated." };
  }

  // Verify org_id matches the caller's own org (prevents cross-org writes)
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id || profile.org_id !== orgId) {
    return { error: "Organisation mismatch." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_goals")
    .insert({
      user_id: user.id,
      org_id: orgId,
      goal_id: goalId,
      status,
      description: trimmed,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    // Unique constraint: user already has this goal in this bucket
    if (insertError.code === "23505") {
      return { error: "You have already added this goal." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/goals");
  // Return the real DB-generated id so the client can use it for deletes
  return { id: inserted.id, created_at: inserted.created_at };
}

export async function deleteGoal(id: string): Promise<{ error?: string }> {
  if (!id) return { error: "Invalid goal." };

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Not authenticated." };
  }

  // RLS ensures only the owner can delete — this delete will silently no-op
  // if the row doesn't belong to the caller.
  const { error: deleteError } = await supabase
    .from("user_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // explicit check in addition to RLS

  if (deleteError) {
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/goals");
  return {};
}
