import { CalendarDays } from "lucide-react";

export default function LeaveLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 animate-pulse">
          <CalendarDays className="h-5 w-5 text-indigo-200" />
        </div>
        <div>
          <div className="h-7 w-40 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="h-8 w-8 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-slate-100 animate-pulse" />
          <div className="flex-1" />
          <div className="h-8 w-32 rounded-lg bg-indigo-100 animate-pulse" />
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="py-2 flex justify-center">
              <div className="h-3 w-8 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Day grid skeleton */}
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[92px] border-b border-r border-slate-100 px-2 py-1.5">
              <div className="h-[22px] w-[22px] rounded-full bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
