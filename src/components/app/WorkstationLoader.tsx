"use client";

import { useEffect, useRef, useState } from "react";

interface WorkstationLoaderProps {
  onComplete: () => void;
  duration?: number; // ms, default 2700
}

// TLCo palette (see globals.css). Mixes are two brand colours blended.
const C = {
  ecru: "#f6f6f4",
  line: "#dfd9d7", // Plum 12% on Ecru
  track: "#ebe7e5", // Plum 6% on Ecru
  plum: "#380100",
  leather: "#580703",
  midnight: "#181d26",
  midnightDeep: "#11141b", // Midnight 70% + black
  midnight10: "#2e333b", // Midnight + 10% Ecru
  midnight20: "#44484f", // Midnight + 20% Ecru
  midnight30: "#5b5e64", // Midnight + 30% Ecru
  bigApple: "#ff222d",
  cornflower: "#9fbeef",
  peach: "#fad8cf",
  blush: "#ffa8a8",
  fg2: "#5a3a37",
  fg3: "#8a6e6b",
};

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
        backgroundColor: C.ecru,
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
        {/* ─── Background wall ─── */}
        <rect width="480" height="285" fill={C.ecru} />

        {/* Wall–desk dividing line */}
        <line x1="0" y1="204" x2="480" y2="204" stroke={C.line} strokeWidth="1" />

        {/* ─── Desk ─── */}
        <rect x="20" y="204" width="440" height="81" fill={C.plum} />
        {/* Desk surface top highlight */}
        <rect x="20" y="204" width="440" height="7" fill={C.leather} />

        {/* ─── Monitor stand ─── */}
        <rect x="228" y="172" width="24" height="35" rx="3" fill={C.midnight10} />
        <rect x="200" y="202" width="80" height="8"  rx="3" fill={C.midnight10} />

        {/* ─── Monitor body ─── */}
        <rect x="142" y="62" width="196" height="148" rx="14" fill={C.midnight} />
        {/* Screen area */}
        <rect x="154" y="74" width="172" height="116" rx="7" fill={C.midnightDeep} />

        {/* ─── Screen content ─── */}
        <clipPath id="kl-scr">
          <rect x="164" y="84" width="152" height="96" />
        </clipPath>
        <g clipPath="url(#kl-scr)">
          {/* Line 1 – accent / keyword */}
          <rect x="164" y="86"  width="88"  height="5" rx="2.5" fill={C.bigApple} opacity="0.95" />
          {/* Line 2 */}
          <rect x="172" y="98"  width="114" height="4" rx="2"   fill={C.cornflower} opacity="0.55" />
          {/* Line 3 */}
          <rect x="172" y="109" width="76"  height="4" rx="2"   fill={C.cornflower} opacity="0.45" />
          {/* Line 4 */}
          <rect x="172" y="120" width="100" height="4" rx="2"   fill={C.cornflower} opacity="0.4"  />
          {/* Line 5 – accent */}
          <rect x="164" y="131" width="90"  height="4" rx="2.5" fill={C.bigApple} opacity="0.7"  />
          {/* Line 6 */}
          <rect x="172" y="142" width="120" height="4" rx="2"   fill={C.cornflower} opacity="0.38" />
          {/* Line 7 */}
          <rect x="172" y="153" width="55"  height="4" rx="2"   fill={C.cornflower} opacity="0.32" />
          {/* Blinking cursor */}
          <rect
            x="231" y="153" width="2" height="10" rx="1"
            fill={C.bigApple}
            style={{ animation: "kl-cursor 1.05s ease-in-out infinite" }}
          />
        </g>

        {/* ─── Keyboard ─── */}
        <rect x="168" y="210" width="144" height="22" rx="6" fill={C.midnight10} />
        {/* Key surface */}
        <rect x="173" y="214" width="134" height="14" rx="4" fill={C.midnight20} />
        {/* Individual keys (8 per row) */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={i}
            x={176 + i * 16}
            y={216}
            width="12"
            height="10"
            rx="2"
            fill={C.midnight30}
            opacity="0.75"
          />
        ))}

        {/* ─── Character (head peeking above monitor) ─── */}
        {/* Head */}
        <circle cx="240" cy="45" r="21" fill={C.peach} />
        {/* Hair */}
        <path d="M 219 41 Q 221 22 240 19 Q 259 22 261 41" fill={C.plum} />
        {/* Eyes */}
        <circle cx="231" cy="43" r="2.5" fill={C.plum} />
        <circle cx="249" cy="43" r="2.5" fill={C.plum} />
        {/* Eye shine */}
        <circle cx="232.2" cy="41.8" r="0.9" fill="white" opacity="0.7" />
        <circle cx="250.2" cy="41.8" r="0.9" fill="white" opacity="0.7" />
        {/* Subtle smile (focused look) */}
        <path d="M 234 50 Q 240 53 246 50" stroke={C.fg2} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Neck */}
        <rect x="234" y="64" width="12" height="14" rx="5" fill={C.peach} />

        {/* ─── Arms reaching around monitor (the Big Apple jacket) ─── */}
        {/* Left arm – curves from behind monitor left edge to keyboard */}
        <path
          d="M 148 135 C 118 170 148 208 180 222"
          stroke={C.bigApple}
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />
        {/* Right arm */}
        <path
          d="M 332 135 C 362 170 332 208 300 222"
          stroke={C.bigApple}
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />

        {/* ─── Hands (animated) ─── */}
        {/* Left hand */}
        <ellipse
          cx="180" cy="220" rx="11" ry="7"
          fill={C.peach}
          style={{
            transformOrigin: "180px 220px",
            animation: `kl-type-left ${typingDur}s ease-in-out infinite`,
          }}
        />
        {/* Right hand */}
        <ellipse
          cx="300" cy="220" rx="11" ry="7"
          fill={C.peach}
          style={{
            transformOrigin: "300px 220px",
            animation: `kl-type-right ${typingDur}s ease-in-out infinite`,
          }}
        />

        {/* ─── Desk accessories ─── */}
        {/* Mug (right side) */}
        <rect x="362" y="192" width="22" height="22" rx="4" fill={C.midnight} />
        <rect x="364" y="190" width="18" height="5"  rx="2" fill={C.midnight10} />
        {/* Handle */}
        <path d="M 384 197 Q 391 201 384 205" stroke={C.midnight10} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Coffee surface */}
        <ellipse cx="373" cy="193" rx="8" ry="3" fill={C.leather} opacity="0.6" />
        {/* Mug steam (always on) */}
        <circle cx="369" cy="187" r="2.5" fill={C.line} opacity="0.5"
          style={{ animation: "kl-steam 1.6s ease-out infinite" }} />
        <circle cx="375" cy="185" r="2"   fill={C.line} opacity="0.4"
          style={{ animation: "kl-steam 1.6s ease-out 0.55s infinite" }} />

        {/* Small plant (left side) */}
        <rect x="78" y="194" width="18" height="18" rx="3" fill={C.leather} />
        <ellipse cx="87" cy="191" rx="16" ry="10" fill="#15803d" />
        <ellipse cx="75" cy="196" rx="10" ry="7"  fill="#16a34a" />
        <ellipse cx="99" cy="196" rx="10" ry="7"  fill="#14532d" />

        {/* ─── Smoke particles (appear at 90%) ─── */}
        {/* Group-level fade-in via opacity transition */}
        <g style={{ opacity: smokeOpacity, transition: "opacity 500ms ease" }}>
          <circle cx="202" cy="206" r="4.5" fill={C.blush}
            style={{ animation: "kl-smoke 1.05s ease-out infinite" }} />
          <circle cx="221" cy="204" r="3.5" fill={C.blush}
            style={{ animation: "kl-smoke 1.05s ease-out 0.22s infinite" }} />
          <circle cx="240" cy="205" r="4.5" fill={C.blush}
            style={{ animation: "kl-smoke 1.05s ease-out 0.44s infinite" }} />
          <circle cx="259" cy="204" r="3"   fill={C.blush}
            style={{ animation: "kl-smoke 1.05s ease-out 0.66s infinite" }} />
          <circle cx="278" cy="206" r="4"   fill={C.blush}
            style={{ animation: "kl-smoke 1.05s ease-out 0.88s infinite" }} />
        </g>
      </svg>

      {/* ── Progress bar + label ── */}
      <div style={{ width: "272px" }}>
        <div
          style={{
            height: "3px",
            width: "100%",
            backgroundColor: C.track,
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: C.bigApple,
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
            color: C.fg3,
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
