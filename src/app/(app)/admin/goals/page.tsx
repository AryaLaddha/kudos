import { requireAdmin } from "@/lib/auth";
import { getGoalDefinitions } from "./actions";
import GoalsManagementClient from "@/components/app/GoalsManagementClient";

export const metadata = {
  title: "Goals Management | Kudos",
  description: "Manage organization goals and points",
};

export default async function AdminGoalsPage() {
  await requireAdmin();
  const goals = await getGoalDefinitions();

  return <GoalsManagementClient initialGoals={goals} />;
}
