import { getSprintCapacityReadModel } from "@/app/(app)/sprint-capacity/actions";
import SprintCapacityDetailClient from "@/components/app/SprintCapacityDetailClient";
import { notFound } from "next/navigation";

export const revalidate = 30;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SprintCapacityDetailPage({ params }: Props) {
  const { id } = await params;
  const { sprint, participants, orgUsers, goals, streams, assignments } = await getSprintCapacityReadModel(id);

  if (!sprint) notFound();

  return (
    <SprintCapacityDetailClient
      sprint={sprint}
      participants={participants}
      orgUsers={orgUsers}
      goals={goals}
      streams={streams}
      assignments={assignments}
    />
  );
}
