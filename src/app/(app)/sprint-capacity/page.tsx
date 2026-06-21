import { getActiveSprintCapacityList } from "@/app/(app)/sprint-capacity/actions";
import SprintCapacityListClient from "@/components/app/SprintCapacityListClient";

export const revalidate = 30;

export default async function SprintCapacityPage() {
  const sprints = await getActiveSprintCapacityList();
  return <SprintCapacityListClient sprints={sprints} />;
}
