"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Calendar, ChevronDown, Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function LeaderboardFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const currentMonth = searchParams.get("month") || new Date().getMonth().toString();
  const currentYear = searchParams.get("year") || new Date().getFullYear().toString();
  const isAllTime = searchParams.get("period") === "all";

  // Generate last 6 months options + All Time
  const options = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      value: `${d.getFullYear()}-${d.getMonth()}`,
      period: "month"
    });
  }

  function handleChange(val: string) {
    startTransition(() => {
      if (val === "all") {
        router.push("/leaderboard?period=all");
      } else {
        const [year, month] = val.split("-");
        router.push(`/leaderboard?year=${year}&month=${month}`);
      }
    });
  }

  return (
    <div className="relative inline-block w-full sm:w-auto">
      <select
        disabled={isPending}
        value={isAllTime ? "all" : `${currentYear}-${currentMonth}`}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "w-full sm:w-48 appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:border-slate-300",
          isPending && "opacity-60 cursor-not-allowed"
        )}
      >
        <option value="all">🏆 All Time History</option>
        <optgroup label="Monthly Rankings">
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              🗓️ {opt.label}
            </option>
          ))}
        </optgroup>
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
