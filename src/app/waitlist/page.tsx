import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { getCount } from "@/lib/waitlist/store";
import { TRACK_HEX } from "@/lib/trackColors";
import "@/styles/waitlist.css";

const TRACK_HEX_LIST = [TRACK_HEX.A, TRACK_HEX.B, TRACK_HEX.C, TRACK_HEX.D];
const NOTE_GLYPHS = ["♪", "♫", "♩", "♬"];

function FloatingNotes() {
  const notes = Array.from({ length: 8 }, (_, i) => {
    const left = 6 + ((i * 37) % 88);
    const duration = 7 + (i % 4) * 1.6;
    const delay = i * 1.1;
    const size = 16 + (i % 3) * 6;
    return { left, duration, delay, size, glyph: NOTE_GLYPHS[i % NOTE_GLYPHS.length], color: TRACK_HEX_LIST[i % 4] };
  });
  return (
    <div className="wl-notes" aria-hidden="true">
      {notes.map((n, i) => (
        <span
          key={i}
          className="wl-note"
          style={{
            left: `${n.left}%`,
            fontSize: n.size,
            color: n.color,
            animationDuration: `${n.duration}s`,
            animationDelay: `${n.delay}s`,
          }}
        >
          {n.glyph}
        </span>
      ))}
    </div>
  );
}

function Waveform() {
  const bars = Array.from({ length: 28 }, (_, i) => {
    const peak = 30 + ((i * 53) % 62);
    const duration = 1 + ((i * 17) % 5) * 0.16;
    const delay = (i % 9) * 0.11;
    return { peak, duration, delay, color: TRACK_HEX_LIST[i % 4] };
  });
  return (
    <div className="wl-waveform rise d3" aria-hidden="true">
      {bars.map((b, i) => (
        <i
          key={i}
          style={
            {
              "--peak": `${b.peak}%`,
              background: b.color,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export const metadata: Metadata = {
  title: "Harmony — Early Access",
  description: "Four AI models make your track, free. You judge them blind and pick the winner.",
};

// Reads the live signup count from disk on every request — must not be
// statically prerendered, or the count freezes at whatever it was at build time.
export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const count = await getCount();

  return (
    <div className="wl-page">
      <div className="wl-grid" />
      <div className="wl-glow-top" />
      <div className="wl-arc" />
      <FloatingNotes />

      <Link href="/" className="wl-home-link">
        <span className="wl-home-link-arrow">←</span> Harmony
      </Link>

      <div className="wl-content">
        <div className="wl-mark rise">
          <i />
          <i />
          <i />
        </div>

        <div className="wl-eyebrow rise d1">
          <span className="wl-eyebrow-line" />
          <span>Early access</span>
          <span className="wl-eyebrow-line right" />
        </div>

        <h1 className="wl-title rise d2">Harmony</h1>

        <p className="wl-subtitle rise d3">
          Four AI models generate your track from one prompt. You listen blind, vote head-to-head, and keep whatever wins —
          free while we build the leaderboard.
        </p>

        <Waveform />

        <div className="rise d4" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <WaitlistForm initialCount={count} />
        </div>
      </div>
    </div>
  );
}
