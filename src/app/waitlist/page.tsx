import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";
import { getCount } from "@/lib/waitlist/store";
import "@/styles/waitlist.css";

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

      <Link href="/" className="wl-home-link">
        Harmony
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

        <div className="rise d4" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <WaitlistForm initialCount={count} />
        </div>
      </div>
    </div>
  );
}
