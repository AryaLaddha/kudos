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
  const supabase = await createClient();

  // Verify authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Not authenticated." };
  }

  // Validate goal exists (static OR dynamic)
  const goalDef = getGoalById(goalId);
  if (!goalDef) {
    const { data: dbGoal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", goalId)
      .single();
    
    if (!dbGoal) return { error: "Invalid goal." };
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

// ── Admin-only actions ────────────────────────────────────────────────────────

export async function adminAddGoalForUser(
  targetUserId: string,
  goalId: string,
  description: string,
): Promise<{ error?: string; id?: string; created_at?: string }> {
  if (!targetUserId) return { error: "Invalid user." };

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const goalDef = getGoalById(goalId);
  if (!goalDef) {
    const { data: dbGoal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", goalId)
      .single();
    
    if (!dbGoal) return { error: "Invalid goal." };
  }

  const trimmed = description.trim();
  if (!trimmed) return { error: "Description is required." };
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` };
  }

  // Verify caller is an admin
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_admin, org_id")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.is_admin) return { error: "Not authorised." };

  // Verify target user is in the same org
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile?.org_id || targetProfile.org_id !== callerProfile.org_id) {
    return { error: "User not found in your organisation." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_goals")
    .insert({
      user_id: targetUserId,
      org_id: callerProfile.org_id,
      goal_id: goalId,
      status: "achieved",
      description: trimmed,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "This achievement has already been logged for this user." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/profile/${targetUserId}`);
  revalidatePath("/goals");
  return { id: inserted.id, created_at: inserted.created_at };
}

export async function adminDeleteGoal(id: string): Promise<{ error?: string }> {
  if (!id) return { error: "Invalid goal." };

  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  // Verify caller is an admin (RLS also enforces this)
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!callerProfile?.is_admin) return { error: "Not authorised." };

  const { error: deleteError } = await supabase
    .from("user_goals")
    .delete()
    .eq("id", id);

  if (deleteError) return { error: "Something went wrong. Please try again." };

  revalidatePath("/goals");
  return {};
}
