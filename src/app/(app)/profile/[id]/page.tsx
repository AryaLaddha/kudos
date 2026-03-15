import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, Heart, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RecognitionCard from "@/components/app/RecognitionCard";
import type { Recognition } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  // Recognitions received
  const { data: received } = await supabase
    .from("recognitions")
    .select(`
      *,
      giver:profiles!recognitions_giver_id_fkey(*),
      receiver:profiles!recognitions_receiver_id_fkey(*),
      reactions(*),
      comments(*, user:profiles(*))
    `)
    .eq("receiver_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Recognitions given
  const { data: given } = await supabase
    .from("recognitions")
    .select(`*, giver:profiles!recognitions_giver_id_fkey(*), receiver:profiles!recognitions_receiver_id_fkey(*), reactions(*), comments(*, user:profiles(*))`)
    .eq("giver_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const isOwn = user.id === id;
  const initials = profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // Top hashtags from received recognitions
  const allTags = (received ?? []).flatMap((r) => r.hashtags ?? []);
  const tagCounts: Record<string, number> = {};
  allTags.forEach((t) => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; });
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* Profile header */}
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm mb-6">
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16 ring-4 ring-indigo-50">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
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
              <span className="text-xl font-extrabold text-slate-900">{received?.length ?? 0}</span>
            </div>
            <p className="text-xs text-slate-400">Kudos received</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Heart className="h-4 w-4 text-rose-400" />
              <span className="text-xl font-extrabold text-slate-900">{given?.length ?? 0}</span>
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

      {/* Recognitions received */}
      <h2 className="text-base font-bold text-slate-900 mb-4">Kudos received</h2>
      {!received || received.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center mb-6">
          <p className="text-sm text-slate-400">No recognitions yet — be the first to give kudos!</p>
          {!isOwn && (
            <Link href="/give" className="mt-3 inline-block">
              <Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">Give Kudos</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {received.map((r) => (
            <RecognitionCard key={r.id} recognition={r as Recognition} currentUserId={user.id} />
          ))}
        </div>
      )}
    </div>
  );
}
