"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Recognition, Comment } from "@/types";
import { cn } from "@/lib/utils";
import { MessageCircle, Send, Coins, X } from "lucide-react";
import { toast } from "sonner";

const EMOJI_OPTIONS = ["❤️", "🙌", "🚀", "🎉", "💯"];

interface Props {
  recognition: Recognition;
  currentUserId: string;
}

/** Parses +number from anywhere in comment text, returns { message, tip } */
function parseCommentTip(text: string): { message: string; tip: number } {
  const match = text.match(/\+(\d+)/);
  if (!match) return { message: text, tip: 0 };
  return {
    message: text.replace(/\+\d+\s*/, "").trim(),
    tip: parseInt(match[1], 10),
  };
}

function CommentItem({ comment }: { comment: Comment }) {
  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return (
    <div className="flex gap-2.5">
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
  );
}

export default function RecognitionCard({ recognition, currentUserId }: Props) {
  const router = useRouter();
  const [reactions, setReactions] = useState<Recognition["reactions"]>(recognition.reactions ?? []);
  const [comments, setComments] = useState<Comment[]>(
    [...(recognition.comments ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  );
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userAllowance, setUserAllowance] = useState<number | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const giver = recognition.giver;
  const receiver = recognition.receiver;
  // Use receivers array if available (multi-receiver post), fall back to single receiver
  const receivers = recognition.receivers && recognition.receivers.length > 0
    ? recognition.receivers
    : receiver ? [receiver] : [];
  const receiversLabel = receivers.map((r) => r.full_name).join(" & ") || receiver?.full_name || "Someone";

  // Fetch current user's profile (allowance + name/avatar for optimistic comments)
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, monthly_allowance")
      .eq("id", currentUserId)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserAllowance(data.monthly_allowance);
          setCurrentUserProfile({ id: data.id, full_name: data.full_name, avatar_url: data.avatar_url });
        }
      });
  }, [currentUserId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showModal]);

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
      } else {
        toast.error("Couldn't remove reaction. Please try again.");
      }
    } else {
      const { data, error } = await supabase
        .from("reactions")
        .insert({ recognition_id: recognition.id, user_id: currentUserId, emoji })
        .select()
        .single();
      if (!error && data) {
        const appendedReaction = { ...data, user: currentUserProfile ? { id: currentUserProfile.id, full_name: currentUserProfile.full_name } : undefined };
        setReactions((prev) => [...(prev ?? []), appendedReaction]);
      } else if (error) {
        toast.error("Couldn't add reaction. Please try again.");
      }
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;

    const { message, tip } = parseCommentTip(commentText);
    if (!message) return;

    const totalTip = tip * Math.max(receivers.length, 1);
    if (tip > 0 && userAllowance !== null && totalTip > userAllowance) {
      toast.error(`You only have ${userAllowance} pts available, but this costs ${totalTip} pts.`);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("post_comment", {
      p_recognition_id: recognition.id,
      p_message: message,
      p_points_tip: tip,
    });

    if (error) {
      if (error.message?.includes("insufficient_points")) {
        toast.error("You don't have enough points to tip that amount.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } else {
      // Prepend newest first, attaching current user profile so name shows immediately
      const optimisticComment: Comment = {
        ...(data as Comment),
        user: currentUserProfile ?? undefined,
      };
      setComments((prev) => [optimisticComment, ...prev]);
      setCommentText("");
      setShowCommentBox(false);
      if (tip > 0) {
        setUserAllowance((prev) => (prev !== null ? prev - totalTip : prev));
        router.refresh();
      }
    }
    setSubmitting(false);
  }

  const timeAgo = formatDistanceToNow(new Date(recognition.created_at));
  const { message: previewMessage, tip: previewTip } = parseCommentTip(commentText);

  // Show 2 most recent comments on card (already sorted desc)
  const previewComments = comments.slice(0, 2);
  const hasMoreComments = comments.length > 2;

  // ── Comment form (reused in card + modal) ──────────────────────────────
  const commentForm = (
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
            placeholder={`Say something to ${receiversLabel}… add +10 to tip pts`}
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
        {previewTip > 0 && (
          <p className="text-[10px] flex items-center gap-1 text-amber-600 font-medium pl-1">
            <Coins className="h-3 w-3" />
            Tipping {receiversLabel} {previewTip} pts each
            {receivers.length > 1 && ` (${previewTip * receivers.length} pts total)`}
            {userAllowance !== null && previewTip * Math.max(receivers.length, 1) > userAllowance && (
              <span className="text-red-500 ml-1">— exceeds your balance ({userAllowance} pts)</span>
            )}
          </p>
        )}
        <p className="text-[10px] text-slate-400 pl-1">
          Tip by adding <span className="font-mono bg-slate-100 px-0.5 rounded">+10</span> at the end
        </p>
      </div>
    </form>
  );

  return (
    <>
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${recognition.giver_id}`}>
                <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                  <AvatarImage src={giver?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                    {getInitials(giver?.full_name || "?")}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex items-center gap-1.5 text-sm flex-wrap">
                <Link
                  href={`/profile/${recognition.giver_id}`}
                  className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                >
                  {giver?.full_name || "Someone"}
                </Link>
                <span className="text-slate-400">recognised</span>
                {receivers.map((r, i) => (
                  <span key={r.id} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="text-slate-400">&amp;</span>}
                    <Link
                      href={`/profile/${r.id}`}
                      className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                    >
                      {r.full_name}
                    </Link>
                  </span>
                ))}
                {receivers.length === 0 && (
                  <span className="font-semibold text-slate-900">{receiver?.full_name || "Someone"}</span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="rounded-full bg-indigo-50 px-3.5 py-1.5 text-sm font-bold text-indigo-600">
                +{recognition.points * Math.max(receivers.length, 1)} pts
              </div>
            </div>
          </div>

          {/* Receiver avatar(s) + message */}
          <div className="flex gap-3 mb-4">
            <div className="flex flex-col gap-1">
              {receivers.slice(0, 3).map((r) => (
                <Link key={r.id} href={`/profile/${r.id}`}>
                  <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                    <AvatarImage src={r.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-bold">
                      {getInitials(r.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ))}
              {receivers.length === 0 && (
                <Link href={`/profile/${recognition.receiver_id}`}>
                  <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                    <AvatarImage src={receiver?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-bold">
                      {getInitials(receiver?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </div>
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
              
              const rawReactors = reactions?.filter(r => r.emoji === emoji).map(r => r.user?.full_name || "Someone") || [];
              // Deduplicate in case of quick multi-clicks in dev mode
              const reactors = Array.from(new Set(rawReactors));
              const reactorList = reactors.length > 8 ? [...reactors.slice(0, 8), `and ${reactors.length - 8} more`].join(", ") : reactors.join(", ");

              return (
                <button
                  key={emoji}
                  title={reactorList}
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
          </div>
        </div>

        {/* Comments preview section */}
        {(comments.length > 0 || showCommentBox) && (
          <div className="border-t border-slate-100 px-4 sm:px-6 py-4 space-y-3">
            {/* 2 most recent comments */}
            {previewComments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}

            {/* View all button */}
            {hasMoreComments && (
              <button
                onClick={() => setShowModal(true)}
                className="w-full text-center text-xs text-indigo-500 hover:text-indigo-700 font-medium py-1 transition-colors"
              >
                View all {comments.length} comments
              </button>
            )}

            {/* New comment form */}
            {showCommentBox && commentForm}
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800">
                {giver?.full_name} → {receiversLabel}
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div ref={modalScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Recognition message */}
              <div className="flex gap-3">
                <div className="flex flex-col gap-1">
                  {receivers.slice(0, 3).map((r) => (
                    <Link key={r.id} href={`/profile/${r.id}`}>
                      <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-bold">
                          {getInitials(r.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ))}
                  {receivers.length === 0 && (
                    <Link href={`/profile/${recognition.receiver_id}`}>
                      <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
                        <AvatarImage src={receiver?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-bold">
                          {getInitials(receiver?.full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  )}
                </div>
                <div className="flex-1 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{recognition.message}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {recognition.hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-indigo-50 text-indigo-600 border-0 text-xs">
                        #{tag}
                      </Badge>
                    ))}
                    <span className="ml-auto text-xs text-slate-400">+{recognition.points * Math.max(receivers.length, 1)} pts · {timeAgo}</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100" />

              {/* All comments */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No comments yet. Be the first!</p>
                ) : (
                  comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))
                )}
              </div>
            </div>

            {/* Comment form pinned at bottom */}
            <div className="border-t border-slate-100 px-6 py-4">
              {commentForm}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
