"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Maximize2, Trophy, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PresentationPerson = {
  id: string;
  name: string;
  avatar: string | null;
  title: string | null;
  points: number;
};

interface LeaderboardPresentationModeProps {
  people: PresentationPerson[];
  sprintName: string;
  sprintDateRange: string | null;
}

const rankCopy: Record<number, { label: string; tone: string; glow: string; ring: string }> = {
  1: {
    label: "1st Place",
    tone: "from-amber-200 via-yellow-400 to-orange-500 text-slate-950",
    glow: "shadow-[0_0_90px_rgba(251,191,36,0.55)]",
    ring: "border-amber-300/70",
  },
  2: {
    label: "2nd Place",
    tone: "from-slate-100 via-slate-300 to-slate-500 text-slate-950",
    glow: "shadow-[0_0_80px_rgba(203,213,225,0.45)]",
    ring: "border-slate-200/70",
  },
  3: {
    label: "3rd Place",
    tone: "from-orange-200 via-orange-400 to-amber-700 text-white",
    glow: "shadow-[0_0_80px_rgba(251,146,60,0.42)]",
    ring: "border-orange-300/70",
  },
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function LeaderboardPresentationMode({
  people,
  sprintName,
  sprintDateRange,
}: LeaderboardPresentationModeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(-1);

  const revealOrder = useMemo(() => people.slice(0, 3).reverse(), [people]);
  const current = step >= 0 ? revealOrder[step] : null;
  const rank = current ? people.findIndex((person) => person.id === current.id) + 1 : null;
  const rankStyle = rank ? rankCopy[rank] : null;
  const canAdvance = step < revealOrder.length - 1;

  const close = useCallback(() => {
    setIsOpen(false);
    setStep(-1);
  }, []);

  const advance = useCallback(() => {
    setStep((currentStep) => Math.min(currentStep + 1, revealOrder.length - 1));
  }, [revealOrder.length]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (["ArrowRight", "ArrowUp", "ArrowDown", "ArrowLeft", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        advance();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [advance, close, isOpen]);

  if (people.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white shadow-sm transition-all hover:bg-indigo-700"
      >
        <Maximize2 className="mr-2 h-4 w-4" />
        Presentation Mode
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950 text-white">
          <button
            type="button"
            onClick={close}
            aria-label="Close presentation mode"
            className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {current && (
            <div className="presentation-reveal absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(99,102,241,0.24),transparent_32%),radial-gradient(circle_at_24%_78%,rgba(245,158,11,0.16),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#020617_100%)]" />
          )}
          {current && (
            <div key={`bursts-${current.id}`} className="pointer-events-none absolute inset-0">
              {Array.from({ length: 18 }).map((_, index) => (
                <span
                  key={index}
                  className="presentation-spark absolute left-1/2 top-1/2 h-1.5 w-12 rounded-full bg-white/80"
                  style={{
                    transform: `rotate(${index * 20}deg) translateX(${index % 2 === 0 ? 14 : 8}rem)`,
                    animationDelay: `${index * 28}ms`,
                  }}
                />
              ))}
            </div>
          )}

          <main className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-12">
            {current && rank && rankStyle ? (
              <section
                key={current.id}
                className="presentation-reveal flex w-full max-w-4xl flex-col items-center text-center"
              >
                <div className="mb-7 flex items-center gap-3 text-xs font-black uppercase tracking-[0.32em] text-white/55">
                  <span>{sprintName}</span>
                  {sprintDateRange && <span className="hidden sm:inline text-white/25">/</span>}
                  {sprintDateRange && <span className="hidden sm:inline">{sprintDateRange}</span>}
                </div>

                <div className={cn("relative mb-8 rounded-full p-2", rankStyle.glow)}>
                  <div className={cn("absolute inset-0 rounded-full border-2 opacity-80 presentation-pulse", rankStyle.ring)} />
                  <Avatar className="h-36 w-36 border-4 border-white/90 bg-white/10 sm:h-48 sm:w-48">
                    <AvatarImage src={current.avatar ?? undefined} />
                    <AvatarFallback className="bg-indigo-100 text-4xl font-black text-indigo-700 sm:text-6xl">
                      {getInitials(current.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className={cn("mb-6 inline-flex items-center rounded-full bg-gradient-to-r px-6 py-3 text-sm font-black uppercase tracking-[0.24em]", rankStyle.tone)}>
                  {rank === 1 ? <Trophy className="mr-3 h-5 w-5" /> : <span className="mr-3 text-lg">#{rank}</span>}
                  {rankStyle.label}
                </div>

                <h2 className="max-w-4xl text-5xl font-black tracking-normal text-white sm:text-7xl lg:text-8xl">
                  {current.name}
                </h2>
                {current.title && (
                  <p className="mt-4 max-w-2xl text-lg font-semibold text-white/55 sm:text-2xl">
                    {current.title}
                  </p>
                )}

                <div className="mt-10 rounded-2xl border border-white/10 bg-white/10 px-8 py-5 backdrop-blur">
                  <p className="text-4xl font-black text-white sm:text-6xl">+{Math.round(current.points)}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.26em] text-white/45">Sprint Points</p>
                </div>
              </section>
            ) : (
              <div className="h-1 w-1" aria-hidden="true" />
            )}
          </main>

          {current && canAdvance && (
            <button
              type="button"
              onClick={advance}
              aria-label="Reveal next placement"
              className="absolute bottom-5 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
