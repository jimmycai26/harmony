import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { AXIS_LABELS, computeAxes } from './axes';
import { pickFourModels } from './mockModels';
import type {
  AxisKey,
  Battle,
  Generation,
  GenerationEvent,
  Genre,
  Letter,
  Pick,
  PublicBattle,
  Scope,
  Track,
} from './types';

export interface CreateGenerationInput {
  prompt: string;
  scope: Scope;
  genre: Genre;
}

export interface RecordVoteInput {
  overall: Pick;
  /** One pick per axis key returned in the battle's `axes` list. */
  axes: Record<string, Pick>;
}

export interface PublicBattleResult extends PublicBattle {
  overall: Pick;
  axisPicks: Record<string, Pick>;
  winnerTrackId: string;
}

export type RecordVoteResult =
  | {
      ok: true;
      generationId: string;
      ladderComplete: false;
      completedBattle: PublicBattleResult;
      nextBattle: PublicBattle;
    }
  | {
      ok: true;
      generationId: string;
      ladderComplete: true;
      completedBattle: PublicBattleResult;
      winner: { trackId: string; letter: Letter };
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_complete' }
  | { ok: false; reason: 'invalid_axes'; expected: AxisKey[] };

export type RevealResult =
  | {
      ok: true;
      generationId: string;
      winningTrack: { id: string; letter: Letter };
      model: { id: string; name: string };
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'ladder_incomplete' };

export interface LayersResult {
  trackId: string;
  stems: { type: string; label: string; url: string }[];
}

/**
 * Boundary the routes call against. `InMemoryGenerationStore` is the only
 * implementation today; swapping in packages/db + packages/orchestration
 * later just means writing a new class against this same interface.
 */
export interface GenerationStore {
  createGeneration(input: CreateGenerationInput): Generation;
  getGeneration(id: string): Generation | undefined;
  subscribeToGenerationEvents(
    id: string,
    listener: (event: GenerationEvent) => void,
  ): (() => void) | undefined;
  recordVote(battleId: string, input: RecordVoteInput): RecordVoteResult;
  getLayers(trackId: string): LayersResult | undefined;
  getReveal(generationId: string): RevealResult;
}

export interface InMemoryGenerationStoreOptions {
  /** Simulated per-track generation latency window, in ms. */
  trackDelayMs?: { min: number; max: number };
}

const STEM_TYPES: { type: string; label: string }[] = [
  { type: 'vocals', label: 'Vocals' },
  { type: 'drums', label: 'Drums' },
  { type: 'bass', label: 'Bass' },
  { type: 'other', label: 'Other / harmonic bed' },
];

export class InMemoryGenerationStore implements GenerationStore {
  private readonly generations = new Map<string, Generation>();
  private readonly emitters = new Map<string, EventEmitter>();
  private readonly trackIndex = new Map<string, string>();
  private readonly battleIndex = new Map<string, string>();
  private readonly delayMs: { min: number; max: number };

  constructor(options: InMemoryGenerationStoreOptions = {}) {
    this.delayMs = options.trackDelayMs ?? { min: 1500, max: 4000 };
  }

  createGeneration(input: CreateGenerationInput): Generation {
    const id = randomUUID();
    const models = pickFourModels();
    const letters: Letter[] = ['A', 'B', 'C', 'D'];
    const tracks: Track[] = letters.map((letter, i) => ({
      id: randomUUID(),
      letter,
      status: 'generating',
      model: models[i],
    }));

    const generation: Generation = {
      id,
      prompt: input.prompt,
      scope: input.scope,
      genre: input.genre,
      createdAt: new Date().toISOString(),
      tracks,
      axes: computeAxes(input.scope, input.genre),
      status: 'generating',
      battles: [],
    };

    this.generations.set(id, generation);
    this.emitters.set(id, new EventEmitter());
    for (const track of tracks) {
      this.trackIndex.set(track.id, id);
    }

    for (const track of tracks) {
      const delay = this.delayMs.min + Math.random() * (this.delayMs.max - this.delayMs.min);
      const timer = setTimeout(() => this.markTrackReady(id, track.id), delay);
      timer.unref();
    }

    return generation;
  }

  getGeneration(id: string): Generation | undefined {
    return this.generations.get(id);
  }

  subscribeToGenerationEvents(
    id: string,
    listener: (event: GenerationEvent) => void,
  ): (() => void) | undefined {
    const emitter = this.emitters.get(id);
    if (!emitter) return undefined;
    emitter.on('event', listener);
    return () => emitter.off('event', listener);
  }

  recordVote(battleId: string, input: RecordVoteInput): RecordVoteResult {
    const generationId = this.battleIndex.get(battleId);
    if (!generationId) return { ok: false, reason: 'not_found' };

    const generation = this.generations.get(generationId)!;
    const battle = generation.battles.find((b) => b.id === battleId)!;
    if (battle.status === 'complete') return { ok: false, reason: 'already_complete' };

    const expectedAxes = generation.axes;
    const providedEntries = Object.entries(input.axes);
    const hasAllExpectedAxes = expectedAxes.every((key) => key in input.axes);
    const allValuesValid =
      isPick(input.overall) &&
      providedEntries.every(([, value]) => isPick(value)) &&
      providedEntries.every(([key]) => (expectedAxes as string[]).includes(key));

    if (!hasAllExpectedAxes || !allValuesValid) {
      return { ok: false, reason: 'invalid_axes', expected: expectedAxes };
    }

    // A tie doesn't dethrone the incumbent: the left-hand track (the
    // reigning champion in every round after the first) keeps the win.
    const winnerTrackId = input.overall === 'right' ? battle.rightTrackId : battle.leftTrackId;

    battle.status = 'complete';
    battle.overall = input.overall;
    battle.axisPicks = Object.fromEntries(expectedAxes.map((key) => [key, input.axes[key]]));
    battle.winnerTrackId = winnerTrackId;

    const completedBattle: PublicBattleResult = {
      ...this.toPublicBattle(generation, battle),
      overall: battle.overall,
      axisPicks: battle.axisPicks as Record<string, Pick>,
      winnerTrackId,
    };

    if (battle.round === 3) {
      generation.status = 'complete';
      generation.winnerTrackId = winnerTrackId;
      generation.currentBattleId = undefined;
      const winnerTrack = generation.tracks.find((t) => t.id === winnerTrackId)!;
      return {
        ok: true,
        generationId,
        ladderComplete: true,
        completedBattle,
        winner: { trackId: winnerTrack.id, letter: winnerTrack.letter },
      };
    }

    const nextRound = (battle.round + 1) as 2 | 3;
    // Round 1 seeds tracks[0] vs tracks[1]; the winner of round R then
    // faces tracks[R+1] (i.e. tracks[nextRound]) as the next challenger.
    const nextChallenger = generation.tracks[nextRound];
    const nextBattleRecord = this.createBattle(generation, nextRound, winnerTrackId, nextChallenger.id);
    generation.currentBattleId = nextBattleRecord.id;

    return {
      ok: true,
      generationId,
      ladderComplete: false,
      completedBattle,
      nextBattle: this.toPublicBattle(generation, nextBattleRecord),
    };
  }

  getLayers(trackId: string): LayersResult | undefined {
    const generationId = this.trackIndex.get(trackId);
    if (!generationId) return undefined;

    return {
      trackId,
      stems: STEM_TYPES.map((stem) => ({
        ...stem,
        url: `https://mock-audio.harmony.local/${generationId}/${trackId}/stems/${stem.type}.mp3`,
      })),
    };
  }

  getReveal(generationId: string): RevealResult {
    const generation = this.generations.get(generationId);
    if (!generation) return { ok: false, reason: 'not_found' };
    if (generation.status !== 'complete' || !generation.winnerTrackId) {
      return { ok: false, reason: 'ladder_incomplete' };
    }

    const winningTrack = generation.tracks.find((t) => t.id === generation.winnerTrackId)!;
    return {
      ok: true,
      generationId,
      winningTrack: { id: winningTrack.id, letter: winningTrack.letter },
      model: { id: winningTrack.model.id, name: winningTrack.model.name },
    };
  }

  private markTrackReady(generationId: string, trackId: string): void {
    const generation = this.generations.get(generationId);
    if (!generation) return;
    const track = generation.tracks.find((t) => t.id === trackId);
    if (!track || track.status === 'ready') return;

    track.status = 'ready';
    track.readyAt = new Date().toISOString();
    track.audioUrl = `https://mock-audio.harmony.local/${generationId}/${track.id}.mp3`;

    const emitter = this.emitters.get(generationId);
    const index = generation.tracks.indexOf(track);
    emitter?.emit('event', {
      type: 'track-ready',
      trackId: track.id,
      letter: track.letter,
      index,
    } satisfies GenerationEvent);

    if (generation.tracks.every((t) => t.status === 'ready')) {
      generation.status = 'battling';
      const battle = this.createBattle(generation, 1, generation.tracks[0].id, generation.tracks[1].id);
      generation.currentBattleId = battle.id;

      emitter?.emit('event', {
        type: 'all-ready',
        generationId,
        tracks: generation.tracks.map((t) => ({ id: t.id, letter: t.letter })),
        firstBattle: this.toPublicBattle(generation, battle),
      } satisfies GenerationEvent);
    }
  }

  private createBattle(generation: Generation, round: 1 | 2 | 3, leftTrackId: string, rightTrackId: string): Battle {
    const battle: Battle = {
      id: randomUUID(),
      generationId: generation.id,
      round,
      leftTrackId,
      rightTrackId,
      status: 'pending',
    };
    generation.battles.push(battle);
    this.battleIndex.set(battle.id, generation.id);
    return battle;
  }

  private toPublicBattle(generation: Generation, battle: Battle): PublicBattle {
    const left = generation.tracks.find((t) => t.id === battle.leftTrackId)!;
    const right = generation.tracks.find((t) => t.id === battle.rightTrackId)!;
    return {
      id: battle.id,
      round: battle.round,
      left: { trackId: left.id, letter: left.letter },
      right: { trackId: right.id, letter: right.letter },
      axes: generation.axes.map((key) => ({ key, label: AXIS_LABELS[key] })),
    };
  }
}

function isPick(value: unknown): value is Pick {
  return value === 'left' || value === 'tie' || value === 'right';
}
