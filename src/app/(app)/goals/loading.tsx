import { Target, Trophy } from "lucide-react";

export default function GoalsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header skeleton */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 animate-pulse">
            <Target className="h-5 w-5 text-indigo-200" />
          </div>
          <div>
            <div className="h-7 w-24 bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>

        {/* Total points badge skeleton */}
        <div className="h-9 w-32 rounded-xl bg-amber-50 animate-pulse flex-shrink-0" />
      </div>

      {/* ── Achieved Goals Section Skeleton ────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-200" />
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-8 w-32 bg-indigo-100 rounded animate-pulse" />
        </div>

        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 rounded-full bg-green-50 animate-pulse" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
                <div className="h-2 w-16 bg-slate-100 rounded animate-pulse mt-1" />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Goals Aim Section Skeleton ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-200" />
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
        </div>

        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 rounded-full bg-indigo-50 animate-pulse" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
                <div className="h-2 w-16 bg-slate-100 rounded animate-pulse mt-1" />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
