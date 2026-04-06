"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  sprints: { id: string; name: string; start_date: string }[];
}

export function SprintLeaderboardFilter({ sprints }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = searchParams.get("sprint") ?? (sprints[0]?.id ?? "all");

  function handleChange(val: string) {
    startTransition(() => {
      router.push(`/leaderboard?tab=sprint&sprint=${val}`);
    });
  }

  return (
    <div className="relative inline-block w-full sm:w-auto">
      <select
        disabled={isPending}
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "w-full sm:w-56 appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:border-slate-300",
          isPending && "opacity-60 cursor-not-allowed",
        )}
      >
        <option value="all">🏆 All Completed Sprints</option>
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>
            🏃 {s.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </div>
  );
}
