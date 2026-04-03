import { ArrowLeft, Coins, Heart, Star } from "lucide-react";

export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Back to feed link skeleton */}
      <div className="inline-flex items-center gap-1.5 mb-6">
        <ArrowLeft className="h-4 w-4 text-slate-300" />
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Profile header skeleton */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="h-16 w-16 rounded-full bg-slate-200 ring-4 ring-slate-50 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-5 w-24 bg-slate-100 rounded-full mt-2 animate-pulse" />
              </div>
              <div className="h-9 w-28 bg-slate-200 rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                {i === 1 && <Coins className="h-4 w-4 text-slate-300" />}
                {i === 2 && <Star className="h-4 w-4 text-slate-300" />}
                {i === 3 && <Heart className="h-4 w-4 text-slate-300" />}
                <div className="h-6 w-12 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Top tags skeleton */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="h-3 w-24 bg-slate-100 rounded mb-3 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 mb-6">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 h-9 bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Recognition list skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
