import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export default function Pagination({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6">
      <Link
        href={buildHref(page - 1)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
          page <= 1
            ? "pointer-events-none border-slate-100 text-slate-300"
            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        )}
        aria-disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Link>

      <span className="text-xs text-slate-400">
        Page {page} of {totalPages}
      </span>

      <Link
        href={buildHref(page + 1)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
          page >= totalPages
            ? "pointer-events-none border-slate-100 text-slate-300"
            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        )}
        aria-disabled={page >= totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
