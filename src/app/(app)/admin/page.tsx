import { requireAdmin } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

export default async function AdminPage() {
  await requireAdmin(); // redirects non-admins to /feed

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <ShieldCheck className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-500">Organisation management</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-slate-200 mb-3" />
        <p className="text-sm font-medium text-slate-400">Admin dashboard coming soon</p>
        <p className="text-xs text-slate-400 mt-1">
          User management, org analytics, and goal oversight will live here.
        </p>
      </div>
    </div>
  );
}
