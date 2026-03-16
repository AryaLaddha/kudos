import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.org_id) redirect("/feed");

  // Points received this month per person in the org
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: entries } = await supabase
    .from("recognitions")
    .select("receiver_ids, points")
    .eq("org_id", currentProfile.org_id)
    .gte("created_at", monthStart);

  // Collect all unique receiver IDs across all posts
  const allReceiverIds = new Set<string>();
  for (const e of entries ?? []) {
    for (const id of (e.receiver_ids ?? [])) allReceiverIds.add(id);
  }

  // Fetch profiles for all receivers
  const profileMap = new Map<string, { full_name: string; avatar_url: string | null; job_title: string | null }>();
  if (allReceiverIds.size > 0) {
    const { data: receiverProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title")
      .in("id", [...allReceiverIds]);
    for (const p of receiverProfiles ?? []) profileMap.set(p.id, p);
  }

  // Aggregate points per receiver — each receiver in receiver_ids gets `points`
  const totals = new Map<string, { name: string; avatar: string | null; title: string | null; points: number; recognitions: number }>();

  for (const e of entries ?? []) {
    for (const receiverId of (e.receiver_ids ?? [])) {
      const profile = profileMap.get(receiverId);
      if (!profile) continue;
      const existing = totals.get(receiverId);
      if (existing) {
        existing.points += e.points;
        existing.recognitions += 1;
      } else {
        totals.set(receiverId, {
          name: profile.full_name,
          avatar: profile.avatar_url,
          title: profile.job_title,
          points: e.points,
          recognitions: 1,
        });
      }
    }
  }

  const ranked = Array.from(totals.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.points - a.points);

  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const rankStyles = [
    { bg: "bg-amber-50 border-amber-200", badge: "bg-amber-400 text-white", label: "1st" },
    { bg: "bg-slate-50 border-slate-200", badge: "bg-slate-400 text-white", label: "2nd" },
    { bg: "bg-orange-50 border-orange-200", badge: "bg-orange-400 text-white", label: "3rd" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Trophy className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Leaderboard</h1>
          <p className="text-sm text-slate-500">Most recognised this month · {monthLabel}</p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-slate-200 mb-3" />
          <p className="text-slate-500 font-medium">No recognitions yet this month</p>
          <p className="text-sm text-slate-400 mt-1">Be the first to give kudos!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((person, i) => {
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
