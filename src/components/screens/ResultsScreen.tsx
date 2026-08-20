"use client";
import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WaveformPlayer } from "@/components/ui/WaveformPlayer";
import { getLayers } from "@/lib/api/client";
import type { Genre, Placement, PlacementEntry, Scope, Stem, TrackLetter } from "@/lib/api/types";
import { genreLabel, scopeLabel } from "@/lib/scopeGenre";
import { TRACK_COLORS, TRACK_HEX } from "@/lib/trackColors";
import { cn } from "@/lib/utils";

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
    <div className={cn("layer-row", dimmed ? "opacity-32" : "opacity-100")}>
      <button
        onClick={onSolo}
        className="w-[66px] shrink-0 cursor-pointer rounded-pill border px-0 py-1.5 font-mono text-xs font-semibold tracking-[0.04em]"
        style={{
          background: solo ? TRACK_COLORS[trackLetter] : "transparent",
          color: solo ? "#0E0C0A" : "var(--text-muted)",
          borderColor: solo ? TRACK_HEX[trackLetter] : "var(--border-strong)",
        }}
      >
        SOLO
      </button>
      <span className="w-[68px] shrink-0 font-display font-semibold text-text-heading">{stem.label}</span>
      <div className="min-w-0 flex-1">
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
      <div className="flex items-center gap-3.5">
        <span className="w-[18px] font-mono text-sm text-text-faint">{rank}</span>
        <span
          className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-[#0E0C0A]"
          style={{ background: TRACK_COLORS[letter] }}
        >
          {letter}
        </span>
        <div className="w-[168px] shrink-0">
          <div
            className={cn(
              "font-display font-semibold text-text-heading transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              revealed ? "opacity-100" : "opacity-25",
            )}
          >
            {revealed ? entry.model.name : `Track ${letter}`}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {audioUrl ? (
            <WaveformPlayer src={audioUrl} playing={playing} color={TRACK_COLORS[letter]} height={36} onTogglePlay={() => setPlaying((p) => !p)} />
          ) : (
            <span className="font-mono text-xs text-text-faint">This model didn&rsquo;t finish generating — no audio.</span>
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
    <div className="relative overflow-hidden">
      <div className="ambient-orange" style={{ background: `radial-gradient(760px 360px at 50% 0%, ${TRACK_HEX[winner.track.letter]}2E, transparent 70%)` }} />
      <div className="relative mx-auto max-w-[860px] px-6 pt-11 pb-24 font-body">
        <div className="eyebrow">The blind is off</div>
        <h1 className="rise mb-1.5 font-display text-3xl tracking-[-0.03em] text-text-heading">
          Your track is{" "}
          <span
            className={cn("transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", reveal ? "opacity-100" : "opacity-0")}
            style={{ color: TRACK_COLORS[winner.track.letter] }}
          >
            {winner.model.name}
          </span>
        </h1>
        <p className="mb-[26px] max-w-[62ch] text-text-muted">
          Take the master, pull it apart into stems, or grab any of the runners-up — everything you heard is yours to keep.
        </p>

        <div className="winner-card rise d1" style={{ "--tc": TRACK_HEX[winner.track.letter] } as React.CSSProperties}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full font-mono text-md font-bold text-[#0E0C0A]"
                style={{ background: TRACK_COLORS[winner.track.letter] }}
              >
                {winner.track.letter}
              </span>
              <div>
                <div className="font-display text-xl font-bold tracking-[-0.02em] text-text-heading">
                  {reveal ? winner.model.name : `Track ${winner.track.letter}`}
                </div>
                <div className="mt-[3px] font-mono text-xs tracking-[0.04em] text-text-faint">
                  WON THE BRACKET · {scopeLabel(scope).toUpperCase()} · {genreLabel(genre).toUpperCase()}
                </div>
              </div>
            </div>
            <Badge tone="success">Your favorite</Badge>
          </div>

          {prompt && (
            <p
              className="mt-0 mb-4 pl-3 text-sm text-text-muted"
              style={{ borderLeft: `2px solid ${TRACK_COLORS[winner.track.letter]}` }}
            >
              &ldquo;{prompt}&rdquo;
            </p>
          )}

          {winnerAudio && (
            <WaveformPlayer src={winnerAudio} playing={playingWinner} color={TRACK_COLORS[winner.track.letter]} height={72} meter onTogglePlay={() => setPlayingWinner((p) => !p)} />
          )}

          <div className="mt-[18px] flex flex-wrap gap-2.5">
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
            <div className="rise mt-4 flex flex-col gap-2.5 border-t border-border-default pt-4">
              {stemsLoading && <span className="font-mono text-xs text-text-faint">Splitting stems…</span>}
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

        <div className="rise d2 mt-10">
          <div className="eyebrow">The full ladder · everything you heard</div>
          <div className="flex flex-col gap-3">
            {runnersUp.map((entry, i) => (
              <LadderRow key={entry.track.id} rank={i + 2} entry={entry} audioUrl={trackAudioUrls[entry.track.letter]} revealed={reveal} />
            ))}
          </div>
        </div>

        <div className="rise d4 mt-10 flex flex-wrap items-center justify-end gap-4">
          <div className="cta-glow rounded-sm">
            <Button size="lg" onClick={onRestart}>
              Run it again →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
