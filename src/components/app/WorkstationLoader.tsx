"use client";

import { useEffect, useRef, useState } from "react";

interface WorkstationLoaderProps {
  onComplete: () => void;
  duration?: number; // ms, default 2700
}

export function WorkstationLoader({ onComplete, duration = 2700 }: WorkstationLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const startTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const p = Math.min((elapsed / duration) * 100, 100);
      setProgress(p);

      if (p < 100) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setFading(true);
          setTimeout(() => onCompleteRef.current(), 480);
        }, 180);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  // Typing cycle duration: 0.8s at 0% → 0.08s at 100%
  const typingDur = (0.8 - (progress / 100) * 0.72).toFixed(3);

  // Smoke fades in starting at 90%
  const smokeOpacity = Math.max(0, (progress - 90) / 10);

  const message =
    progress < 30
      ? "Signing you in…"
      : progress < 65
      ? "Loading your feed…"
      : progress < 90
      ? "Almost there…"
      : "Ready!";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        opacity: fading ? 0 : 1,
        transition: "opacity 480ms ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Keyframe definitions */}
      <style>{`
        @keyframes kl-type-left {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes kl-type-right {
          0%, 100% { transform: translateY(-6px); }
          50%       { transform: translateY(0px); }
        }
        @keyframes kl-cursor {
          0%, 45%  { opacity: 1; }
          50%, 95% { opacity: 0; }
          100%     { opacity: 1; }
        }
        @keyframes kl-smoke {
          0%   { transform: translateY(0px) scale(1);   opacity: 0.75; }
          100% { transform: translateY(-42px) scale(2.2); opacity: 0; }
        }
        @keyframes kl-steam {
          0%   { transform: translateY(0px) scale(1);   opacity: 0.55; }
          100% { transform: translateY(-28px) scale(1.8); opacity: 0; }
        }
        @keyframes kl-screenpulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1;    }
        }
      `}</style>

      {/* ── Workstation SVG ── */}
      <svg
        viewBox="0 0 480 285"
        width="348"
        height="207"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", marginBottom: "28px" }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="kl-screenGlow" cx="50%" cy="60%" r="55%">
            <stop offset="0%"   stopColor="#818cf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kl-deskGlow" cx="50%" cy="0%" r="60%">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <filter id="kl-softblur">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* ─── Background wall ─── */}
        <rect width="480" height="285" fill="#f8fafc" />

        {/* Subtle ambient glow from screen on wall */}
        <ellipse
          cx="240" cy="140" rx="140" ry="80"
          fill="url(#kl-screenGlow)"
          style={{ animation: "kl-screenpulse 3s ease-in-out infinite" }}
        />

        {/* Wall–desk dividing line */}
        <line x1="0" y1="204" x2="480" y2="204" stroke="#e2e8f0" strokeWidth="1" />

        {/* ─── Desk ─── */}
        <rect x="20" y="204" width="440" height="81" fill="#1e293b" />
        {/* Desk surface top highlight */}
        <rect x="20" y="204" width="440" height="7" fill="#263447" />
        {/* Subtle desk glow from screen light */}
        <rect x="20" y="204" width="440" height="30" fill="url(#kl-deskGlow)" />

        {/* ─── Monitor stand ─── */}
        <rect x="228" y="172" width="24" height="35" rx="3" fill="#2d3f55" />
        <rect x="200" y="202" width="80" height="8"  rx="3" fill="#2d3f55" />

        {/* ─── Monitor body ─── */}
        <rect x="142" y="62" width="196" height="148" rx="14" fill="#1e293b" />
        {/* Screen area */}
        <rect x="154" y="74" width="172" height="116" rx="7" fill="#0f172a" />
        {/* Screen ambient glow */}
        <rect x="154" y="74" width="172" height="116" rx="7" fill="url(#kl-screenGlow)" />

        {/* ─── Screen content ─── */}
        <clipPath id="kl-scr">
          <rect x="164" y="84" width="152" height="96" />
        </clipPath>
        <g clipPath="url(#kl-scr)">
          {/* Line 1 – accent / keyword */}
          <rect x="164" y="86"  width="88"  height="5" rx="2.5" fill="#6366f1" opacity="0.95" />
          {/* Line 2 */}
          <rect x="172" y="98"  width="114" height="4" rx="2"   fill="#818cf8" opacity="0.55" />
          {/* Line 3 */}
          <rect x="172" y="109" width="76"  height="4" rx="2"   fill="#818cf8" opacity="0.45" />
          {/* Line 4 */}
          <rect x="172" y="120" width="100" height="4" rx="2"   fill="#818cf8" opacity="0.4"  />
          {/* Line 5 – accent */}
          <rect x="164" y="131" width="90"  height="4" rx="2.5" fill="#6366f1" opacity="0.7"  />
          {/* Line 6 */}
          <rect x="172" y="142" width="120" height="4" rx="2"   fill="#818cf8" opacity="0.38" />
          {/* Line 7 */}
          <rect x="172" y="153" width="55"  height="4" rx="2"   fill="#818cf8" opacity="0.32" />
          {/* Blinking cursor */}
          <rect
            x="231" y="153" width="2" height="10" rx="1"
            fill="#6366f1"
            style={{ animation: "kl-cursor 1.05s ease-in-out infinite" }}
          />
        </g>

        {/* ─── Keyboard ─── */}
        <rect x="168" y="210" width="144" height="22" rx="6" fill="#2d3f55" />
        {/* Key surface */}
        <rect x="173" y="214" width="134" height="14" rx="4" fill="#3a5068" />
        {/* Individual keys (8 per row) */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={i}
            x={176 + i * 16}
            y={216}
            width="12"
            height="10"
            rx="2"
            fill="#4a6480"
            opacity="0.75"
          />
        ))}

        {/* ─── Character (head peeking above monitor) ─── */}
        {/* Head */}
        <circle cx="240" cy="45" r="21" fill="#94a3b8" />
        {/* Hair */}
        <path d="M 219 41 Q 221 22 240 19 Q 259 22 261 41" fill="#334155" />
        {/* Eyes */}
        <circle cx="231" cy="43" r="2.5" fill="#475569" />
        <circle cx="249" cy="43" r="2.5" fill="#475569" />
        {/* Eye shine */}
        <circle cx="232.2" cy="41.8" r="0.9" fill="white" opacity="0.7" />
        <circle cx="250.2" cy="41.8" r="0.9" fill="white" opacity="0.7" />
        {/* Subtle smile (focused look) */}
        <path d="M 234 50 Q 240 53 246 50" stroke="#64748b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Neck */}
        <rect x="234" y="64" width="12" height="14" rx="5" fill="#94a3b8" />

        {/* ─── Arms reaching around monitor ─── */}
        {/* Left arm – curves from behind monitor left edge to keyboard */}
        <path
          d="M 148 135 C 118 170 148 208 180 222"
          stroke="#475569"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />
        {/* Right arm */}
        <path
          d="M 332 135 C 362 170 332 208 300 222"
          stroke="#475569"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />

        {/* ─── Hands (animated) ─── */}
        {/* Left hand */}
        <ellipse
          cx="180" cy="220" rx="11" ry="7"
          fill="#94a3b8"
          style={{
            transformOrigin: "180px 220px",
            animation: `kl-type-left ${typingDur}s ease-in-out infinite`,
          }}
        />
        {/* Right hand */}
        <ellipse
          cx="300" cy="220" rx="11" ry="7"
          fill="#94a3b8"
          style={{
            transformOrigin: "300px 220px",
            animation: `kl-type-right ${typingDur}s ease-in-out infinite`,
          }}
        />

        {/* ─── Desk accessories ─── */}
        {/* Mug (right side) */}
        <rect x="362" y="192" width="22" height="22" rx="4" fill="#334155" />
        <rect x="364" y="190" width="18" height="5"  rx="2" fill="#2d3f55" />
        {/* Handle */}
        <path d="M 384 197 Q 391 201 384 205" stroke="#2d3f55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Coffee surface */}
        <ellipse cx="373" cy="193" rx="8" ry="3" fill="#7c3aed" opacity="0.45" />
        {/* Mug steam (always on) */}
        <circle cx="369" cy="187" r="2.5" fill="#cbd5e1" opacity="0.5"
          style={{ animation: "kl-steam 1.6s ease-out infinite" }} />
        <circle cx="375" cy="185" r="2"   fill="#cbd5e1" opacity="0.4"
          style={{ animation: "kl-steam 1.6s ease-out 0.55s infinite" }} />

        {/* Small plant (left side) */}
        <rect x="78" y="194" width="18" height="18" rx="3" fill="#334155" />
        <ellipse cx="87" cy="191" rx="16" ry="10" fill="#15803d" />
        <ellipse cx="75" cy="196" rx="10" ry="7"  fill="#16a34a" />
        <ellipse cx="99" cy="196" rx="10" ry="7"  fill="#14532d" />

        {/* ─── Smoke particles (appear at 90%) ─── */}
        {/* Group-level fade-in via opacity transition */}
        <g style={{ opacity: smokeOpacity, transition: "opacity 500ms ease" }}>
          <circle cx="202" cy="206" r="4.5" fill="#c7d2fe"
            style={{ animation: "kl-smoke 1.05s ease-out infinite" }} />
          <circle cx="221" cy="204" r="3.5" fill="#c7d2fe"
            style={{ animation: "kl-smoke 1.05s ease-out 0.22s infinite" }} />
          <circle cx="240" cy="205" r="4.5" fill="#c7d2fe"
            style={{ animation: "kl-smoke 1.05s ease-out 0.44s infinite" }} />
          <circle cx="259" cy="204" r="3"   fill="#c7d2fe"
            style={{ animation: "kl-smoke 1.05s ease-out 0.66s infinite" }} />
          <circle cx="278" cy="206" r="4"   fill="#c7d2fe"
            style={{ animation: "kl-smoke 1.05s ease-out 0.88s infinite" }} />
        </g>
      </svg>

      {/* ── Progress bar + label ── */}
      <div style={{ width: "272px" }}>
        <div
          style={{
            height: "3px",
            width: "100%",
            backgroundColor: "#f1f5f9",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #6366f1, #818cf8)",
              borderRadius: "9999px",
              transition: "width 55ms linear",
            }}
          />
        </div>
        <p
          style={{
            marginTop: "12px",
            textAlign: "center",
            fontSize: "13px",
            color: "#94a3b8",
            fontFamily: "inherit",
            letterSpacing: "0.01em",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
