import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGoalDefinitions } from "./actions";
import GoalsManagementClient from "@/components/app/GoalsManagementClient";

export const metadata = {
  title: "Goals | Kudos",
  description: "Manage organization goals and points",
};

export default async function AdminGoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const goals = await getGoalDefinitions();

  return <GoalsManagementClient initialGoals={goals} isAdmin={profile?.is_admin === true} />;
}
