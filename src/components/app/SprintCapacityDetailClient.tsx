"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import CapacityPlanningClient from "@/components/app/CapacityPlanningClient";
import type { CapacityRoleDefinition, GoalAssignment, SprintGoal, Stream } from "@/types";

interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed";
}

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title?: string | null;
}

interface Participant {
  id: string;
  sprint_id: string;
  user_id: string;
  base_points: number;
  scores: Record<string, number>;
  goal_allocations: Record<string, number>;
  expected_override: number | null;
  role: string | null;
  stream_ids: string[];
  profile: Profile;
}

interface Props {
  sprint: Sprint;
  participants: Participant[];
  orgUsers: Profile[];
  goals: SprintGoal[];
  streams: Stream[];
  roles: CapacityRoleDefinition[];
  assignments: GoalAssignment[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SprintCapacityDetailClient({ sprint, participants, orgUsers, goals, streams, roles, assignments }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <div className="max-w-full px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => startTransition(() => router.push("/sprint-capacity"))}
          className="text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100">
          <Zap className="h-5 w-5 text-violet-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">{sprint.name}</h1>
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 bg-green-100 text-green-700">
              In Progress
            </div>
          </div>
          <p className="text-sm text-slate-500 truncate">{formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}</p>
        </div>
      </div>

      <CapacityPlanningClient
        sprint={sprint}
        participants={participants}
        goals={goals}
        streams={streams}
        roles={roles}
        assignments={assignments}
        setAssignments={() => {}}
        orgUsers={orgUsers}
        onPatchParticipant={() => {}}
        onMemberUpserted={() => {}}
        onRemoveMember={() => {}}
        onGoalChange={() => {}}
        readOnly
      />
    </div>
  );
}
