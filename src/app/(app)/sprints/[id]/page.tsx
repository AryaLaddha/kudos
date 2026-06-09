import { requireSprintManager } from "@/lib/auth";
import { getSprintById, getSprintParticipants, getOrgUsers } from "@/app/(app)/sprints/actions";
import {
  getSprintGoals,
  getGoalHistory,
  getStreams,
  getGoalAssignments,
} from "@/app/(app)/sprints/goals-actions";
import { notFound } from "next/navigation";
import SprintDetailClient from "@/components/app/SprintDetailClient";

export const revalidate = 30; // admin data — tolerate up to 30s staleness

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SprintDetailPage({ params }: Props) {
  await requireSprintManager();
  const { id } = await params;

  const [sprint, participants, orgUsers, goals, history, streams, assignments] = await Promise.all([
    getSprintById(id),
    getSprintParticipants(id),
    getOrgUsers(),
    getSprintGoals(id),
    getGoalHistory(),
    getStreams(),
    getGoalAssignments(id),
  ]);

  if (!sprint) notFound();

  return (
    <SprintDetailClient
      sprint={sprint}
      participants={participants}
      orgUsers={orgUsers}
      goals={goals}
      historyGoals={history.goals}
      allSprints={history.sprints}
      streams={streams}
      assignments={assignments}
    />
  );
}
