"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Recognition, Comment } from "@/types";
import { cn } from "@/lib/utils";
import { MessageCircle, Send, Coins } from "lucide-react";

const EMOJI_OPTIONS = ["❤️", "🙌", "🚀", "🎉", "💯"];

interface Props {
  recognition: Recognition;
  currentUserId: string;
}

/** Parses trailing +number from comment text, returns { message, tip } */
function parseCommentTip(text: string): { message: string; tip: number } {
  const match = text.match(/\+(\d+)\s*$/);
  if (!match) return { message: text, tip: 0 };
  return {
    message: text.replace(/\+\d+\s*$/, "").trim(),
    tip: parseInt(match[1], 10),
  };
}

export default function RecognitionCard({ recognition, currentUserId }: Props) {
  const [reactions, setReactions] = useState<Recognition["reactions"]>(recognition.reactions ?? []);
  const [comments, setComments] = useState<Comment[]>(
    [...(recognition.comments ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  );
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userAllowance, setUserAllowance] = useState<number | null>(null);
  const supabase = createClient();

  const giver = recognition.giver;
  const receiver = recognition.receiver;

  // Fetch current user's allowance for tip validation
  useEffect(() => {
    supabase
      .from("profiles")
      .select("monthly_allowance")
      .eq("id", currentUserId)
      .single()
      .then(({ data }) => {
        if (data) setUserAllowance(data.monthly_allowance);
      });
  }, [currentUserId]);

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  function getReactionCount(emoji: string) {
    return reactions?.filter((r) => r.emoji === emoji).length ?? 0;
  }

  function hasReacted(emoji: string) {
    return reactions?.some((r) => r.emoji === emoji && r.user_id === currentUserId) ?? false;
  }

  async function toggleReaction(emoji: string) {
    if (hasReacted(emoji)) {
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("recognition_id", recognition.id)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji);
      if (!error) {
        setReactions((prev) => prev?.filter((r) => !(r.emoji === emoji && r.user_id === currentUserId)));
      }
    } else {
      const { data, error } = await supabase
        .from("reactions")
        .insert({ recognition_id: recognition.id, user_id: currentUserId, emoji })
        .select()
        .single();
      if (!error && data) {
        setReactions((prev) => [...(prev ?? []), data]);
      }
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    const { message, tip } = parseCommentTip(commentText);

    if (!message) {
      return; // only had a +number, no actual text
    }

    // Validate tip against balance
    if (tip > 0 && userAllowance !== null && tip > userAllowance) {
      alert(`You only have ${userAllowance} pts available.`);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("post_comment", {
      p_recognition_id: recognition.id,
      p_message: message,
      p_points_tip: tip,
    });

    if (!error && data) {
      setComments((prev) => [...prev, data as Comment]);
      setCommentText("");
      setShowCommentBox(false);
      if (tip > 0) {
        setUserAllowance((prev) => (prev !== null ? prev - tip : prev));
      }
    } else if (error?.message?.includes("insufficient_points")) {
      alert("You don't have enough points to tip that amount.");
    }
    setSubmitting(false);
  }

  const timeAgo = formatDistanceToNow(new Date(recognition.created_at));
  const isDemo = recognition.id.startsWith("demo-");

  // Parse tip from current comment input for live preview
  const { message: previewMessage, tip: previewTip } = parseCommentTip(commentText);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link href={isDemo ? "#" : `/profile/${recognition.giver_id}`}>
              <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                <AvatarImage src={giver?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                  {getInitials(giver?.full_name || "?")}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex items-center gap-1.5 text-sm">
              <Link
                href={isDemo ? "#" : `/profile/${recognition.giver_id}`}
                className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
              >
                {giver?.full_name || "Someone"}
              </Link>
              <span className="text-slate-400">recognised</span>
              <Link
                href={isDemo ? "#" : `/profile/${recognition.receiver_id}`}
                className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
              >
                {receiver?.full_name || "Someone"}
              </Link>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className="rounded-full bg-indigo-50 px-3.5 py-1.5 text-sm font-bold text-indigo-600">
              +{recognition.points} pts
            </div>
          </div>
        </div>

        {/* Receiver avatar + message */}
        <div className="flex gap-3 mb-4">
          <Link href={isDemo ? "#" : `/profile/${recognition.receiver_id}`}>
            <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
              <AvatarImage src={receiver?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-bold">
                {getInitials(receiver?.full_name || "?")}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-700 leading-relaxed">{recognition.message}</p>
          </div>
        </div>

        {/* Hashtags + time */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {recognition.hashtags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-0 text-xs"
            >
              #{tag}
            </Badge>
          ))}
          <span className="ml-auto text-xs text-slate-400">{timeAgo}</span>
        </div>

        {/* Reactions + Comment button */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {EMOJI_OPTIONS.map((emoji) => {
            const count = getReactionCount(emoji);
            const reacted = hasReacted(emoji);
            if (count === 0 && !reacted) return null;
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  reacted
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {emoji} <span className="font-medium">{count}</span>
              </button>
            );
          })}
          {EMOJI_OPTIONS.map((emoji) => {
            const count = getReactionCount(emoji);
            const reacted = hasReacted(emoji);
            if (count > 0 || reacted) return null;
            return (
              <button
                key={`add-${emoji}`}
                onClick={() => toggleReaction(emoji)}
                className="flex items-center gap-1 rounded-full border border-dashed border-slate-200 px-2.5 py-1 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors"
              >
                {emoji}
              </button>
            );
          })}

          {/* Comment toggle */}
          {!isDemo && (
            <button
              onClick={() => setShowCommentBox((v) => !v)}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                showCommentBox
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {comments.length === 0
                ? "Comment"
                : comments.length === 1
                ? "1 comment"
                : `${comments.length} comments`}
            </button>
          )}
        </div>
      </div>

      {/* Comments section */}
      {!isDemo && (comments.length > 0 || showCommentBox) && (
        <div className="border-t border-slate-100 px-6 py-4 space-y-3">
          {/* Existing comments */}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                <AvatarImage src={comment.user?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {getInitials(comment.user?.full_name || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-800">
                      {comment.user?.full_name || "Someone"}
                    </span>
                    {comment.points_tip > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                        <Coins className="h-2.5 w-2.5" />
                        +{comment.points_tip} pts
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{comment.message}</p>
                </div>
                <span className="text-[10px] text-slate-400 ml-1">
                  {formatDistanceToNow(new Date(comment.created_at))}
                </span>
              </div>
            </div>
          ))}

          {/* New comment form */}
          {showCommentBox && (
            <form onSubmit={handleCommentSubmit} className="flex gap-2.5 pt-1">
              <Avatar className="h-7 w-7 flex-shrink-0 mt-1.5">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {getInitials("You")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <div className="relative">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleCommentSubmit(e as unknown as React.FormEvent);
                      }
                    }}
                    placeholder={`Say something to ${receiver?.full_name || "them"}… add +10 to tip pts`}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-xs text-slate-800 outline-none resize-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!previewMessage.trim() || submitting}
                    className="absolute right-2 bottom-2 rounded-lg bg-indigo-600 p-1.5 text-white disabled:opacity-30 hover:bg-indigo-700 transition-colors"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </div>
                {/* Live tip preview */}
                {previewTip > 0 && (
                  <p className="text-[10px] flex items-center gap-1 text-amber-600 font-medium pl-1">
                    <Coins className="h-3 w-3" />
                    Tipping {receiver?.full_name?.split(" ")[0] || "them"} {previewTip} pts
                    {userAllowance !== null && previewTip > userAllowance && (
                      <span className="text-red-500 ml-1">— exceeds your balance ({userAllowance} pts)</span>
                    )}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 pl-1">
                  Tip by adding <span className="font-mono bg-slate-100 px-0.5 rounded">+10</span> at the end
                </p>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
