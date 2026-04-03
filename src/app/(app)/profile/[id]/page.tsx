import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, Heart, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RecognitionCard from "@/components/app/RecognitionCard";
import Pagination from "@/components/app/Pagination";
import ProfileGoalsSection from "@/components/app/ProfileGoalsSection";
import type { Recognition, Profile, EnrichedUserGoal } from "@/types";
import { getGoalById } from "@/lib/goals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab = "received", page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const from = (pageNum - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  // Check if the viewer is an admin
  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  const viewerIsAdmin = viewerProfile?.is_admin === true;

  // Count totals for tab labels and pagination
  const [{ count: receivedCount }, { count: givenCount }] = await Promise.all([
    supabase.from("recognitions").select("*", { count: "exact", head: true }).eq("receiver_id", id),
    supabase.from("recognitions").select("*", { count: "exact", head: true }).eq("giver_id", id),
  ]);

  const activeTab = tab === "given" ? "given" : tab === "goals" ? "goals" : "received";
  const totalItems = activeTab === "received" ? (receivedCount ?? 0) : (givenCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));

  // Fetch the paginated recognitions for the active tab
  const recognitionQuery = supabase
    .from("recognitions")
    .select(`
      *,
      giver:profiles!recognitions_giver_id_fkey(*),
      receiver:profiles!recognitions_receiver_id_fkey(*),
      reactions(*),
      comments(*, user:profiles(*))
    `)
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data: recognitions } = await (
    activeTab === "received"
      ? recognitionQuery.eq("receiver_id", id)
      : recognitionQuery.eq("giver_id", id)
  );

  // Fetch receiver profiles for multi-receiver posts
  let receiversMap = new Map<string, Profile>();
  const allReceiverIds = new Set<string>();
  for (const r of recognitions ?? []) {
    for (const rid of ((r as Recognition & { receiver_ids?: string[] }).receiver_ids ?? [])) {
      allReceiverIds.add(rid);
    }
  }
  if (allReceiverIds.size > 0) {
    const { data: receiverProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", [...allReceiverIds]);
    for (const p of receiverProfiles ?? []) {
      receiversMap.set(p.id, p as Profile);
    }
  }

  const recognitionsWithReceivers = (recognitions ?? []).map((r) => {
    const rids = ((r as Recognition & { receiver_ids?: string[] }).receiver_ids ?? []);
    const receivers = rids.map((rid: string) => receiversMap.get(rid)).filter(Boolean) as Profile[];
    return { ...r, receivers: receivers.length > 0 ? receivers : undefined } as Recognition;
  });

  const isOwn = user.id === id;
  const canSeeGoals = isOwn || viewerIsAdmin;
  const initials = profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // Fetch achieved goals if viewer is the owner or an admin
  let achievedGoals: EnrichedUserGoal[] = [];
  if (canSeeGoals) {
    const { data: rawGoals } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", id)
      .eq("status", "achieved")
      .order("created_at", { ascending: false });

    achievedGoals = (rawGoals ?? []).flatMap((g) => {
      const def = getGoalById(g.goal_id);
      if (!def) return [];
      return [{ ...g, title: def.title, category: def.category, points: def.points }];
    });
  }

  // Top hashtags from all received recognitions (not paginated — use count query approach)
  const { data: allReceived } = await supabase
    .from("recognitions")
    .select("hashtags")
    .eq("receiver_id", id)
    .limit(100);

  const allTags = (allReceived ?? []).flatMap((r) => r.hashtags ?? []);
  const tagCounts: Record<string, number> = {};
  allTags.forEach((t) => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; });
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag);

  function buildHref(p: number) {
    return `/profile/${id}?tab=${activeTab}&page=${p}`;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* Profile header */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar className="h-16 w-16 ring-4 ring-indigo-50">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">{profile.full_name}</h1>
                {profile.job_title && <p className="text-sm text-slate-500 mt-0.5">{profile.job_title}</p>}
                {profile.department && (
                  <Badge variant="secondary" className="mt-2 bg-slate-100 text-slate-600 border-0">
                    {profile.department}
                  </Badge>
                )}
              </div>
              {!isOwn && (
                <Link href="/give">
                  <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Heart className="h-3.5 w-3.5" />
                    Give Kudos
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Coins className="h-4 w-4 text-indigo-500" />
              <span className="text-xl font-extrabold text-slate-900">{profile.points_balance}</span>
            </div>
            <p className="text-xs text-slate-400">Points balance</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Star className="h-4 w-4 text-amber-400" />
              <span className="text-xl font-extrabold text-slate-900">{receivedCount ?? 0}</span>
            </div>
            <p className="text-xs text-slate-400">Kudos received</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Heart className="h-4 w-4 text-rose-400" />
              <span className="text-xl font-extrabold text-slate-900">{givenCount ?? 0}</span>
            </div>
            <p className="text-xs text-slate-400">Kudos given</p>
          </div>
        </div>

        {/* Top tags */}
        {topTags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Known for</p>
            <div className="flex flex-wrap gap-2">
              {topTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-indigo-50 text-indigo-600 border-0">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 mb-6">
        <Link
          href={`/profile/${id}?tab=received&page=1`}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-center transition-colors",
            activeTab === "received"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Kudos received
          {receivedCount != null && receivedCount > 0 && (
            <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-600 font-bold">
              {receivedCount}
            </span>
          )}
        </Link>
        <Link
          href={`/profile/${id}?tab=given&page=1`}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-center transition-colors",
            activeTab === "given"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Kudos given
          {givenCount != null && givenCount > 0 && (
            <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-xs text-rose-600 font-bold">
              {givenCount}
            </span>
          )}
        </Link>
        {canSeeGoals && (
          <Link
            href={`/profile/${id}?tab=goals`}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-center transition-colors",
              activeTab === "goals"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Completed Goals
            {achievedGoals.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-600 font-bold">
                {achievedGoals.length}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Goals tab */}
      {activeTab === "goals" && canSeeGoals && (
        <ProfileGoalsSection
          initialGoals={achievedGoals}
          isAdmin={viewerIsAdmin}
          isOwn={isOwn}
          targetUserId={id}
          orgId={profile.org_id ?? ""}
        />
      )}

      {/* Recognition list */}
      {activeTab !== "goals" && (
        !recognitions || recognitions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-400">
              {activeTab === "received"
                ? "No recognitions yet — be the first to give kudos!"
                : "No kudos given yet."}
            </p>
            {activeTab === "received" && !isOwn && (
              <Link href="/give" className="mt-3 inline-block">
                <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
                  Give Kudos
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {recognitionsWithReceivers.map((r) => (
                <RecognitionCard key={r.id} recognition={r} currentUserId={user.id} />
              ))}
            </div>
            <Pagination page={pageNum} totalPages={totalPages} buildHref={buildHref} />
          </>
        )
      )}
    </div>
  );
}
