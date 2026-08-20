"use client";
import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { VotePill } from "@/components/ui/VotePill";
import { WaveformPlayer } from "@/components/ui/WaveformPlayer";
import { generate, subscribeToGenerationEvents, vote as voteApi } from "@/lib/api/client";
import { genreLabel, scopeLabel } from "@/lib/scopeGenre";
import { TRACK_COLORS, TRACK_HEX } from "@/lib/trackColors";
import { cn } from "@/lib/utils";
import type { Axis, BattleStage, Genre, Placement, PublicBattle, Scope, TrackLetter, Vote } from "@/lib/api/types";

const LETTERS: TrackLetter[] = ["A", "B", "C", "D"];
const STAGES = ["Reading your prompt", "Sketching the chords", "Laying the groove", "Arranging the parts", "Mixing down", "Bouncing the file"];
const TIPS = [
  "You will hear one track at a time — the other goes quiet. Compare on memory, the way you would on the radio.",
  "Judge one axis at a time. You are asked where each track wins, not just which you like more.",
  "Separate “clean” from “good”. A polished mix can still be the boring one.",
  "Ties are allowed and useful — a forced pick adds noise to your taste profile.",
  "Model names stay hidden until the end, so nothing you know about them can steer your ears.",
];
const STAGE_LABEL: Record<BattleStage, string> = {
  semifinal: "Semifinal",
  final: "Final",
  consolation: "3rd place match",
  round_robin: "Round robin",
};

interface TrackState {
  id: string;
  status: "pending" | "ready" | "failed";
  audioUrl?: string;
}

export interface ListenBattleResult {
  generationId: string;
  placement: Placement;
  trackAudioUrls: Partial<Record<TrackLetter, string>>;
}

export interface ListenBattleScreenProps {
  prompt: string;
  scope: Scope;
  genre: Genre;
  onComplete: (result: ListenBattleResult) => void;
  onRetry: () => void;
}

export function BattleScreen({ prompt, scope, genre, onComplete, onRetry }: ListenBattleScreenProps) {
  const [generationId, setGenerationId] = React.useState<string | null>(null);
  const [tracks, setTracks] = React.useState<Record<string, TrackState>>({});
  const [axes, setAxes] = React.useState<Axis[]>([]);
  const [phase, setPhase] = React.useState<"starting" | "loading" | "battle" | "failed">("starting");
  const [failReason, setFailReason] = React.useState<string | null>(null);
  const [readyToEnter, setReadyToEnter] = React.useState(false);
  const [queue, setQueue] = React.useState<PublicBattle[]>([]);
  const [totalBattles, setTotalBattles] = React.useState(4);
  const [completedCount, setCompletedCount] = React.useState(0);
  const [axisVotes, setAxisVotes] = React.useState<Record<string, Vote>>({});
  const [priority, setPriority] = React.useState<string[]>([]);
  const [playingTrackId, setPlayingTrackId] = React.useState<string | null>(null);
  const [arrived, setArrived] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [tip, setTip] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let unsubscribe: (() => void) | undefined;

    generate(prompt, scope, genre).then((res) => {
      setGenerationId(res.generationId);
      setAxes(res.axes);
      const initial: Record<string, TrackState> = {};
      res.tracks.forEach((t) => (initial[t.letter] = { id: t.id, status: "pending" }));
      setTracks(initial);
      setPhase("loading");

      unsubscribe = subscribeToGenerationEvents(res.eventsUrl, {
        onTrackReady: (e) => {
          setTracks((prev) => ({ ...prev, [e.letter]: { id: e.trackId, status: "ready", audioUrl: e.audioUrl } }));
        },
        onAllReady: (e) => {
          setTracks((prev) => {
            const next = { ...prev };
            e.tracks.forEach((t) => {
              next[t.letter] = { id: t.id, status: t.audioUrl ? "ready" : "failed", audioUrl: t.audioUrl };
            });
            return next;
          });
          setQueue(e.openBattles);
          setTotalBattles(e.openBattles[0]?.stage === "round_robin" ? 3 : 4);
          setReadyToEnter(true);
          setArrived(true);
        },
        onGenerationFailed: (e) => {
          setFailReason(e.reason);
          setPhase("failed");
        },
      });
    });

    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (phase !== "loading") return;
    const a = setInterval(() => setTick((n) => n + 1), 1400);
    const b = setInterval(() => setTip((n) => n + 1), 4800);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [phase]);

  const readyCount = LETTERS.filter((l) => tracks[l]?.status === "ready").length;
  const settledCount = LETTERS.filter((l) => tracks[l]?.status && tracks[l].status !== "pending").length;
  const currentBattle = queue[0];
  const sortedAxes = React.useMemo(
    () => [...axes].sort((a, b) => (priority.includes(b.key) ? 1 : 0) - (priority.includes(a.key) ? 1 : 0)),
    [axes, priority],
  );

  async function submitOverall(overallVote: Vote) {
    if (!currentBattle || submitting) return;
    setSubmitting(true);
    const axesPayload: Record<string, Vote> = {};
    axes.forEach((a) => (axesPayload[a.key] = axisVotes[a.key] ?? "tie"));
    try {
      const res = await voteApi(currentBattle.id, { overall: overallVote, axes: axesPayload });
      if (res.status === "bracket_complete") {
        const trackAudioUrls: Partial<Record<TrackLetter, string>> = {};
        LETTERS.forEach((l) => {
          if (tracks[l]?.audioUrl) trackAudioUrls[l] = tracks[l].audioUrl;
        });
        onComplete({ generationId: generationId!, placement: res.placement, trackAudioUrls });
        return;
      }
      setQueue((q) => [...q.slice(1), ...res.unlockedBattles]);
      setCompletedCount((c) => c + 1);
      setAxisVotes({});
      setPlayingTrackId(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "failed") {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-24 text-center font-body">
        <div className="eyebrow">Generation failed</div>
        <h1 className="mb-3.5 font-display text-2xl text-text-heading">That run didn&rsquo;t make it.</h1>
        <p className="mb-7 text-text-muted">{failReason}</p>
        <Button onClick={onRetry}>Back to Generate</Button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {phase === "battle" && currentBattle && (
        <div
          className="ambient-split"
          style={{ "--l": TRACK_HEX[currentBattle.left.letter], "--r": TRACK_HEX[currentBattle.right.letter] } as React.CSSProperties}
        />
      )}
      <div className="relative mx-auto max-w-[840px] px-6 pt-12 pb-20 font-body">
        {(phase === "starting" || phase === "loading") && (
          <div>
            <div className="eyebrow">All four land together · no one hears anything early</div>
            <div className="mb-2.5 flex items-baseline justify-between gap-5">
              <h1 className="font-display text-3xl tracking-[-0.03em] text-text-heading">
                {readyToEnter ? "All four are in." : `${["None", "One", "Two", "Three", "Four"][readyCount]} of four in.`}
              </h1>
              <span
                className={cn(
                  "shrink-0 font-mono text-sm whitespace-nowrap",
                  readyToEnter ? "text-success" : "text-text-faint",
                )}
              >
                {readyToEnter ? "4/4 · done" : `${readyCount}/4`}
              </span>
            </div>
            {prompt && (
              <p className="mt-0 mb-[18px] max-w-[68ch] text-sm text-text-muted">
                &ldquo;{prompt}&rdquo; · {scopeLabel(scope)} · {genreLabel(genre)}
              </p>
            )}
            <div className="race-track">
              <div className="race-fill" style={{ width: `${(readyCount / 4) * 100}%` }} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3.5">
              {LETTERS.map((t, i) => {
                const state = tracks[t];
                const isReady = state?.status === "ready";
                const isFailed = state?.status === "failed";
                const stageIdx = (tick + i) % STAGES.length;
                return (
                  <div key={t} className={isReady ? "gen-card is-ready" : "gen-card"} style={{ "--tc": TRACK_HEX[t] } as React.CSSProperties}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-display text-lg font-bold text-text-heading">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-[#0E0C0A]"
                          style={{ background: TRACK_COLORS[t] }}
                        >
                          {t}
                        </span>
                        Track {t}
                      </span>
                      <Badge tone={isReady ? "success" : isFailed ? "danger" : "neutral"}>
                        {isReady ? "Ready" : isFailed ? "Didn't finish" : "Generating"}
                      </Badge>
                    </div>
                    {isReady ? (
                      <div className="ready-row" style={{ "--tc": TRACK_HEX[t] } as React.CSSProperties}>
                        <span className="ready-dot" />
                        <span>rendered</span>
                      </div>
                    ) : isFailed ? (
                      <div className="ready-row opacity-60" style={{ "--tc": TRACK_HEX[t] } as React.CSSProperties}>
                        <span>This model didn&rsquo;t come back in time — it&rsquo;ll auto-place last.</span>
                      </div>
                    ) : (
                      <Skeleton height={44} radius="var(--radius-sm)" />
                    )}
                    <div className={cn("stage", isReady ? "text-text-faint" : "text-text-muted")}>
                      {!isReady && !isFailed && <span className="live-dot" style={{ background: TRACK_COLORS[t] }} />}
                      {isReady ? (readyToEnter ? "Held until you go in" : "Done · waiting on the others") : isFailed ? "" : STAGES[stageIdx]}
                    </div>
                  </div>
                );
              })}
            </div>

            {axes.length > 0 && (
              <div className="waitbox">
                <div className="eyebrow mb-2.5">Pick what matters most to you · up to two</div>
                <div className="flex flex-wrap gap-2">
                  {axes.map((a) => (
                    <Chip
                      key={a.key}
                      selected={priority.includes(a.key)}
                      onClick={() => setPriority((p) => (p.includes(a.key) ? p.filter((x) => x !== a.key) : [...p, a.key].slice(-2)))}
                    >
                      {a.label}
                    </Chip>
                  ))}
                </div>
                <p className="mt-2.5 mb-0 font-mono text-xs text-text-faint">
                  {priority.length ? "These go first on every vote card." : "Optional — it just reorders the vote card."}
                </p>
                <div className="mt-[18px] mb-4 h-px bg-border-default" />
                <p key={tip % TIPS.length} className="tip rise">
                  {TIPS[tip % TIPS.length]}
                </p>
                <div className="mt-3.5 flex gap-1.5">
                  {TIPS.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-[3px] w-[18px] rounded-sm transition-[background] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                        i === tip % TIPS.length ? "bg-accent" : "bg-border-strong",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-[26px] text-center">
              {readyToEnter ? (
                <div className="rise">
                  <p className="mb-4 text-text-muted">Four tracks. Your ears will know which is best.</p>
                  <div className="cta-glow inline-block rounded-sm">
                    <Button size="lg" onClick={() => setPhase("battle")}>
                      Enter the arena →
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-xs tracking-[0.04em] text-text-faint">
                  NOBODY PLAYS UNTIL EVERYBODY&rsquo;S DONE — SO NO MODEL GETS THE FIRST-LISTEN ADVANTAGE
                </p>
              )}
            </div>

            {readyToEnter && !arrived && (
              <div className="dockbar">
                <span className="font-mono text-xs tracking-[0.04em] text-text-faint">4/4 READY</span>
                <Button onClick={() => setPhase("battle")}>Enter the arena →</Button>
              </div>
            )}

            {arrived && (
              <div className="arrive-scrim" onClick={() => setArrived(false)}>
                <div className="arrive-card" onClick={(e) => e.stopPropagation()}>
                  <span className="ring" />
                  <span className="ring r2" />
                  <div className="arrive-eyebrow">All four in · zero plays</div>
                  <div className="mt-[18px] mb-[22px] flex justify-center gap-2.5">
                    {LETTERS.map((t, i) => (
                      <span key={t} className="arrive-dot" style={{ background: TRACK_COLORS[t], animationDelay: i * 90 + "ms" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 className="arrive-h">
                    Four takes.
                    <br />
                    Your call.
                  </h2>
                  <p className="arrive-p">
                    Not one note has been played yet — you get the very first listen. A few quick rounds and you&rsquo;ll know which one your
                    ears actually want.
                  </p>
                  <button className="cta-big" onClick={() => setPhase("battle")}>
                    <span>Enter the arena →</span>
                  </button>
                  <div className="arrive-meta">{totalBattles} rounds · about 90 seconds</div>
                  <button className="arrive-later" onClick={() => setArrived(false)}>
                    Not yet
                  </button>
                </div>
              </div>
            )}

            {settledCount < 4 && !readyToEnter && (
              // Keeps layout stable while at least one track is still pending; no content.
              <span className="hidden" />
            )}
          </div>
        )}

        {phase === "battle" && currentBattle && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl tracking-[-0.02em] text-text-heading">
                  Battle {completedCount + 1} of {totalBattles}
                </h1>
                <Badge tone="secondary">{STAGE_LABEL[currentBattle.stage]}</Badge>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: totalBattles }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-[5px] w-[34px] rounded-[3px] transition-[background] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                      i <= completedCount ? "bg-accent" : "bg-border-strong",
                    )}
                  />
                ))}
              </div>
            </div>

            <div key={currentBattle.id} className="rise grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-4">
              {[currentBattle.left, currentBattle.right].map((ref, i) => {
                const state = tracks[ref.letter];
                const isPlaying = playingTrackId === ref.trackId;
                return (
                  <React.Fragment key={ref.trackId}>
                    <div
                      className={cn(
                        "contender min-w-0 transition-[opacity,box-shadow] duration-[340ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                        i === 0 ? "order-none" : "order-2",
                      )}
                      style={{ "--tc": TRACK_HEX[ref.letter], opacity: playingTrackId && !isPlaying ? 0.5 : 1 } as React.CSSProperties}
                    >
                      <div className="mb-3.5 flex items-center justify-between">
                        <span className="font-display text-xl font-bold" style={{ color: TRACK_COLORS[ref.letter] }}>
                          Track {ref.letter}
                        </span>
                      </div>
                      {state?.audioUrl ? (
                        <WaveformPlayer
                          src={state.audioUrl}
                          playing={isPlaying}
                          color={TRACK_COLORS[ref.letter]}
                          height={64}
                          meter
                          onTogglePlay={() => setPlayingTrackId(isPlaying ? null : ref.trackId)}
                        />
                      ) : (
                        <Skeleton height={64} />
                      )}
                      <button
                        onClick={() => setPlayingTrackId(isPlaying ? null : ref.trackId)}
                        className="mt-3.5 w-full cursor-pointer rounded-sm border border-border-strong bg-transparent p-2 font-mono text-xs tracking-[0.04em] text-text-muted"
                      >
                        {isPlaying ? "PLAYING" : "SOLO THIS TRACK"}
                      </button>
                    </div>
                    {i === 0 && (
                      <div className="order-1 flex items-center font-display text-lg font-bold text-text-faint">VS</div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3.5 rounded-md border border-border-default bg-surface-card p-5">
              <div className="eyebrow mb-0">
                Where does each one win?{priority.length ? " · yours first" : ""}
              </div>
              {sortedAxes.map((axis) => (
                <VotePill
                  key={axis.key}
                  axis={axis.label}
                  value={axisVotes[axis.key]}
                  onVote={(v) => setAxisVotes((prev) => ({ ...prev, [axis.key]: v }))}
                  leftColor={TRACK_COLORS[currentBattle.left.letter]}
                  rightColor={TRACK_COLORS[currentBattle.right.letter]}
                  leftLabel={currentBattle.left.letter}
                  rightLabel={currentBattle.right.letter}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                className="pick"
                style={{ "--tc": TRACK_HEX[currentBattle.left.letter] } as React.CSSProperties}
                disabled={submitting}
                onClick={() => submitOverall("left")}
              >
                Track {currentBattle.left.letter} takes it
              </button>
              <Button variant="ghost" size="lg" disabled={submitting} onClick={() => submitOverall("tie")}>
                Too close to call
              </Button>
              <button
                className="pick"
                style={{ "--tc": TRACK_HEX[currentBattle.right.letter] } as React.CSSProperties}
                disabled={submitting}
                onClick={() => submitOverall("right")}
              >
                Track {currentBattle.right.letter} takes it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
