import { randomUUID } from "node:crypto";
import type {
  Axis,
  BattleStage,
  BattleTrackRef,
  Genre,
  Placement,
  PlacementEntry,
  PublicBattle,
  Scope,
  TrackLetter,
  Vote,
} from "@/lib/api/types";

// In-memory stand-in for harmony-backend's /generate + battle-bracket state.
// Local/dev only — resets on server restart. Lives entirely behind the same
// contract shape as the real API so swapping NEXT_PUBLIC_API_BASE_URL is the
// only change needed later.

const LETTERS: TrackLetter[] = ["A", "B", "C", "D"];

const MODEL_ROSTER = [
  { id: "model-stable-audio", name: "Stable Audio 2.5" },
  { id: "model-lyria-2", name: "Lyria 2" },
  { id: "model-elevenlabs-music", name: "ElevenLabs Music" },
  { id: "model-minimax-music", name: "MiniMax Music" },
];

interface TrackRecord {
  id: string;
  letter: TrackLetter;
  status: "pending" | "ready" | "failed";
  delayMs: number;
  durationSec: number;
}

function trackAudioUrl(t: TrackRecord): string {
  return `/api/mock/audio?id=${encodeURIComponent(t.id + ":master")}&duration=${t.durationSec}`;
}

interface BattleRecord {
  id: string;
  generationId: string;
  stage: BattleStage;
  slot?: 1 | 2;
  left: BattleTrackRef;
  right: BattleTrackRef;
  axes: Axis[];
  completed: boolean;
  winnerTrackId?: string;
  loserTrackId?: string;
}

type StreamEvent =
  | { type: "track-ready"; data: unknown }
  | { type: "all-ready"; data: unknown }
  | { type: "generation-failed"; data: unknown };

interface GenerationRecord {
  id: string;
  prompt: string;
  scope: Scope;
  genre: Genre;
  tracks: TrackRecord[];
  axes: Axis[];
  battles: Map<string, BattleRecord>;
  trackModel: Map<string, { id: string; name: string }>;
  roundRobinWins: Map<string, number>;
  status: "pending" | "all_ready" | "failed" | "complete";
  placement?: Placement;
  eventLog: StreamEvent[];
  listeners: Set<(event: StreamEvent) => void>;
}

const generations = new Map<string, GenerationRecord>();
const battleToGeneration = new Map<string, string>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function axesFor(scope: Scope, genre: Genre): Axis[] {
  const axes: Axis[] = [
    { key: "prompt_match", label: "Prompt match" },
    { key: "production_quality", label: "Production quality" },
  ];
  if (scope !== "instrumental_only") axes.push({ key: "vocals", label: "Vocals" });
  axes.push(
    scope === "just_a_beat"
      ? { key: "rhythm_bass", label: "Rhythm & bass" }
      : { key: "melody_arrangement", label: "Melody & arrangement" },
  );
  if (genre === "electronic") axes.push({ key: "synth_work", label: "Synth work" });
  if (genre === "jazz") axes.push({ key: "improvisation", label: "Improvisation" });
  return axes;
}

// Testability hook: put "test:fail1" or "test:fail2" anywhere in the prompt
// to force that many models to fail, so both bracket shapes are reachable
// without waiting on real flakiness.
function forcedFailureCount(prompt: string): number {
  const p = prompt.toLowerCase();
  if (p.includes("test:fail2")) return 2;
  if (p.includes("test:fail1")) return 1;
  return 0;
}

function emit(gen: GenerationRecord, event: StreamEvent) {
  gen.eventLog.push(event);
  for (const listener of gen.listeners) listener(event);
}

function publicTrack(t: TrackRecord) {
  return { id: t.id, letter: t.letter, audioUrl: t.status === "ready" ? trackAudioUrl(t) : undefined };
}

function toPublicBattle(b: BattleRecord): PublicBattle {
  return { id: b.id, stage: b.stage, slot: b.slot, left: b.left, right: b.right, axes: b.axes };
}

function winnerRef(battle: BattleRecord, vote: Vote): { winner: BattleTrackRef; loser: BattleTrackRef } {
  // Contract doesn't define tie-break behavior for bracket advancement —
  // left advances on a tie. Documented here since it's a mock-only choice.
  const leftWins = vote !== "right";
  return leftWins ? { winner: battle.left, loser: battle.right } : { winner: battle.right, loser: battle.left };
}

function finalize(gen: GenerationRecord) {
  const failed = gen.tracks.filter((t) => t.status === "failed");
  const ready = gen.tracks.filter((t) => t.status === "ready");

  if (failed.length >= 2) {
    gen.status = "failed";
    emit(gen, {
      type: "generation-failed",
      data: {
        generationId: gen.id,
        reason: `${failed.length} of 4 models failed to generate — try again in a moment.`,
        tracks: gen.tracks.map((t) => ({ id: t.id, letter: t.letter, status: t.status })),
      },
    });
    return;
  }

  gen.status = "all_ready";
  let openBattles: PublicBattle[];

  if (failed.length === 1) {
    const [a, b, c] = ready;
    const pairs: [TrackRecord, TrackRecord][] = [
      [a, b],
      [b, c],
      [a, c],
    ];
    openBattles = pairs.map(([left, right]) => {
      const battle: BattleRecord = {
        id: randomUUID(),
        generationId: gen.id,
        stage: "round_robin",
        left: publicTrackRef(left),
        right: publicTrackRef(right),
        axes: gen.axes,
        completed: false,
      };
      gen.battles.set(battle.id, battle);
      battleToGeneration.set(battle.id, gen.id);
      return toPublicBattle(battle);
    });
  } else {
    const semi1: BattleRecord = {
      id: randomUUID(),
      generationId: gen.id,
      stage: "semifinal",
      slot: 1,
      left: publicTrackRef(ready[0]),
      right: publicTrackRef(ready[1]),
      axes: gen.axes,
      completed: false,
    };
    const semi2: BattleRecord = {
      id: randomUUID(),
      generationId: gen.id,
      stage: "semifinal",
      slot: 2,
      left: publicTrackRef(ready[2]),
      right: publicTrackRef(ready[3]),
      axes: gen.axes,
      completed: false,
    };
    for (const b of [semi1, semi2]) {
      gen.battles.set(b.id, b);
      battleToGeneration.set(b.id, gen.id);
    }
    openBattles = [toPublicBattle(semi1), toPublicBattle(semi2)];
  }

  emit(gen, {
    type: "all-ready",
    data: { generationId: gen.id, tracks: gen.tracks.map(publicTrack), openBattles },
  });
}

function publicTrackRef(t: TrackRecord): BattleTrackRef {
  return { trackId: t.id, letter: t.letter };
}

export function createGeneration(prompt: string, scope: Scope, genre: Genre) {
  const id = randomUUID();
  const failCount = forcedFailureCount(prompt);
  const models = shuffle(MODEL_ROSTER);

  const tracks: TrackRecord[] = LETTERS.map((letter, i) => ({
    id: randomUUID(),
    letter,
    status: "pending",
    delayMs: 2200 + Math.random() * 4200 + i * 250,
    durationSec: 34 + Math.round(Math.random() * 14),
  }));

  const trackModel = new Map<string, { id: string; name: string }>();
  tracks.forEach((t, i) => trackModel.set(t.id, models[i]));

  const gen: GenerationRecord = {
    id,
    prompt,
    scope,
    genre,
    tracks,
    axes: axesFor(scope, genre),
    battles: new Map(),
    trackModel,
    roundRobinWins: new Map(),
    status: "pending",
    eventLog: [],
    listeners: new Set(),
  };
  generations.set(id, gen);

  tracks.forEach((t, i) => {
    const shouldFail = i < failCount;
    setTimeout(() => {
      t.status = shouldFail ? "failed" : "ready";
      if (!shouldFail) {
        emit(gen, {
          type: "track-ready",
          data: { trackId: t.id, letter: t.letter, index: i, audioUrl: trackAudioUrl(t) },
        });
      }
      if (gen.tracks.every((tr) => tr.status !== "pending")) finalize(gen);
    }, t.delayMs);
  });

  return {
    generationId: id,
    status: "pending" as const,
    tracks: tracks.map((t) => ({ id: t.id, letter: t.letter, status: "pending" })),
    axes: gen.axes,
    eventsUrl: `/api/mock/generate/${id}/events`,
  };
}

export function getGeneration(id: string) {
  return generations.get(id);
}

export function subscribe(gen: GenerationRecord, listener: (event: StreamEvent) => void) {
  gen.listeners.add(listener);
  return () => gen.listeners.delete(listener);
}

export function replayLog(gen: GenerationRecord) {
  return gen.eventLog;
}

export class VoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function buildPlacementEntry(gen: GenerationRecord, ref: BattleTrackRef): PlacementEntry {
  const model = gen.trackModel.get(ref.trackId);
  if (!model) throw new VoteError(`No model mapped for track ${ref.trackId}`, 500);
  return { track: { id: ref.trackId, letter: ref.letter }, model };
}

export function recordVote(battleId: string, overall: Vote) {
  const generationId = battleToGeneration.get(battleId);
  if (!generationId) throw new VoteError("Unknown battle", 404);
  const gen = generations.get(generationId);
  if (!gen) throw new VoteError("Unknown generation", 404);
  const battle = gen.battles.get(battleId);
  if (!battle) throw new VoteError("Unknown battle", 404);
  if (battle.completed) throw new VoteError("Battle already voted", 409);

  const { winner, loser } = winnerRef(battle, overall);
  battle.completed = true;
  battle.winnerTrackId = winner.trackId;
  battle.loserTrackId = loser.trackId;

  if (battle.stage === "round_robin") {
    gen.roundRobinWins.set(winner.trackId, (gen.roundRobinWins.get(winner.trackId) ?? 0) + 1);
    const rrBattles = [...gen.battles.values()].filter((b) => b.stage === "round_robin");
    const allDone = rrBattles.every((b) => b.completed);
    if (!allDone) {
      return { status: "battle_recorded" as const, completedBattle: toPublicBattle(battle), unlockedBattles: [] };
    }
    const failedTrack = gen.tracks.find((t) => t.status === "failed")!;
    const participants = new Set<string>();
    rrBattles.forEach((b) => {
      participants.add(b.left.trackId);
      participants.add(b.right.trackId);
    });
    const ranked = [...participants]
      .map((trackId) => ({ trackId, wins: gen.roundRobinWins.get(trackId) ?? 0 }))
      .sort((a, b) => b.wins - a.wins || a.trackId.localeCompare(b.trackId));
    const refFor = (trackId: string): BattleTrackRef => {
      const t = gen.tracks.find((tr) => tr.id === trackId)!;
      return { trackId: t.id, letter: t.letter };
    };
    const placement: Placement = {
      first: buildPlacementEntry(gen, refFor(ranked[0].trackId)),
      second: buildPlacementEntry(gen, refFor(ranked[1].trackId)),
      third: buildPlacementEntry(gen, refFor(ranked[2].trackId)),
      fourth: buildPlacementEntry(gen, { trackId: failedTrack.id, letter: failedTrack.letter }),
    };
    gen.status = "complete";
    gen.placement = placement;
    return {
      status: "bracket_complete" as const,
      completedBattle: toPublicBattle(battle),
      placement,
      revealUrl: `/api/mock/reveal/${gen.id}`,
    };
  }

  if (battle.stage === "semifinal") {
    const sibling = [...gen.battles.values()].find((b) => b.stage === "semifinal" && b.id !== battle.id);
    if (!sibling?.completed) {
      return { status: "battle_recorded" as const, completedBattle: toPublicBattle(battle), unlockedBattles: [] };
    }
    // Both semifinals done — open final + consolation, ordering slot1 vs slot2 consistently.
    const slot1 = battle.slot === 1 ? battle : sibling;
    const slot2 = battle.slot === 1 ? sibling : battle;
    const final: BattleRecord = {
      id: randomUUID(),
      generationId: gen.id,
      stage: "final",
      left: { trackId: slot1.winnerTrackId!, letter: refLetter(gen, slot1.winnerTrackId!) },
      right: { trackId: slot2.winnerTrackId!, letter: refLetter(gen, slot2.winnerTrackId!) },
      axes: gen.axes,
      completed: false,
    };
    const consolation: BattleRecord = {
      id: randomUUID(),
      generationId: gen.id,
      stage: "consolation",
      left: { trackId: slot1.loserTrackId!, letter: refLetter(gen, slot1.loserTrackId!) },
      right: { trackId: slot2.loserTrackId!, letter: refLetter(gen, slot2.loserTrackId!) },
      axes: gen.axes,
      completed: false,
    };
    for (const b of [final, consolation]) {
      gen.battles.set(b.id, b);
      battleToGeneration.set(b.id, gen.id);
    }
    return {
      status: "battle_recorded" as const,
      completedBattle: toPublicBattle(battle),
      unlockedBattles: [toPublicBattle(final), toPublicBattle(consolation)],
    };
  }

  // final | consolation
  const other = [...gen.battles.values()].find(
    (b) => b.id !== battle.id && (b.stage === "final" || b.stage === "consolation"),
  );
  if (!other?.completed) {
    return { status: "battle_recorded" as const, completedBattle: toPublicBattle(battle), unlockedBattles: [] };
  }
  const final = battle.stage === "final" ? battle : other;
  const consolation = battle.stage === "consolation" ? battle : other;
  const placement: Placement = {
    first: buildPlacementEntry(gen, { trackId: final.winnerTrackId!, letter: refLetter(gen, final.winnerTrackId!) }),
    second: buildPlacementEntry(gen, { trackId: final.loserTrackId!, letter: refLetter(gen, final.loserTrackId!) }),
    third: buildPlacementEntry(gen, {
      trackId: consolation.winnerTrackId!,
      letter: refLetter(gen, consolation.winnerTrackId!),
    }),
    fourth: buildPlacementEntry(gen, {
      trackId: consolation.loserTrackId!,
      letter: refLetter(gen, consolation.loserTrackId!),
    }),
  };
  gen.status = "complete";
  gen.placement = placement;
  return {
    status: "bracket_complete" as const,
    completedBattle: toPublicBattle(battle),
    placement,
    revealUrl: `/api/mock/reveal/${gen.id}`,
  };
}

function refLetter(gen: GenerationRecord, trackId: string): TrackLetter {
  return gen.tracks.find((t) => t.id === trackId)!.letter;
}

export function getReveal(generationId: string) {
  const gen = generations.get(generationId);
  if (!gen) throw new VoteError("Unknown generation", 404);
  if (!gen.placement) throw new VoteError("Bracket not complete yet", 425);
  return { generationId: gen.id, placement: gen.placement };
}

export function getTrackDuration(trackId: string): number {
  const gen = [...generations.values()].find((g) => g.tracks.some((t) => t.id === trackId));
  const track = gen?.tracks.find((t) => t.id === trackId);
  return track?.durationSec ?? 40;
}
