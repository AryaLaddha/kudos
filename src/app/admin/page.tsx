import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shield, Users, Building2, TrendingUp, Activity, LogOut } from "lucide-react";
import Link from "next/link";
import OrgTable, { type OrgRow } from "@/components/admin/OrgTable";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Auth check — must be logged in and is_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("full_name, is_admin")
    .eq("id", user.id)
    .single();

  if (!adminProfile?.is_admin) redirect("/admin/login");

  // Fetch org stats via the SECURITY DEFINER function
  const { data: orgStats, error } = await supabase.rpc("get_admin_dashboard_stats");

  const orgs: OrgRow[] = (orgStats ?? []).map((o: OrgRow) => ({
    ...o,
    total_users: Number(o.total_users),
    active_users_30d: Number(o.active_users_30d),
    mrr: Number(o.mrr),
    price_per_seat: Number(o.price_per_seat),
  }));

  // Summary totals
  const totalOrgs = orgs.length;
  const totalUsers = orgs.reduce((s, o) => s + o.total_users, 0);
  const totalActive = orgs.reduce((s, o) => s + o.active_users_30d, 0);
  const totalMrr = orgs.reduce((s, o) => s + o.mrr, 0);

  function formatMrr(n: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(n);
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">Kudos</span>
            <span className="text-slate-600 mx-1">·</span>
            <span className="text-sm font-medium text-slate-400">Admin</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {adminProfile.full_name}
            </span>
            <Link
              href="/feed"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← App
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Overview of all organisations on the platform
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            label="Organisations"
            value={String(totalOrgs)}
            icon={Building2}
            color="bg-indigo-600/20 text-indigo-400"
          />
          <StatCard
            label="Total users"
            value={String(totalUsers)}
            sub="across all orgs"
            icon={Users}
            color="bg-sky-600/20 text-sky-400"
          />
          <StatCard
            label="Active (30 days)"
            value={String(totalActive)}
            sub={totalUsers > 0 ? `${Math.round((totalActive / totalUsers) * 100)}% of users` : undefined}
            icon={Activity}
            color="bg-emerald-600/20 text-emerald-400"
          />
          <StatCard
            label="Total MRR"
            value={formatMrr(totalMrr)}
            sub="based on active seats"
            icon={TrendingUp}
            color="bg-amber-600/20 text-amber-400"
          />
        </div>

        {/* Org table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Organisations</h2>
            <p className="text-xs text-slate-500">
              Click £/seat to edit pricing for any org
            </p>
          </div>
          <OrgTable orgs={orgs} />
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            Error loading data: {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
