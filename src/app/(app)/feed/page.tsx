import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
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
      reactions(id, recognition_id, user_id, emoji, created_at),
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

  // Demo recognitions when DB is empty / no org
  const demoRecognitions: Recognition[] = [
    {
      id: "demo-1",
      org_id: "demo",
      giver_id: "a",
      receiver_id: "b",
      message: "Absolutely crushed the Q1 product launch. Every detail was perfect and the team felt so supported throughout. You're a rockstar!",
      points: 50,
      hashtags: ["shipping", "leadership"],
      created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
      giver: { id: "a", org_id: "demo", full_name: "Alex Morgan", avatar_url: null, department: "Product", job_title: "PM", monthly_allowance: 100, points_balance: 50, is_admin: false, created_at: "" },
      receiver: { id: "b", org_id: "demo", full_name: "Jordan Park", avatar_url: null, department: "Engineering", job_title: "Lead Engineer", monthly_allowance: 100, points_balance: 120, is_admin: false, created_at: "" },
      reactions: [{ id: "r1", recognition_id: "demo-1", user_id: "c", emoji: "🚀", created_at: "" }, { id: "r2", recognition_id: "demo-1", user_id: "d", emoji: "❤️", created_at: "" }],
    },
    {
      id: "demo-2",
      org_id: "demo",
      giver_id: "c",
      receiver_id: "d",
      message: "Thank you for stepping up when our biggest client called at 11pm. You turned a crisis into a win. The whole company noticed.",
      points: 30,
      hashtags: ["teamwork", "client-success"],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      giver: { id: "c", org_id: "demo", full_name: "Sam Liu", avatar_url: null, department: "Sales", job_title: "Account Executive", monthly_allowance: 100, points_balance: 70, is_admin: false, created_at: "" },
      receiver: { id: "d", org_id: "demo", full_name: "Riley Chen", avatar_url: null, department: "Support", job_title: "Customer Success", monthly_allowance: 100, points_balance: 85, is_admin: false, created_at: "" },
      reactions: [{ id: "r3", recognition_id: "demo-2", user_id: "a", emoji: "🙌", created_at: "" }, { id: "r4", recognition_id: "demo-2", user_id: "b", emoji: "🎉", created_at: "" }, { id: "r5", recognition_id: "demo-2", user_id: "e", emoji: "🎉", created_at: "" }],
    },
    {
      id: "demo-3",
      org_id: "demo",
      giver_id: "e",
      receiver_id: "a",
      message: "Your code review comments are always so thoughtful and constructive. I've grown more as an engineer from your feedback than anything else.",
      points: 20,
      hashtags: ["mentorship", "code-quality"],
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      giver: { id: "e", org_id: "demo", full_name: "Priya Sharma", avatar_url: null, department: "Engineering", job_title: "Junior Engineer", monthly_allowance: 100, points_balance: 40, is_admin: false, created_at: "" },
      receiver: { id: "a", org_id: "demo", full_name: "Alex Morgan", avatar_url: null, department: "Product", job_title: "PM", monthly_allowance: 100, points_balance: 50, is_admin: false, created_at: "" },
      reactions: [],
    },
  ];

  const isEmpty = !recognitions || recognitions.length === 0;
  const feed = !isEmpty ? recognitionsWithReceivers : demoRecognitions;
  const totalPages = isEmpty ? 1 : Math.max(1, Math.ceil((totalCount ?? 0) / PER_PAGE));

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

      {/* Demo banner */}
      {isEmpty && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <Sparkles className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700">
            <span className="font-semibold">Demo mode</span> — These are sample recognitions. Connect your Supabase database to see real data from your team.
          </p>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-4">
        {feed.map((recognition) => (
          <RecognitionCard
            key={recognition.id}
            recognition={recognition}
            currentUserId={user.id}
          />
        ))}
      </div>

      {/* Pagination */}
      {!isEmpty && (
        <Pagination
          page={pageNum}
          totalPages={totalPages}
          buildHref={(p) => `/feed?page=${p}`}
        />
      )}
    </div>
  );
}
