import { requireAdmin } from "@/lib/auth";
import { getSprintById, getSprintParticipants, getProjects, getOrgUsers } from "@/app/(app)/sprints/actions";
import { notFound } from "next/navigation";
import SprintDetailClient from "@/components/app/SprintDetailClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SprintDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [sprint, participants, projects, orgUsers] = await Promise.all([
    getSprintById(id),
    getSprintParticipants(id),
    getProjects(),
    getOrgUsers(),
  ]);

  if (!sprint) notFound();

  return (
    <SprintDetailClient
      sprint={sprint}
      participants={participants}
      projects={projects}
      orgUsers={orgUsers}
    />
  );
}
