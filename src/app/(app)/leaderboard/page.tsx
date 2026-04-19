import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const revalidate = 300;

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Zap, Coins } from "lucide-react";
import { LeaderboardFilter } from "@/components/app/LeaderboardFilter";
import { SprintLeaderboardFilter } from "@/components/app/SprintLeaderboardFilter";
import Link from "next/link";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; period?: string; tab?: string; sprint?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.org_id) redirect("/feed");

  const activeTab = params.tab === "sprint" ? "sprint" : "recognition";

  // ── Fetch all completed sprints for sprint tab filter (ordered latest first) ──
  const { data: completedSprints } = await supabase
    .from("sprints")
    .select("id, name, start_date")
    .eq("org_id", currentProfile.org_id)
    .eq("status", "completed")
    .order("start_date", { ascending: false })
    .limit(500);

  const completedSprintList = completedSprints ?? [];

  // ── Recognition filter (month / all-time) ──
  const isAllTime = params.period === "all";
  const now = new Date();
  const month = parseInt(params.month ?? now.getMonth().toString());
  const year  = parseInt(params.year  ?? now.getFullYear().toString());

  // ── Sprint filter — use the sprint param, default to latest completed ──
  const selectedSprintParam = params.sprint ?? completedSprintList[0]?.id ?? "all";
  const sprintIsAll = selectedSprintParam === "all";

  // ── Fetch recognition data ──
  let queryR = supabase
    .from("recognitions")
    .select("receiver_ids, points")
    .eq("org_id", currentProfile.org_id)
    .limit(500);
  let queryC = supabase
    .from("comments")
    .select("points_tip, recognitions!inner(receiver_ids, org_id)")
    .eq("recognitions.org_id", currentProfile.org_id)
    .gt("points_tip", 0)
    .limit(500);

  if (!isAllTime) {
    const monthStart = new Date(year, month, 1).toISOString();
    const nextMonth  = new Date(year, month + 1, 1).toISOString();
    queryR = queryR.gte("created_at", monthStart).lt("created_at", nextMonth);
    queryC = queryC.gte("created_at", monthStart).lt("created_at", nextMonth);
  }

  // ── Fetch sprint participant data ──
  const sprintIdsForQuery = sprintIsAll
    ? completedSprintList.map(s => s.id)
    : [selectedSprintParam];

  const [{ data: entries }, { data: tipEntries }, { data: sprintEntries }, { data: allProfiles }] = await Promise.all([
    queryR,
    queryC,
    sprintIdsForQuery.length > 0
      ? supabase
          .from("sprint_participants")
          .select("user_id, base_points, scores, sprint_id")
          .in("sprint_id", sprintIdsForQuery)
          .limit(500)
      : Promise.resolve({ data: [] as { user_id: string; base_points: number; scores: Record<string, number>; sprint_id: string }[] }),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .eq("org_id", currentProfile.org_id)
      .order("full_name"),
  ]);

  // ── Aggregate ──
  const totals = new Map<string, { id: string; name: string; avatar: string | null; title: string | null; points: number; count: number }>();
  for (const p of allProfiles ?? []) {
    totals.set(p.id, { id: p.id, name: p.full_name, avatar: p.avatar_url, title: p.job_title, points: 0, count: 0 });
  }

  if (activeTab === "recognition") {
    for (const e of entries ?? []) {
      for (const receiverId of (e.receiver_ids ?? [])) {
        const ex = totals.get(receiverId);
        if (ex) { ex.points += e.points; ex.count += 1; }
      }
    }
    for (const tip of tipEntries ?? []) {
      const rec = tip.recognitions as unknown as { receiver_ids: string[] };
      for (const receiverId of (rec?.receiver_ids ?? [])) {
        const ex = totals.get(receiverId);
        if (ex) ex.points += tip.points_tip ?? 0;
      }
    }
  } else {
    for (const entry of sprintEntries ?? []) {
      const ex = totals.get(entry.user_id);
      if (ex) {
        const scores = (entry.scores as Record<string, number>) ?? {};
        const net = Object.values(scores).reduce((acc, v) => acc + v, 0);
        ex.points += (entry.base_points ?? 20) + net;
        ex.count += 1;
      }
    }
  }

  // Only show people with points > 0; for recognition keep zeros off the board
  const ranked = Array.from(totals.values())
    .filter(p => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  // Labels for the subheading
  const selectedSprintName = sprintIsAll
    ? "All Completed Sprints"
    : completedSprintList.find(s => s.id === selectedSprintParam)?.name ?? "Sprint";

  const monthLabel = isAllTime
    ? "All-Time"
    : `${MONTH_NAMES[month]} ${year}`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Points Hub</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {activeTab === "recognition"
                  ? `Top Recognition · ${monthLabel}`
                  : `Sprint Leaders · ${selectedSprintName}`}
              </p>
            </div>
          </div>

          {/* Tab-specific filter */}
          {activeTab === "recognition" && <LeaderboardFilter />}
          {activeTab === "sprint" && completedSprintList.length > 0 && (
            <SprintLeaderboardFilter sprints={completedSprintList} />
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-100/80 rounded-xl w-full sm:w-fit">
          <Link
            href={`/leaderboard?tab=recognition${params.period ? `&period=${params.period}` : ""}${params.month != null ? `&month=${params.month}&year=${params.year}` : ""}`}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all",
              activeTab === "recognition" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Zap className={cn("h-3.5 w-3.5", activeTab === "recognition" ? "text-indigo-600" : "text-slate-400")} />
            RECOGNITION
          </Link>
          <Link
            href={`/leaderboard?tab=sprint${params.sprint ? `&sprint=${params.sprint}` : ""}`}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all",
              activeTab === "sprint" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Trophy className={cn("h-3.5 w-3.5", activeTab === "sprint" ? "text-indigo-600" : "text-slate-400")} />
            SPRINTS
          </Link>
        </div>
      </div>

      {/* No data states */}
      {activeTab === "sprint" && completedSprintList.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No completed sprints yet</p>
          <p className="text-sm text-slate-400 mt-1">Mark a sprint as completed to see sprint rankings here.</p>
        </div>
      ) : ranked.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No activity for this period</p>
          <p className="text-sm text-slate-400 mt-1">
            {activeTab === "recognition" ? "Start giving kudos to build the board!" : "No scores recorded for this sprint."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((person, i) => {
            const rankStyles = [
              { bg: "bg-amber-50 border-amber-200",  badge: "bg-amber-400 text-white" },
              { bg: "bg-slate-50 border-slate-200",  badge: "bg-slate-400 text-white" },
              { bg: "bg-orange-50 border-orange-200", badge: "bg-orange-400 text-white" },
            ];
            const style  = rankStyles[i] ?? { bg: "bg-white border-slate-100", badge: "bg-indigo-100 text-indigo-700" };
            const isTop3 = i < 3;

            return (
              <div
                key={person.id}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md",
                  isTop3 ? style.bg : "bg-white border-slate-100",
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold",
                  isTop3 ? style.badge : "bg-slate-100 text-slate-500",
                )}>
                  {i === 0 ? <Trophy className="h-4 w-4" /> : i === 1 || i === 2 ? <Medal className="h-4 w-4" /> : i + 1}
                </div>

                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={person.avatar ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{person.name}</p>
                  {person.title && <p className="text-xs text-slate-400 truncate">{person.title}</p>}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={cn("text-lg font-extrabold", isTop3 && i === 0 ? "text-indigo-600" : "text-slate-600")}>
                    +{activeTab === "sprint" ? Math.round(person.points) : person.points} pts
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {activeTab === "recognition"
                      ? `${person.count} ${person.count === 1 ? "recognition" : "recognitions"}`
                      : `${person.count} ${person.count === 1 ? "sprint" : "sprints"}`}
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
