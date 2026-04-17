import { requireAdmin } from "@/lib/auth";
import { getSprintById, getSprintParticipants, getOrgUsers } from "@/app/(app)/sprints/actions";
import { notFound } from "next/navigation";
import SprintDetailClient from "@/components/app/SprintDetailClient";

export const revalidate = 30; // admin data — tolerate up to 30s staleness

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SprintDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [sprint, participants, orgUsers] = await Promise.all([
    getSprintById(id),
    getSprintParticipants(id),
    getOrgUsers(),
  ]);

  if (!sprint) notFound();

  return (
    <SprintDetailClient
      sprint={sprint}
      participants={participants}
      orgUsers={orgUsers}
    />
  );
}
