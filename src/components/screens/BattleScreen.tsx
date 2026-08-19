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
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "96px 24px", textAlign: "center", fontFamily: "var(--font-body)" }}>
        <div className="eyebrow">Generation failed</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--text-heading)", marginBottom: 14 }}>
          That run didn&rsquo;t make it.
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 28 }}>{failReason}</p>
        <Button onClick={onRetry}>Back to Generate</Button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {phase === "battle" && currentBattle && (
        <div
          className="ambient-split"
          style={{ "--l": TRACK_HEX[currentBattle.left.letter], "--r": TRACK_HEX[currentBattle.right.letter] } as React.CSSProperties}
        />
      )}
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "48px 24px 80px", fontFamily: "var(--font-body)", position: "relative" }}>
        {(phase === "starting" || phase === "loading") && (
          <div>
            <div className="eyebrow">All four land together · no one hears anything early</div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, marginBottom: 10 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--text-heading)", letterSpacing: "-0.03em" }}>
                {readyToEnter ? "All four are in." : `${["None", "One", "Two", "Three", "Four"][readyCount]} of four in.`}
              </h1>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: readyToEnter ? "var(--success)" : "var(--text-faint)",
                  whiteSpace: "nowrap",
                }}
              >
                {readyToEnter ? "4/4 · done" : `${readyCount}/4`}
              </span>
            </div>
            {prompt && (
              <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", margin: "0 0 18px", maxWidth: "68ch" }}>
                &ldquo;{prompt}&rdquo; · {scopeLabel(scope)} · {genreLabel(genre)}
              </p>
            )}
            <div className="race-track">
              <div className="race-fill" style={{ width: `${(readyCount / 4) * 100}%` }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 24 }}>
              {LETTERS.map((t, i) => {
                const state = tracks[t];
                const isReady = state?.status === "ready";
                const isFailed = state?.status === "failed";
                const stageIdx = (tick + i) % STAGES.length;
                return (
                  <div key={t} className={isReady ? "gen-card is-ready" : "gen-card"} style={{ "--tc": TRACK_HEX[t] } as React.CSSProperties}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "var(--text-lg)",
                          color: "var(--text-heading)",
                        }}
                      >
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: TRACK_COLORS[t],
                            color: "#0E0C0A",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
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
                      <div className="ready-row" style={{ "--tc": TRACK_HEX[t], opacity: 0.6 } as React.CSSProperties}>
                        <span>This model didn&rsquo;t come back in time — it&rsquo;ll auto-place last.</span>
                      </div>
                    ) : (
                      <Skeleton height={44} radius="var(--radius-sm)" />
                    )}
                    <div className="stage" style={{ color: isReady ? "var(--text-faint)" : "var(--text-muted)" }}>
                      {!isReady && !isFailed && <span className="live-dot" style={{ background: TRACK_COLORS[t] }} />}
                      {isReady ? (readyToEnter ? "Held until you go in" : "Done · waiting on the others") : isFailed ? "" : STAGES[stageIdx]}
                    </div>
                  </div>
                );
              })}
            </div>

            {axes.length > 0 && (
              <div className="waitbox">
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Pick what matters most to you · up to two
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: 10, marginBottom: 0 }}>
                  {priority.length ? "These go first on every vote card." : "Optional — it just reorders the vote card."}
                </p>
                <div style={{ height: 1, background: "var(--border-default)", margin: "18px 0 16px" }} />
                <p key={tip % TIPS.length} className="tip rise">
                  {TIPS[tip % TIPS.length]}
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  {TIPS.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 18,
                        height: 3,
                        borderRadius: 2,
                        background: i === tip % TIPS.length ? "var(--accent)" : "var(--border-strong)",
                        transition: "background var(--duration-base) var(--ease-out)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", paddingTop: 26 }}>
              {readyToEnter ? (
                <div className="rise">
                  <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Four tracks. Your ears will know which is best.</p>
                  <div className="cta-glow" style={{ display: "inline-block", borderRadius: "var(--radius-sm)" }}>
                    <Button size="lg" onClick={() => setPhase("battle")}>
                      Enter the arena →
                    </Button>
                  </div>
                </div>
              ) : (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)" }}>
                  NOBODY PLAYS UNTIL EVERYBODY&rsquo;S DONE — SO NO MODEL GETS THE FIRST-LISTEN ADVANTAGE
                </p>
              )}
            </div>

            {readyToEnter && !arrived && (
              <div className="dockbar">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-faint)", letterSpacing: "var(--tracking-wide)" }}>
                  4/4 READY
                </span>
                <Button onClick={() => setPhase("battle")}>Enter the arena →</Button>
              </div>
            )}

            {arrived && (
              <div
                className="arrive-scrim"
                onClick={() => setArrived(false)}
              >
                <div className="arrive-card" onClick={(e) => e.stopPropagation()}>
                  <span className="ring" />
                  <span className="ring r2" />
                  <div className="arrive-eyebrow">All four in · zero plays</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, margin: "18px 0 22px" }}>
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
              <span style={{ display: "none" }} />
            )}
          </div>
        )}

        {phase === "battle" && currentBattle && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--text-heading)", letterSpacing: "-0.02em" }}>
                  Battle {completedCount + 1} of {totalBattles}
                </h1>
                <Badge tone="secondary">{STAGE_LABEL[currentBattle.stage]}</Badge>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: totalBattles }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 34,
                      height: 5,
                      borderRadius: 3,
                      background: i <= completedCount ? "var(--accent)" : "var(--border-strong)",
                      transition: "background var(--duration-base) var(--ease-out)",
                    }}
                  />
                ))}
              </div>
            </div>

            <div key={currentBattle.id} className="rise" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", gap: 16, alignItems: "stretch" }}>
              {[currentBattle.left, currentBattle.right].map((ref, i) => {
                const state = tracks[ref.letter];
                const isPlaying = playingTrackId === ref.trackId;
                return (
                  <React.Fragment key={ref.trackId}>
                    <div
                      className="contender"
                      style={{
                        "--tc": TRACK_HEX[ref.letter],
                        order: i === 0 ? 0 : 2,
                        minWidth: 0,
                        opacity: playingTrackId && !isPlaying ? 0.5 : 1,
                        transition: "opacity var(--duration-base) var(--ease-out), box-shadow var(--duration-slow) var(--ease-out)",
                      } as React.CSSProperties}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 700, color: TRACK_COLORS[ref.letter] }}>
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
                        style={{
                          marginTop: 14,
                          width: "100%",
                          background: "transparent",
                          border: "1px solid var(--border-strong)",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-xs)",
                          padding: "8px",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          letterSpacing: "var(--tracking-wide)",
                        }}
                      >
                        {isPlaying ? "PLAYING" : "SOLO THIS TRACK"}
                      </button>
                    </div>
                    {i === 0 && (
                      <div
                        style={{
                          order: 1,
                          display: "flex",
                          alignItems: "center",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "var(--text-lg)",
                          color: "var(--text-faint)",
                        }}
                      >
                        VS
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: 20,
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div className="eyebrow" style={{ marginBottom: 0 }}>
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

            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, alignItems: "center" }}>
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
