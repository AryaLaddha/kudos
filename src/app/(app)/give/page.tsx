"use client";

import { useState, useEffect, useRef } from "react";
import { Heart, ArrowLeft, X, Coins } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types";
import { cn } from "@/lib/utils";

const HASHTAG_SUGGESTIONS = [
  "teamwork", "innovation", "leadership", "shipping",
  "mentorship", "client-success", "above-and-beyond", "problem-solving",
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

/** Detects an active @mention being typed at the cursor */
function detectMention(text: string, cursorPos: number): { query: string; start: number } | null {
  const textBeforeCursor = text.slice(0, cursorPos);
  const match = textBeforeCursor.match(/@([A-Za-z]*)$/);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: cursorPos - match[0].length };
}

/** Parses the full message to extract @mention recipients and optional trailing +points */
function parseMessage(
  text: string,
  teammates: Profile[]
): { recipients: Array<{ profile: Profile; message: string }>; pointsInText: number | null } {
  // Build first-name → profile map (case-insensitive, first occurrence wins)
  const firstNameMap = new Map<string, Profile>();
  teammates.forEach((t) => {
    const first = t.full_name.split(" ")[0].toLowerCase();
    if (!firstNameMap.has(first)) firstNameMap.set(first, t);
  });

  // Extract trailing +number
  const pointsMatch = text.match(/\+(\d+)\s*$/);
  const pointsInText = pointsMatch ? parseInt(pointsMatch[1], 10) : null;
  const cleanText = text.replace(/\+\d+\s*$/, "").trim();

  // Split by @word — text BEFORE each @name is that person's message
  // e.g. "Thanks for the fix @alice great work @bob +10"
  //   → alice gets "Thanks for the fix", bob gets "great work"
  const parts = cleanText.split(/@([A-Za-z]+)/);
  const recipients: Array<{ profile: Profile; message: string }> = [];
  const seen = new Set<string>();

  for (let i = 1; i < parts.length; i += 2) {
    const profile = firstNameMap.get(parts[i].toLowerCase());
    if (profile && !seen.has(profile.id)) {
      seen.add(profile.id);
      recipients.push({ profile, message: parts[i - 1].trim() });
    }
  }

  // If any message segments are empty, fall back to the full text (minus @mentions)
  const fallback = cleanText.replace(/@[A-Za-z]+/g, "").replace(/\s+/g, " ").trim();
  recipients.forEach((r) => {
    if (!r.message) r.message = fallback;
  });

  return { recipients, pointsInText };
}

export default function GiveKudosPage() {
  const supabase = createClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [messageText, setMessageText] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // @mention autocomplete state
  const [mentionDropdown, setMentionDropdown] = useState<{ query: string; start: number } | null>(null);
  const [mentionResults, setMentionResults] = useState<Profile[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setCurrentUser(profile);
      let query = supabase.from("profiles").select("*").neq("id", user.id);
      if (profile?.org_id) query = query.eq("org_id", profile.org_id);
      const { data: team } = await query.limit(50);
      setTeammates(team ?? []);
    }
    load();
  }, []);

  const { recipients, pointsInText } = parseMessage(messageText, teammates);
  const effectivePoints = pointsInText ?? 0;
  const totalCost = effectivePoints * Math.max(recipients.length, 1);
  const balance = currentUser?.monthly_allowance ?? 0;

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setMessageText(val);

    const mention = detectMention(val, cursor);
    if (mention) {
      setMentionDropdown(mention);
      const filtered = teammates
        .filter((t) =>
          t.full_name.split(" ")[0].toLowerCase().startsWith(mention.query) ||
          t.full_name.toLowerCase().startsWith(mention.query)
        )
        .slice(0, 5);
      setMentionResults(filtered);
    } else {
      setMentionDropdown(null);
      setMentionResults([]);
    }
  }

  function insertMention(profile: Profile) {
    if (!mentionDropdown || !textareaRef.current) return;
    const firstName = profile.full_name.split(" ")[0];
    const cursor = textareaRef.current.selectionStart ?? mentionDropdown.start + 1;
    const before = messageText.slice(0, mentionDropdown.start);
    const after = messageText.slice(cursor);
    const newText = `${before}@${firstName} ${after}`;
    setMessageText(newText);
    setMentionDropdown(null);
    setMentionResults([]);
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = mentionDropdown.start + firstName.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function addHashtag(tag: string) {
    const clean = tag.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
    if (clean && !hashtags.includes(clean) && hashtags.length < 3) setHashtags([...hashtags, clean]);
    setTagInput("");
  }

  function removeHashtag(tag: string) {
    setHashtags(hashtags.filter((h) => h !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || recipients.length === 0) {
      toast.error("Mention at least one teammate with @name.");
      return;
    }
    if (recipients.some((r) => r.message.length < 5)) {
      toast.error("Each person needs a message of at least 5 characters before their @mention.");
      return;
    }
    if (!pointsInText || pointsInText <= 0) {
      toast.error("Add +number at the end of your message to set points (e.g. +20).");
      return;
    }
    if (totalCost > balance) {
      toast.error(`You only have ${balance} pts available, but this costs ${totalCost} pts.`);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("send_multi_recognition", {
      p_org_id: currentUser.org_id ?? "00000000-0000-0000-0000-000000000000",
      p_receivers: recipients.map((r) => r.profile.id),
      p_messages: recipients.map((r) => r.message),
      p_points: effectivePoints,
      p_hashtags: hashtags,
    });

    if (error) {
      if (error.message.includes("insufficient_points")) {
        toast.error("You don't have enough points.");
      } else {
        toast.error("Something went wrong. Please try again.");
        console.error(error);
      }
    } else {
      const names = recipients.map((r) => r.profile.full_name.split(" ")[0]).join(" & ");
      toast.success(`🎉 Kudos sent to ${names}!`);
      window.location.href = "/feed";
    }
    setSubmitting(false);
  }

  const canSubmit = recipients.length > 0 && pointsInText !== null && pointsInText > 0 && totalCost <= balance;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">Give Kudos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Recognise one or more teammates</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Message textarea with @mention autocomplete */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">
            Your message *
          </Label>
          <p className="text-xs text-slate-400 mb-3">
            Use <span className="font-mono bg-slate-100 px-1 rounded">@name</span> to mention teammates and{" "}
            <span className="font-mono bg-slate-100 px-1 rounded">+20</span> at the end to set points.
          </p>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setMentionDropdown(null);
                  setMentionResults([]);
                }
              }}
              placeholder={`Thanks @alice for shipping that critical fix! Great work @bob on the new feature. +20`}
              rows={5}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none resize-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {/* @mention autocomplete dropdown */}
            {mentionResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                {mentionResults.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(profile);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
                      {profile.job_title && <p className="text-xs text-slate-400">{profile.job_title}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recipients preview (shown when @mentions detected) */}
        {recipients.length > 0 && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                Recipients ({recipients.length})
              </p>
              <div className={cn("flex items-center gap-1.5 text-xs font-bold", totalCost > balance ? "text-red-500" : "text-indigo-700")}>
                <Coins className="h-3.5 w-3.5" />
                {totalCost} pts total
                {totalCost > balance && ` — only ${balance} available`}
              </div>
            </div>
            {recipients.map(({ profile, message }) => (
              <div key={profile.id} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-900">{profile.full_name}</span>
                    <span className="text-xs font-bold text-indigo-600">+{effectivePoints} pts</span>
                  </div>
                  {message ? (
                    <p className="text-xs text-slate-500 line-clamp-2">{message}</p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Add text before @{profile.full_name.split(" ")[0]} for a personal message
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hashtags */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">
            Hashtags{" "}
            <span className="text-slate-400 normal-case font-normal">(optional, max 3)</span>
          </Label>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                >
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
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHashtag(tagInput);
                }
              }}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-400 transition"
              disabled={hashtags.length >= 3}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addHashtag(tagInput)}
              disabled={hashtags.length >= 3 || !tagInput.trim()}
            >
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
            {submitting ? "Sending…" : <><Heart className="h-4 w-4" /> Send Kudos</>}
          </Button>
          <Link href="/feed">
            <Button type="button" variant="outline" className="h-12 px-6">
              Cancel
            </Button>
          </Link>
        </div>

        {recipients.length === 0 && (
          <p className="text-center text-xs text-slate-400">
            Type <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">@name</span> to mention teammates
          </p>
        )}
      </form>
    </div>
  );
}
