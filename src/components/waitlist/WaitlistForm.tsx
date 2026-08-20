"use client";
import React from "react";
import { ListenerAvatar } from "@/components/waitlist/ListenerAvatar";
import { TRACK_HEX } from "@/lib/trackColors";

export interface WaitlistFormProps {
  initialCount: number;
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
        <div className="wl-check">✓</div>
        <h2>{alreadyJoined ? "You're already on the list." : "You're in."}</h2>
        <p>We&rsquo;ll email you the moment early access opens — free generations, free voting, no catch.</p>
      </div>
    );
  }

  return (
    <div>
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
        <button type="submit" className="wl-submit" disabled={submitting || !email.trim()}>
          <span className="wl-submit-icon">{submitting ? <span className="wl-spinner" /> : "▶"}</span>
          <span>{submitting ? "Joining…" : "Join waitlist"}</span>
        </button>
      </form>
      <div className="wl-error">{error}</div>
      <div className="wl-proof">
        <span className="wl-avatars">
          {(["A", "B", "C", "D"] as const).map((t, i) => (
            <ListenerAvatar key={t} color={TRACK_HEX[t]} delayMs={i * 260} />
          ))}
        </span>
        <span>
          Join <span className="wl-count">{displayCount}</span> already on the list
        </span>
      </div>
    </div>
  );
}
