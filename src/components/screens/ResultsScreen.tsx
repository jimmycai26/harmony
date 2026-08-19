"use client";
import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WaveformPlayer } from "@/components/ui/WaveformPlayer";
import { getLayers } from "@/lib/api/client";
import type { Genre, Placement, PlacementEntry, Scope, Stem, TrackLetter } from "@/lib/api/types";
import { genreLabel, scopeLabel } from "@/lib/scopeGenre";
import { TRACK_COLORS, TRACK_HEX } from "@/lib/trackColors";

export interface ResultsScreenProps {
  placement: Placement;
  prompt: string;
  scope: Scope;
  genre: Genre;
  trackAudioUrls: Partial<Record<TrackLetter, string>>;
  onRestart: () => void;
}

function StemRow({ trackLetter, stem, dimmed, onSolo, solo }: { trackLetter: TrackLetter; stem: Stem; dimmed: boolean; solo: boolean; onSolo: () => void }) {
  const [playing, setPlaying] = React.useState(false);
  return (
    <div className="layer-row" style={{ opacity: dimmed ? 0.32 : 1 }}>
      <button
        onClick={onSolo}
        style={{
          width: 66,
          flexShrink: 0,
          background: solo ? TRACK_COLORS[trackLetter] : "transparent",
          color: solo ? "#0E0C0A" : "var(--text-muted)",
          border: `1px solid ${solo ? TRACK_HEX[trackLetter] : "var(--border-strong)"}`,
          borderRadius: "var(--radius-pill)",
          padding: "6px 0",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          letterSpacing: "var(--tracking-wide)",
        }}
      >
        SOLO
      </button>
      <span style={{ width: 68, flexShrink: 0, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-heading)" }}>{stem.label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <WaveformPlayer src={stem.url} playing={playing && !dimmed} color={TRACK_COLORS[trackLetter]} height={34} onTogglePlay={() => setPlaying((p) => !p)} />
      </div>
      <a className="dl" href={stem.url} download={`Track ${trackLetter} - ${stem.label}.wav`}>
        ↓ WAV
      </a>
    </div>
  );
}

function LadderRow({ rank, entry, audioUrl, revealed }: { rank: number; entry: PlacementEntry; audioUrl?: string; revealed: boolean }) {
  const [playing, setPlaying] = React.useState(false);
  const letter = entry.track.letter;
  return (
    <div className="ladder-row" style={{ "--tc": TRACK_HEX[letter] } as React.CSSProperties}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-faint)", width: 18 }}>{rank}</span>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: TRACK_COLORS[letter],
            color: "#0E0C0A",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {letter}
        </span>
        <div style={{ width: 168, flexShrink: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-heading)", opacity: revealed ? 1 : 0.25, transition: "opacity 500ms var(--ease-out)" }}>
            {revealed ? entry.model.name : `Track ${letter}`}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {audioUrl ? (
            <WaveformPlayer src={audioUrl} playing={playing} color={TRACK_COLORS[letter]} height={36} onTogglePlay={() => setPlaying((p) => !p)} />
          ) : (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
              This model didn&rsquo;t finish generating — no audio.
            </span>
          )}
        </div>
        {audioUrl && (
          <a className="dl" href={audioUrl} download={`Track ${letter} - master.wav`}>
            ↓ WAV
          </a>
        )}
      </div>
    </div>
  );
}

export function ResultsScreen({ placement, prompt, scope, genre, trackAudioUrls, onRestart }: ResultsScreenProps) {
  const [reveal, setReveal] = React.useState(false);
  const [playingWinner, setPlayingWinner] = React.useState(false);
  const [stemsOpen, setStemsOpen] = React.useState(false);
  const [stems, setStems] = React.useState<Stem[] | null>(null);
  const [stemsLoading, setStemsLoading] = React.useState(false);
  const [solo, setSolo] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setReveal(true), 420);
    return () => clearTimeout(t);
  }, []);

  const winner = placement.first;
  const runnersUp = [placement.second, placement.third, placement.fourth];
  const winnerAudio = trackAudioUrls[winner.track.letter];

  async function toggleStems() {
    if (stemsOpen) {
      setStemsOpen(false);
      return;
    }
    setStemsOpen(true);
    if (!stems) {
      setStemsLoading(true);
      try {
        const res = await getLayers(winner.track.id);
        setStems(res.stems);
      } finally {
        setStemsLoading(false);
      }
    }
  }

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div className="ambient-orange" style={{ background: `radial-gradient(760px 360px at 50% 0%, ${TRACK_HEX[winner.track.letter]}2E, transparent 70%)` }} />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 96px", fontFamily: "var(--font-body)", position: "relative" }}>
        <div className="eyebrow">The blind is off</div>
        <h1 className="rise" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", letterSpacing: "-0.03em", marginBottom: 6 }}>
          Your track is{" "}
          <span style={{ color: TRACK_COLORS[winner.track.letter], opacity: reveal ? 1 : 0, transition: "opacity 500ms var(--ease-out)" }}>
            {winner.model.name}
          </span>
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 26, maxWidth: "62ch" }}>
          Take the master, pull it apart into stems, or grab any of the runners-up — everything you heard is yours to keep.
        </p>

        <div className="winner-card rise d1" style={{ "--tc": TRACK_HEX[winner.track.letter] } as React.CSSProperties}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: TRACK_COLORS[winner.track.letter],
                  color: "#0E0C0A",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: "var(--text-md)",
                }}
              >
                {winner.track.letter}
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--text-heading)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {reveal ? winner.model.name : `Track ${winner.track.letter}`}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)", marginTop: 3 }}>
                  WON THE BRACKET · {scopeLabel(scope).toUpperCase()} · {genreLabel(genre).toUpperCase()}
                </div>
              </div>
            </div>
            <Badge tone="success">Your favorite</Badge>
          </div>

          {prompt && (
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", borderLeft: `2px solid ${TRACK_COLORS[winner.track.letter]}`, paddingLeft: 12, margin: "0 0 16px" }}>
              &ldquo;{prompt}&rdquo;
            </p>
          )}

          {winnerAudio && (
            <WaveformPlayer src={winnerAudio} playing={playingWinner} color={TRACK_COLORS[winner.track.letter]} height={72} meter onTogglePlay={() => setPlayingWinner((p) => !p)} />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {winnerAudio && (
              <a href={winnerAudio} download={`Track ${winner.track.letter} - master.wav`}>
                <Button>↓ Download master</Button>
              </a>
            )}
            <Button variant="secondary" onClick={toggleStems}>
              {stemsOpen ? "Hide stems" : "Pull apart into 4 stems"}
            </Button>
          </div>

          {stemsOpen && (
            <div className="rise" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border-default)", paddingTop: 16 }}>
              {stemsLoading && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>Splitting stems…</span>}
              {stems?.map((s) => (
                <StemRow
                  key={s.type}
                  trackLetter={winner.track.letter}
                  stem={s}
                  dimmed={!!solo && solo !== s.type}
                  solo={solo === s.type}
                  onSolo={() => setSolo((cur) => (cur === s.type ? null : s.type))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rise d2" style={{ marginTop: 40 }}>
          <div className="eyebrow">The full ladder · everything you heard</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {runnersUp.map((entry, i) => (
              <LadderRow key={entry.track.id} rank={i + 2} entry={entry} audioUrl={trackAudioUrls[entry.track.letter]} revealed={reveal} />
            ))}
          </div>
        </div>

        <div className="rise d4" style={{ marginTop: 40, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="cta-glow" style={{ borderRadius: "var(--radius-sm)" }}>
            <Button size="lg" onClick={onRestart}>
              Run it again →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
