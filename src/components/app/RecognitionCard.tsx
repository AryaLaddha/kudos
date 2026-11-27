"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { Recognition, Comment } from "@/types";
import { cn } from "@/lib/utils";
import { MessageCircle, Send, Coins, X, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import MarkdownMessage from "@/components/app/MarkdownMessage";

// Type scale used on the card (TLCo: body never below 13px):
//   message 15px · names / buttons 14px · meta, tags, counts 13px.
const REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🙌", label: "Applause" },
  { emoji: "🚀", label: "Ship it" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "💯", label: "100" },
];
const EMOJI_OPTIONS = REACTIONS.map((r) => r.emoji);

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

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2.5">
      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
        <AvatarImage src={comment.user?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-slate-100 text-slate-600 text-[11px] font-bold">
          {getInitials(comment.user?.full_name || "?")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-slate-900">
              {comment.user?.full_name || "Someone"}
            </span>
            {comment.points_tip > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-semibold text-amber-700">
                <Coins className="h-3 w-3" />
                +{comment.points_tip} pts
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{comment.message}</p>
        </div>
        <span className="ml-1 text-[13px] text-slate-500">
          {formatDistanceToNow(new Date(comment.created_at))}
        </span>
      </div>
    </div>
  );
}

/**
 * One "React" button. Hovering it with a mouse (or tapping / pressing it)
 * opens the five reactions above it, Facebook-style. Picking one toggles it.
 */
function ReactionPicker({
  hasReacted,
  onPick,
}: {
  hasReacted: (emoji: string) => boolean;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function openNow() {
    cancelClose();
    setOpen(true);
  }
  function closeSoon() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }

  // Clear a pending close if the card unmounts
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Close on outside tap/click and on Escape
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") openNow(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") closeSoon(); }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={openNow}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
          open ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <SmilePlus className="h-4 w-4" />
        React
      </button>

      {open && (
        // pb-2 is a hover bridge so the pointer can travel from the button
        // to the picker without it closing.
        <div className="absolute bottom-full left-0 z-20 pb-2">
          <div
            role="group"
            aria-label="Pick a reaction"
            className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1 shadow-lg"
          >
            {REACTIONS.map(({ emoji, label }) => {
              const reacted = hasReacted(emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  title={label}
                  aria-label={reacted ? `Remove ${label} reaction` : `React with ${label}`}
                  aria-pressed={reacted}
                  onClick={() => {
                    onPick(emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full text-xl transition-transform duration-150 hover:scale-125 focus-visible:scale-125",
                    reacted && "bg-indigo-50"
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
  const totalPoints = recognition.points * Math.max(receivers.length, 1);

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

  // ── Who gave it to whom: the giver is the post's author ─────────────────
  const attribution = (
    <div className="flex items-start gap-3">
      <Link href={`/profile/${recognition.giver_id}`} className="flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={giver?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-violet-100 text-violet-700 text-[13px] font-bold">
            {getInitials(giver?.full_name || "?")}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-slate-900">
          <Link
            href={`/profile/${recognition.giver_id}`}
            className="font-semibold hover:underline"
          >
            {giver?.full_name || "Someone"}
          </Link>
          <span className="text-slate-500"> recognised </span>
          {receivers.length > 0 ? (
            receivers.map((r, i) => (
              <span key={r.id}>
                {i > 0 && <span className="text-slate-500"> &amp; </span>}
                <Link href={`/profile/${r.id}`} className="font-semibold hover:underline">
                  {r.full_name}
                </Link>
              </span>
            ))
          ) : (
            <span className="font-semibold">{receiver?.full_name || "Someone"}</span>
          )}
        </p>
        <p className="mt-0.5 text-[13px] text-slate-500">{timeAgo}</p>
      </div>
      <span className="flex-shrink-0 rounded-full bg-violet-50 px-3 py-1 text-[13px] font-semibold tabular-nums text-violet-700">
        +{totalPoints} pts
      </span>
    </div>
  );

  const hashtagList = recognition.hashtags.length > 0 && (
    <div className="mt-3 flex flex-wrap gap-2">
      {recognition.hashtags.map((tag) => (
        <span key={tag} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[13px] text-indigo-700">
          #{tag}
        </span>
      ))}
    </div>
  );

  // ── Comment form (reused in card + modal) ──────────────────────────────
  const commentForm = (
    <form onSubmit={handleCommentSubmit} className="flex gap-2.5 pt-1">
      <Avatar className="h-8 w-8 flex-shrink-0 mt-1.5">
        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[11px] font-bold">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-sm text-slate-800 outline-none resize-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            aria-label="Post comment"
            disabled={!previewMessage.trim() || submitting}
            className="absolute right-2 bottom-2 rounded-lg bg-action p-1.5 text-white disabled:opacity-30 hover:bg-action-hover transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {previewTip > 0 && (
          <p className="text-[13px] flex items-center gap-1 text-amber-700 font-medium pl-1">
            <Coins className="h-3.5 w-3.5" />
            Tipping {receiversLabel} {previewTip} pts each
            {receivers.length > 1 && ` (${previewTip * receivers.length} pts total)`}
            {userAllowance !== null && previewTip * Math.max(receivers.length, 1) > userAllowance && (
              <span className="text-red-600 ml-1">— exceeds your balance ({userAllowance} pts)</span>
            )}
          </p>
        )}
        <p className="text-[13px] text-slate-500 pl-1">
          Tip by adding <span className="font-mono bg-slate-100 px-0.5 rounded">+10</span> at the end
        </p>
      </div>
    </form>
  );

  return (
    <>
      <article className="rounded-2xl border border-slate-200 bg-white">
        <div className="p-5 sm:p-6">
          {attribution}

          {/* The giver's message: plain text under the author, no inner box */}
          <MarkdownMessage className="mt-4 text-[15px] leading-relaxed text-slate-800">
            {recognition.message}
          </MarkdownMessage>

          {hashtagList}

          {/* Actions: used reactions with counts, one React button, Comment */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
            {EMOJI_OPTIONS.map((emoji) => {
              const count = getReactionCount(emoji);
              if (count === 0) return null;
              const reacted = hasReacted(emoji);
              const label = REACTIONS.find((r) => r.emoji === emoji)?.label ?? emoji;

              const rawReactors = reactions?.filter(r => r.emoji === emoji).map(r => r.user?.full_name || "Someone") || [];
              // Deduplicate in case of quick multi-clicks in dev mode
              const reactors = Array.from(new Set(rawReactors));
              const reactorList = reactors.length > 8 ? [...reactors.slice(0, 8), `and ${reactors.length - 8} more`].join(", ") : reactors.join(", ");

              return (
                <button
                  key={emoji}
                  type="button"
                  title={reactorList}
                  aria-label={`${label}: ${count}${reacted ? ", including you" : ""}`}
                  aria-pressed={reacted}
                  onClick={() => toggleReaction(emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                    reacted
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {emoji} <span className="font-medium tabular-nums">{count}</span>
                </button>
              );
            })}

            <ReactionPicker hasReacted={hasReacted} onPick={toggleReaction} />

            <button
              type="button"
              onClick={() => setShowCommentBox((v) => !v)}
              aria-expanded={showCommentBox}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                showCommentBox
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <MessageCircle className="h-4 w-4" />
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
          <div className="border-t border-slate-100 px-5 sm:px-6 py-4 space-y-3">
            {/* 2 most recent comments */}
            {previewComments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}

            {/* View all button */}
            {hasMoreComments && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="w-full text-center text-[13px] text-indigo-600 hover:underline font-medium py-1"
              >
                View all {comments.length} comments
              </button>
            )}

            {/* New comment form */}
            {showCommentBox && commentForm}
          </div>
        )}
      </article>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${giver?.full_name ?? "Someone"} recognised ${receiversLabel}`}
            className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-900">Comments</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div ref={modalScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* The recognition itself, same layout as the card */}
              <div>
                {attribution}
                <MarkdownMessage className="mt-4 text-[15px] leading-relaxed text-slate-800">
                  {recognition.message}
                </MarkdownMessage>
                {hashtagList}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100" />

              {/* All comments */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-[13px] text-slate-500 text-center py-4">No comments yet. Be the first!</p>
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
