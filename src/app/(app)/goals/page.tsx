import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GOALS } from "@/lib/goals";
import { EnrichedUserGoal, UserGoal } from "@/types";
import GoalsPageClient from "@/components/app/GoalsPageClient";

// Pages using cookies() are already dynamic — no need for force-dynamic

function enrichGoals(rows: UserGoal[], definitions: any[]): EnrichedUserGoal[] {
  return rows.flatMap((row) => {
    const def = definitions.find((g) => g.id === row.goal_id) || GOALS.find((g) => g.id === row.goal_id);
    if (!def) return [];
    return [{ ...row, title: def.title, category: def.category, points: def.points }];
  });
}

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/feed");

  // Fetch dynamic definitions
  const { data: dbDefinitions } = await supabase
    .from("goals")
    .select("*")
    .eq("org_id", profile.org_id);

  const definitions = dbDefinitions || [];

  const { data: rows } = await supabase
    .from("user_goals")
    .select("id, user_id, goal_id, status, description, created_at, org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const allGoals = enrichGoals((rows as UserGoal[]) ?? [], definitions);
  const achievedGoals = allGoals.filter((g) => g.status === "achieved");
  const aimGoals = allGoals.filter((g) => g.status === "aim");
  const totalPoints = achievedGoals.reduce((sum, g) => sum + g.points, 0);

  return (
    <GoalsPageClient
      achievedGoals={achievedGoals}
      aimGoals={aimGoals}
      totalPoints={totalPoints}
      orgId={profile.org_id}
      goalDefinitions={definitions.length > 0 ? definitions : GOALS}
    />
  );
}
