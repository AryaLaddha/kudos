"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { EnrichedUserGoal } from "@/types";

const MESSAGES = [
  "That's what growth looks like.",
  "One more step closer to the top.",
  "Locked in. Keep it up.",
  "Another one. 🏅",
  "You're building something great.",
  "Consistent. Excellent. You.",
  "The team is lucky to have you.",
  "Hard work, logged.",
  "This is how legends are made.",
  "Look at you go. 🔥",
  "Excellence noted.",
  "Progress is progress. Own it.",
];

interface AchievementCelebrationProps {
  goal: EnrichedUserGoal;
  onDismiss: () => void;
}

export default function AchievementCelebration({
  goal,
  onDismiss,
}: AchievementCelebrationProps) {
  const [visible, setVisible] = useState(true);
  const [bounceDone, setBounceDone] = useState(false);
  const messageRef = useRef(
    MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Stop trophy bounce after 1s
    const bounceTimer = setTimeout(() => setBounceDone(true), 1000);

    // Auto-dismiss after 2.8s
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // allow fade-out to complete
    }, 2800);

    return () => {
      clearTimeout(bounceTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  function handleClick() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div
      onClick={handleClick}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Celebration card */}
      <div
        className={`relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center transition-all duration-400 ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-2"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sparkle dots */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          {[
            "top-4 left-6", "top-6 right-8", "top-12 left-16",
            "bottom-8 left-8", "bottom-6 right-10", "bottom-12 right-20",
          ].map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} h-1.5 w-1.5 rounded-full bg-indigo-300 opacity-60`}
              style={{
                animation: `ping 1.2s ${i * 0.15}s ease-out both`,
              }}
            />
          ))}
        </div>

        {/* Trophy */}
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 ${
            bounceDone ? "" : "animate-bounce"
          }`}
        >
          <Trophy className="h-8 w-8 text-amber-500" />
        </div>

        {/* Points badge */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white shadow-sm">
          <span>+{goal.points} pts</span>
        </div>

        {/* Goal title */}
        <h2 className="mt-2 text-lg font-bold text-slate-900 leading-snug">
          {goal.title}
        </h2>

        {/* Motivational message */}
        <p className="mt-3 text-base font-medium text-indigo-600">
          {messageRef.current}
        </p>

        {/* Dismiss hint */}
        <p className="mt-5 text-xs text-slate-400">Tap anywhere to dismiss</p>
      </div>
    </div>
  );
}
