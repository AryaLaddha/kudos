"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, ArrowLeft, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";

const POINT_OPTIONS = [10, 20, 30, 50, 100];
const HASHTAG_SUGGESTIONS = ["teamwork", "innovation", "leadership", "shipping", "mentorship", "client-success", "above-and-beyond", "problem-solving"];

export default function GiveKudosPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<Profile | null>(null);
  const [points, setPoints] = useState(20);
  const [message, setMessage] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);

      // Fetch teammates (same org, exclude self)
      let query = supabase.from("profiles").select("*").neq("id", user.id);
      if (profile?.org_id) query = query.eq("org_id", profile.org_id);
      const { data: team } = await query.limit(50);
      setTeammates(team ?? []);
    }
    load();
  }, []);

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  function addHashtag(tag: string) {
    const clean = tag.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
    if (clean && !hashtags.includes(clean) && hashtags.length < 3) {
      setHashtags([...hashtags, clean]);
    }
    setTagInput("");
  }

  function removeHashtag(tag: string) {
    setHashtags(hashtags.filter((h) => h !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReceiver || !currentUser) return;
    if (message.trim().length < 10) {
      toast.error("Please write a message of at least 10 characters.");
      return;
    }
    if (points > (currentUser.monthly_allowance ?? 100)) {
      toast.error("You don't have enough points this month.");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("recognitions").insert({
      org_id: currentUser.org_id ?? "00000000-0000-0000-0000-000000000000",
      giver_id: user.id,
      receiver_id: selectedReceiver.id,
      message: message.trim(),
      points,
      hashtags,
    });

    if (error) {
      toast.error("Something went wrong. Please try again.");
    } else {
      toast.success(`🎉 Kudos sent to ${selectedReceiver.full_name}!`);
      router.push("/feed");
    }
    setSubmitting(false);
  }

  const filteredTeammates = teammates.filter((t) =>
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pointsRemaining = (currentUser?.monthly_allowance ?? 100) - points;
  const canSubmit = selectedReceiver && message.trim().length >= 10 && points > 0;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">Give Kudos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Recognise a teammate&apos;s great work</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Recipient picker */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">
            Who are you recognising? *
          </Label>

          {selectedReceiver ? (
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedReceiver.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {getInitials(selectedReceiver.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedReceiver.full_name}</p>
                  {selectedReceiver.job_title && (
                    <p className="text-xs text-slate-500">{selectedReceiver.job_title}</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedReceiver(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                placeholder="Search teammates…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition mb-3"
              />
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {filteredTeammates.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {teammates.length === 0
                      ? "No teammates found — connect Supabase to load your team."
                      : "No results for your search."}
                  </p>
                ) : (
                  filteredTeammates.map((teammate) => (
                    <button
                      type="button"
                      key={teammate.id}
                      onClick={() => { setSelectedReceiver(teammate); setSearchQuery(""); }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={teammate.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                          {getInitials(teammate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{teammate.full_name}</p>
                        {teammate.job_title && <p className="text-xs text-slate-400">{teammate.job_title}</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">
            Your message *
          </Label>
          <Textarea
            required
            placeholder="Tell them specifically what they did and why it mattered…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 text-sm"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-400">Be specific — it makes it more meaningful.</span>
            <span className={cn("text-xs", message.length < 10 ? "text-slate-400" : "text-green-500")}>
              {message.length} chars
            </span>
          </div>
        </div>

        {/* Points */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Points to give *
            </Label>
            <span className="text-xs text-slate-400">
              {pointsRemaining >= 0
                ? `${pointsRemaining} pts remaining after`
                : <span className="text-red-500">Exceeds your allowance</span>}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {POINT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setPoints(opt)}
                className={cn(
                  "rounded-xl border px-5 py-2.5 text-sm font-bold transition-all",
                  points === opt
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">
            Hashtags <span className="text-slate-400 normal-case font-normal">(optional, max 3)</span>
          </Label>

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {hashtags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  #{tag}
                  <button type="button" onClick={() => removeHashtag(tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addHashtag(tagInput); }
              }}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-400 transition"
              disabled={hashtags.length >= 3}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => addHashtag(tagInput)} disabled={hashtags.length >= 3 || !tagInput.trim()}>
              Add
            </Button>
          </div>

          {hashtags.length < 3 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {HASHTAG_SUGGESTIONS.filter((s) => !hashtags.includes(s)).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => addHashtag(s)}
                  className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                >
                  #{s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="flex-1 h-12 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base disabled:opacity-50"
          >
            {submitting ? (
              <>Sending…</>
            ) : (
              <><Heart className="h-4 w-4" /> Send Kudos</>
            )}
          </Button>
          <Link href="/feed">
            <Button type="button" variant="outline" className="h-12 px-6">Cancel</Button>
          </Link>
        </div>

        {!canSubmit && (
          <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" />
            Select a recipient and write a message to continue
          </p>
        )}
      </form>
    </div>
  );
}
