"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Recognition } from "@/types";
import { cn } from "@/lib/utils";

const EMOJI_OPTIONS = ["❤️", "🙌", "🚀", "🎉", "💯"];

interface Props {
  recognition: Recognition;
  currentUserId: string;
}

export default function RecognitionCard({ recognition, currentUserId }: Props) {
  const [reactions, setReactions] = useState<Recognition["reactions"]>(recognition.reactions ?? []);
  const supabase = createClient();

  const giver = recognition.giver;
  const receiver = recognition.receiver;

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

  const timeAgo = formatDistanceToNow(new Date(recognition.created_at));

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Giver */}
          <Link href={`/profile/${recognition.giver_id}`}>
            <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
              <AvatarImage src={giver?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-bold">
                {getInitials(giver?.full_name || "?")}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex items-center gap-1.5 text-sm">
            <Link href={`/profile/${recognition.giver_id}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
              {giver?.full_name || "Someone"}
            </Link>
            <span className="text-slate-400">recognised</span>
            <Link href={`/profile/${recognition.receiver_id}`} className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
              {receiver?.full_name || "Someone"}
            </Link>
          </div>
        </div>
        {/* Points badge */}
        <div className="flex-shrink-0">
          <div className="rounded-full bg-indigo-50 px-3.5 py-1.5 text-sm font-bold text-indigo-600">
            +{recognition.points} pts
          </div>
        </div>
      </div>

      {/* Receiver avatar + message */}
      <div className="flex gap-3 mb-4">
        <Link href={`/profile/${recognition.receiver_id}`}>
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
          <Badge key={tag} variant="secondary" className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-0 text-xs">
            #{tag}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-slate-400">{timeAgo}</span>
      </div>

      {/* Reactions */}
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
      </div>
    </div>
  );
}
