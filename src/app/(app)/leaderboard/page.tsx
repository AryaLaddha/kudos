import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 300; // Revalidate every 5 minutes — leaderboard doesn't need real-time
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal } from "lucide-react";
import { LeaderboardFilter } from "@/components/app/LeaderboardFilter";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; period?: string }>;
}) {
  const params = await searchParams;
  const isAllTime = params.period === "all";
  const now = new Date();
  const month = parseInt(params.month ?? now.getMonth().toString());
  const year = parseInt(params.year ?? now.getFullYear().toString());

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.org_id) redirect("/feed");

  // Filter setup
  let queryR = supabase
    .from("recognitions")
    .select("id, receiver_ids, points")
    .eq("org_id", currentProfile.org_id)
    .limit(1000);

  let queryC = supabase
    .from("comments")
    .select("recognition_id, points_tip, recognitions!inner(receiver_ids, org_id)")
    .eq("recognitions.org_id", currentProfile.org_id)
    .gt("points_tip", 0)
    .limit(1000);

  if (!isAllTime) {
    const monthStart = new Date(year, month, 1).toISOString();
    const nextMonth = new Date(year, month + 1, 1).toISOString();
    queryR = queryR.gte("created_at", monthStart).lt("created_at", nextMonth);
    queryC = queryC.gte("created_at", monthStart).lt("created_at", nextMonth);
  }

  const [{ data: entries }, { data: tipEntries }] = await Promise.all([queryR, queryC]);

  // Fetch ALL profiles in this organization
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, job_title")
    .eq("org_id", currentProfile.org_id)
    .order("full_name");

  // Create a profile map for quick lookups
  const profileMap = new Map<string, { full_name: string; avatar_url: string | null; job_title: string | null }>();
  for (const p of allProfiles ?? []) {
    profileMap.set(p.id, p);
  }

  // Aggregate points per receiver — everyone starts at 0
  const totals = new Map<string, { id: string; name: string; avatar: string | null; title: string | null; points: number; recognitions: number }>();
  
  for (const p of allProfiles ?? []) {
    totals.set(p.id, {
      id: p.id,
      name: p.full_name,
      avatar: p.avatar_url,
      title: p.job_title,
      points: 0,
      recognitions: 0,
    });
  }

  for (const e of entries ?? []) {
    for (const receiverId of (e.receiver_ids ?? [])) {
      const existing = totals.get(receiverId);
      if (existing) {
        existing.points += e.points;
        existing.recognitions += 1;
      }
    }
  }

  // Add tip points — tips go to all receivers of the recognition
  for (const tip of tipEntries ?? []) {
    const rec = tip.recognitions as unknown as { receiver_ids: string[] };
    for (const receiverId of (rec?.receiver_ids ?? [])) {
      const existing = totals.get(receiverId);
      if (existing) {
        existing.points += tip.points_tip ?? 0;
      }
    }
  }

  const ranked = Array.from(totals.values())
    .sort((a, b) => b.points - a.points);

  const monthLabel = isAllTime ? "All-Time" : `${MONTH_NAMES[month]} ${year}`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Leaderboard</h1>
            <p className="text-sm text-slate-500">{isAllTime ? "Master performance records" : "Most recognized this month"} · {monthLabel}</p>
          </div>
        </div>
        <LeaderboardFilter />
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No activity for this period</p>
          <p className="text-sm text-slate-400 mt-1">Start giving kudos to build the board!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((person, i) => {
            const rankStyles = [
              { bg: "bg-amber-50 border-amber-200", badge: "bg-amber-400 text-white", label: "1st" },
              { bg: "bg-slate-50 border-slate-200", badge: "bg-slate-400 text-white", label: "2nd" },
              { bg: "bg-orange-50 border-orange-200", badge: "bg-orange-400 text-white", label: "3rd" },
            ];
            const style = rankStyles[i] ?? { bg: "bg-white border-slate-100", badge: "bg-indigo-100 text-indigo-700", label: `${i + 1}th` };
            const isTop3 = i < 3;

            return (
              <div
                key={person.id}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md",
                  isTop3 ? style.bg : "bg-white border-slate-100"
                )}
              >
                {/* Rank */}
                <div className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold",
                  isTop3 ? style.badge : "bg-slate-100 text-slate-500"
                )}>
                  {i === 0 ? <Trophy className="h-4 w-4" /> : i === 1 || i === 2 ? <Medal className="h-4 w-4" /> : i + 1}
                </div>

                {/* Avatar */}
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={person.avatar ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name + title */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{person.name}</p>
                  {person.title && <p className="text-xs text-slate-400 truncate">{person.title}</p>}
                </div>

                {/* Stats */}
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-lg font-extrabold", isTop3 && i === 0 ? "text-amber-500" : "text-indigo-600")}>
                    +{person.points} pts
                  </p>
                  <p className="text-xs text-slate-400">
                    {person.recognitions} {person.recognitions === 1 ? "recognition" : "recognitions"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
