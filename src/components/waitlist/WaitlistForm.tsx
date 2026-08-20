"use client";
import React from "react";
import { ListenerAvatar } from "@/components/waitlist/ListenerAvatar";
import { Badge } from "@/components/ui/Badge";
import { TRACK_HEX } from "@/lib/trackColors";
import { cn } from "@/lib/utils";

export interface WaitlistFormProps {
  initialCount: number;
}

const HYPE_LINES = [
  "Get ready to trust your ears.",
  "Four models. Zero bias. All yours.",
  "Blind battles are coming for your playlist.",
];

const CONFETTI_COLORS = [TRACK_HEX.A, TRACK_HEX.B, TRACK_HEX.C, TRACK_HEX.D, "var(--accent)", "var(--secondary)"];

const AVATAR_VARIANTS = [
  { letter: "A", variant: "headphones" },
  { letter: "B", variant: "vinyl" },
  { letter: "C", variant: "equalizer" },
  { letter: "D", variant: "note" },
] as const;

const FEATURE_PILLS = [
  { label: "100% free", color: TRACK_HEX.B },
  { label: "Blind judging", color: TRACK_HEX.A },
  { label: "Learns your taste", color: TRACK_HEX.C },
  { label: "Keep the winner", color: TRACK_HEX.D },
];

function FeaturePills() {
  return (
    <div className="wl-pills">
      {FEATURE_PILLS.map((it) => (
        <span className="wl-pill" key={it.label}>
          <span className="wl-pill-dot" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

interface ConfettiPiece {
  id: number;
  tx: number;
  ty: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 64 + Math.random() * 70;
    return {
      id: i,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 16,
      size: 5 + Math.random() * 5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 100,
      duration: 750 + Math.random() * 500,
      rotate: (Math.random() - 0.5) * 520,
    };
  });
}

function useCountUp(target: number, durationMs = 600) {
  const [display, setDisplay] = React.useState(target);
  const fromRef = React.useRef(target);

  React.useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}

export function WaitlistForm({ initialCount }: WaitlistFormProps) {
  const [email, setEmail] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  const [alreadyJoined, setAlreadyJoined] = React.useState(false);
  const [count, setCount] = React.useState(initialCount);
  const displayCount = useCountUp(count);
  const [confetti, setConfetti] = React.useState<ConfettiPiece[]>([]);
  const [hypeLine, setHypeLine] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — try again.");
        return;
      }
      setCount(data.count);
      setAlreadyJoined(data.alreadyJoined);
      setConfetti(makeConfetti());
      setHypeLine(HYPE_LINES[Math.floor(Math.random() * HYPE_LINES.length)]);
      setJoined(true);
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (joined) {
    return (
      <div className="wl-success">
        <span className="wl-success-ring" />
        <span className="wl-success-ring r2" />
        <div className="wl-confetti" aria-hidden="true">
          {confetti.map((p) => (
            <span
              key={p.id}
              style={
                {
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  "--tr": `${p.rotate}deg`,
                  width: p.size,
                  height: p.size * 2.2,
                  background: p.color,
                  animationDelay: `${p.delay}ms`,
                  animationDuration: `${p.duration}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="wl-check">✓</div>
        {!alreadyJoined && (
          <div className="wl-success-badge">
            <Badge tone="accent">#{displayCount} in line</Badge>
          </div>
        )}
        <h2 className="wl-success-title">{alreadyJoined ? "You're already on the list." : "You're on the list."}</h2>
        <p className="wl-success-hype">{hypeLine}</p>
        <p className="wl-success-sub">We&rsquo;ll email you the moment early access opens — free generations, free voting, no catch.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <form className={`wl-form${focused ? " is-focused" : ""}${error ? " has-error" : ""}`} onSubmit={handleSubmit}>
        <input
          type="email"
          required
          className="wl-input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "group relative h-10 shrink-0 overflow-hidden rounded-pill px-4",
            "bg-zinc-900",
            "transition-all duration-200",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          {/* Gradient background effect */}
          <div
            className={cn(
              "absolute inset-0",
              "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
              "opacity-40 group-hover:opacity-80",
              "blur transition-opacity duration-500",
            )}
          />

          {/* Content */}
          <div className="relative flex items-center justify-center gap-2">
            {submitting ? <span className="wl-spinner" /> : <span className="font-display text-sm font-bold text-white">Join waitlist</span>}
          </div>
        </button>
      </form>
      <div className="wl-error">{error}</div>

      <FeaturePills />

      <div className="wl-proof">
        <span className="wl-avatars">
          {AVATAR_VARIANTS.map((a, i) => (
            <ListenerAvatar key={a.letter} color={TRACK_HEX[a.letter]} variant={a.variant} delayMs={i * 260} />
          ))}
        </span>
        <span>
          Join <span className="wl-count">{displayCount}</span> already on the list
        </span>
      </div>
    </div>
  );
}
