import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getSampleRail, isSampleId } from "@/components/app/feedRailSample"; // sample (temporary, kudosdev only)

const TOP_PEOPLE = 5;
const TOP_TAGS = 8;

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface FeedRailProps {
  orgId: string;
  currentUserId: string;
}

/**
 * Side panel for the Feed on wide screens: this month's most recognised
 * people and trending hashtags.
 *
 * Points are counted the same way as the Leaderboard's recognition tab
 * (src/app/(app)/leaderboard/page.tsx): each recognition's points go to every
 * receiver, plus comment tips. Keep the two in step if that rule changes.
 */
export default async function FeedRail({ orgId, currentUserId }: FeedRailProps) {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const monthLabel = now.toLocaleDateString("en-AU", { month: "long" });

  const [{ data: recognitions }, { data: tips }] = await Promise.all([
    supabase
      .from("recognitions")
      .select("receiver_ids, points, hashtags")
      .eq("org_id", orgId)
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth)
      .limit(500),
    supabase
      .from("comments")
      .select("points_tip, recognitions!inner(receiver_ids, org_id)")
      .eq("recognitions.org_id", orgId)
      .gt("points_tip", 0)
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth)
      .limit(500),
  ]);

  const points = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const r of recognitions ?? []) {
    for (const id of (r.receiver_ids as string[] | null) ?? []) {
      points.set(id, (points.get(id) ?? 0) + (r.points ?? 0));
    }
    for (const tag of (r.hashtags as string[] | null) ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  for (const t of tips ?? []) {
    const rec = t.recognitions as unknown as { receiver_ids: string[] | null } | null;
    for (const id of rec?.receiver_ids ?? []) {
      points.set(id, (points.get(id) ?? 0) + (t.points_tip ?? 0));
    }
  }

  let top = [...points.entries()]
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PEOPLE);

  let tags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_TAGS);

  let people: { id: string; full_name: string | null; avatar_url: string | null }[] = [];
  if (top.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", top.map(([id]) => id));
    people = data ?? [];
  }

  // sample: DEV-only placeholder while this month has no real data
  const sample = await getSampleRail(supabase, currentUserId, top.length > 0);
  if (sample) ({ top, tags, people } = sample);

  const byId = new Map(people.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Most recognised in {monthLabel}
            {/* sample */}
            {sample && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-[13px] font-medium text-amber-700">
                Sample data
              </span>
            )}
          </h2>
          <Link href="/leaderboard" className="text-[13px] font-medium text-indigo-600 hover:underline">
            Leaderboard
          </Link>
        </div>

        {top.length === 0 ? (
          <p className="text-[13px] text-slate-500">No kudos yet this month.</p>
        ) : (
          <ol className="-mx-2 space-y-0.5">
            {top.map(([id, pts], i) => {
              const person = byId.get(id);
              if (!person) return null;
              const name = person.full_name ?? "Unknown";
              const isMe = id === currentUserId;
              return (
                <li key={id}>
                  <Link
                    href={isSampleId(id) ? "/leaderboard" : `/profile/${id}`} // sample
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50",
                      isMe && "bg-slate-50"
                    )}
                  >
                    <span className="w-4 text-center text-[13px] font-semibold tabular-nums text-slate-400">
                      {i + 1}
                    </span>
                    <Avatar className="size-7">
                      <AvatarImage src={person.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-indigo-100 text-[11px] font-bold text-indigo-700">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
                      {name}
                      {isMe && <span className="font-normal text-slate-400"> (you)</span>}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-slate-900">{pts} pts</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {tags.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Trending in {monthLabel}</h2>
          <ul className="flex flex-wrap gap-2">
            {tags.map(([tag, count]) => (
              <li key={tag} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[13px] text-indigo-700">
                #{tag} <span className="tabular-nums text-indigo-500">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Placeholder while the panel's data streams in. */
export function FeedRailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
