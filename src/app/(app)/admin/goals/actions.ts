"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { GoalDefinition } from "@/types";

export async function getGoalDefinitions(): Promise<GoalDefinition[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return [];

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("category", { ascending: true })
    .order("points", { ascending: true });

  if (error) {
    console.error("Error fetching goals:", error);
    return [];
  }

  return data as GoalDefinition[];
}

export async function addGoalDefinition(data: {
  category: string;
  title: string;
  points: number;
}): Promise<{ error?: string; id?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return { error: "Org not found" };

  const { data: inserted, error } = await supabase
    .from("goals")
    .insert({
      org_id: profile.org_id,
      category: data.category,
      title: data.title,
      points: data.points,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error adding goal:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
  return { id: inserted.id };
}

export async function updateGoalDefinition(
  id: string,
  data: {
    category?: string;
    title?: string;
    points?: number;
  }
): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update(data)
    .eq("id", id);

  if (error) {
    console.error("Error updating goal:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
  return {};
}

export async function deleteGoalDefinition(id: string): Promise<{ error?: string }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting goal:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/goals");
  revalidatePath("/goals");
  return {};
}

export async function seedGoalsForOrg(): Promise<{ error?: string; count?: number }> {
  if (!(await isAdmin())) return { error: "Not authorized" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) return { error: "Org not found" };

  const { error } = await supabase.rpc("seed_default_goals", { p_org_id: profile.org_id });

  if (error) {
    console.error("Error seeding goals:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/goals");
  return { count: 24 };
}
