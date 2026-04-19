import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecognitionCard from "@/components/app/RecognitionCard";
import Pagination from "@/components/app/Pagination";
import type { Recognition, Profile } from "@/types";

// Pages using cookies() are already dynamic — no need for force-dynamic

const PER_PAGE = 20;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function FeedPage({ searchParams }: Props) {
  const { page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const from = (pageNum - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user's profile + org
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, avatar_url, department, job_title, points_balance, monthly_allowance, is_admin, created_at")
    .eq("id", user.id)
    .single();

  // Count total for pagination
  let countQuery = supabase
    .from("recognitions")
    .select("id", { count: "exact", head: true });
  if (profile?.org_id) countQuery = countQuery.eq("org_id", profile.org_id);
  const { count: totalCount } = await countQuery;

  // Fetch paginated recognitions
  let query = supabase
    .from("recognitions")
    .select(`
      id, org_id, giver_id, receiver_id, receiver_ids, message, points, hashtags, created_at,
      giver:profiles!recognitions_giver_id_fkey(id, full_name, avatar_url, job_title, department, org_id, created_at),
      receiver:profiles!recognitions_receiver_id_fkey(id, full_name, avatar_url, job_title, department, org_id, created_at),
      reactions(id, recognition_id, user_id, emoji, created_at, user:profiles(id, full_name)),
      comments(id, recognition_id, user_id, message, points_tip, created_at, user:profiles(id, full_name, avatar_url))
    `)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (profile?.org_id) {
    query = query.eq("org_id", profile.org_id);
  }

  const { data: recognitions } = await query;

  // Fetch receiver profiles for multi-receiver posts
  let receiversMap = new Map<string, Profile>();
  const allReceiverIds = new Set<string>();
  for (const r of recognitions ?? []) {
    for (const id of ((r as unknown as Recognition & { receiver_ids?: string[] }).receiver_ids ?? [])) {
      allReceiverIds.add(id);
    }
  }
  if (allReceiverIds.size > 0) {
    const { data: receiverProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, job_title, department, org_id, created_at")
      .in("id", [...allReceiverIds]);
    for (const p of receiverProfiles ?? []) {
      receiversMap.set(p.id, p as Profile);
    }
  }

  // Attach receivers array to each recognition
  const recognitionsWithReceivers = (recognitions ?? []).map((r) => {
    const row = r as unknown as Recognition & { receiver_ids?: string[] };
    const rids = row.receiver_ids ?? [];
    const receivers = rids.map((id: string) => receiversMap.get(id)).filter(Boolean) as Profile[];
    return { ...row, receivers: receivers.length > 0 ? receivers : undefined } as Recognition;
  });

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PER_PAGE));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Recognition Feed</h1>
          <p className="text-sm text-slate-500 mt-0.5">See what your teammates are celebrating</p>
        </div>
        <Link href="/give">
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Heart className="h-4 w-4" />
            Give Kudos
          </Button>
        </Link>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {recognitionsWithReceivers.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No recognitions yet — be the first to give kudos!
          </div>
        )}
        {recognitionsWithReceivers.map((recognition) => (
          <RecognitionCard
            key={recognition.id}
            recognition={recognition}
            currentUserId={user.id}
          />
        ))}
      </div>

      {/* Pagination */}
      {(totalCount ?? 0) > 0 && (
        <Pagination
          page={pageNum}
          totalPages={totalPages}
          buildHref={(p) => `/feed?page=${p}`}
        />
      )}
    </div>
  );
}
