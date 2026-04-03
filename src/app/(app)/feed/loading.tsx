import { Heart, Sparkles } from "lucide-react";

export default function FeedLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-md animate-pulse mb-2" />
          <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-indigo-200 rounded-lg animate-pulse" />
      </div>

      {/* Demo banner skeleton (optional, usually skipped in loading but helps keep layout identical) */}
      <div className="mb-6 h-16 w-full rounded-xl bg-slate-100 animate-pulse" />

      {/* Feed list skeletons */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
              <div className="h-8 w-16 bg-slate-100 rounded flex items-center justify-center animate-pulse">
                <div className="h-4 w-4 rounded-full bg-slate-200" />
              </div>
              <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
