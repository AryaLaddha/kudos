import { requireAdmin } from "@/lib/auth";
import { getSprints, getProjects } from "@/app/(app)/sprints/actions";
import SprintsClient from "@/components/app/SprintsClient";

export const dynamic = "force-dynamic";

export default async function SprintsPage() {
  await requireAdmin();
  const [sprints, projects] = await Promise.all([getSprints(), getProjects()]);

  return <SprintsClient sprints={sprints} projects={projects} />;
}
