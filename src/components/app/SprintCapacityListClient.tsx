"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed";
  sprint_participants: { count: number }[];
}

interface Props {
  sprints: Sprint[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SprintCapacityListClient({ sprints }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <Zap className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Sprint Capacity</h1>
          <p className="text-sm text-slate-500 mt-0.5">Read-only view of in-progress sprint capacity</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sprints.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Zap className="mx-auto h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-400">No in-progress sprints</p>
            <p className="text-xs text-slate-400 mt-1">Active sprint capacity will appear here.</p>
          </div>
        )}
        {sprints.map((sprint) => {
          const participantCount = sprint.sprint_participants?.[0]?.count ?? 0;
          return (
            <button
              key={sprint.id}
              onClick={() => startTransition(() => router.push(`/sprint-capacity/${sprint.id}`))}
              className={cn(
                "w-full text-left rounded-2xl border border-violet-200 bg-violet-50/30 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 relative group cursor-pointer",
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-green-600">In Progress</span>
                </div>
                {isPending && <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />}
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">{sprint.name}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {participantCount} {participantCount === 1 ? "person" : "people"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
