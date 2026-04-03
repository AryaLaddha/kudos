import { Trophy } from "lucide-react";

export default function LeaderboardLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 animate-pulse">
          <Trophy className="h-5 w-5 text-amber-200" />
        </div>
        <div>
          <div className="h-7 w-40 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Leaderboard entries skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            {/* Rank badge skeleton */}
            <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-slate-100 animate-pulse" />

            {/* Avatar skeleton */}
            <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse shrink-0" />

            {/* Name + title skeleton */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
            </div>

            {/* Stats skeleton */}
            <div className="text-right flex-shrink-0 space-y-2">
              <div className="h-5 w-16 bg-slate-200 rounded animate-pulse ml-auto" />
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
