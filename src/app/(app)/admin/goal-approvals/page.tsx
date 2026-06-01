import { requireAdmin } from "@/lib/auth";
import { listPendingGoals } from "./actions";
import GoalApprovalsClient from "@/components/app/GoalApprovalsClient";

export const metadata = {
  title: "Goal Approvals | Kudos",
  description: "Review and approve goals submitted by your team",
};

export default async function GoalApprovalsPage() {
  await requireAdmin();
  const pending = await listPendingGoals();
  return <GoalApprovalsClient initialGoals={pending} />;
}
