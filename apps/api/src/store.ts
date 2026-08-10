import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { AXIS_LABELS, computeAxes } from './axes';
import { pickFourModels } from './mockModels';
import type {
  AxisKey,
  Battle,
  BattleStage,
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
  loserTrackId: string;
}

export interface PublicPlacementEntry {
  track: { id: string; letter: Letter };
  model: { id: string; name: string };
}

export interface PublicPlacement {
  first: PublicPlacementEntry;
  second: PublicPlacementEntry;
  third: PublicPlacementEntry;
  fourth: PublicPlacementEntry;
}

export type RecordVoteResult =
  | {
      ok: true;
      generationId: string;
      completedBattle: PublicBattleResult;
      /** Newly-votable battles unlocked by this vote (0, 1, or 2). */
      unlockedBattles: PublicBattle[];
      bracketComplete: boolean;
      placement?: PublicPlacement;
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_complete' }
  | { ok: false; reason: 'invalid_axes'; expected: AxisKey[] };

export type RevealResult =
  | { ok: true; generationId: string; placement: PublicPlacement }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'bracket_incomplete' };

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
  /** Battles currently open for voting (used to replay state to a late/reconnecting SSE client). */
  getOpenBattles(generationId: string): PublicBattle[] | undefined;
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
    // pickFourModels() both selects the 4 competing models AND randomizes
    // their order — that order becomes the bracket seeding below (which
    // model lands in slot A/B/C/D, and therefore who faces whom in the
    // semifinals), so seeding is random on every generation.
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

  getOpenBattles(generationId: string): PublicBattle[] | undefined {
    const generation = this.generations.get(generationId);
    if (!generation) return undefined;
    return generation.battles
      .filter((b) => b.status === 'pending')
      .map((b) => this.toPublicBattle(generation, b));
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

    // A tie doesn't dethrone the left-hand track — see README for why.
    const winnerTrackId = input.overall === 'right' ? battle.rightTrackId : battle.leftTrackId;
    const loserTrackId = winnerTrackId === battle.leftTrackId ? battle.rightTrackId : battle.leftTrackId;

    battle.status = 'complete';
    battle.overall = input.overall;
    battle.axisPicks = Object.fromEntries(expectedAxes.map((key) => [key, input.axes[key]]));
    battle.winnerTrackId = winnerTrackId;
    battle.loserTrackId = loserTrackId;

    const completedBattle: PublicBattleResult = {
      ...this.toPublicBattle(generation, battle),
      overall: battle.overall,
      axisPicks: battle.axisPicks as Record<string, Pick>,
      winnerTrackId,
      loserTrackId,
    };

    const unlockedBattles: PublicBattle[] = [];
    let bracketComplete = false;

    if (battle.stage === 'semifinal') {
      const sibling = generation.battles.find((b) => b.stage === 'semifinal' && b.id !== battle.id)!;
      if (sibling.status === 'complete') {
        // Both semifinals are done: seed the winners' final and the
        // losers' consolation match (3rd/4th place) at the same time.
        const semi1 = generation.battles.find((b) => b.stage === 'semifinal' && b.slot === 1)!;
        const semi2 = generation.battles.find((b) => b.stage === 'semifinal' && b.slot === 2)!;
        const final = this.createBattle(generation, 'final', undefined, semi1.winnerTrackId!, semi2.winnerTrackId!);
        const consolation = this.createBattle(
          generation,
          'consolation',
          undefined,
          semi1.loserTrackId!,
          semi2.loserTrackId!,
        );
        unlockedBattles.push(this.toPublicBattle(generation, final), this.toPublicBattle(generation, consolation));
      }
    } else {
      const counterpart = generation.battles.find(
        (b) => b.stage === (battle.stage === 'final' ? 'consolation' : 'final'),
      );
      if (counterpart?.status === 'complete') {
        const final = generation.battles.find((b) => b.stage === 'final')!;
        const consolation = generation.battles.find((b) => b.stage === 'consolation')!;
        generation.status = 'complete';
        generation.placement = {
          first: final.winnerTrackId!,
          second: final.loserTrackId!,
          third: consolation.winnerTrackId!,
          fourth: consolation.loserTrackId!,
        };
        bracketComplete = true;
      }
    }

    return {
      ok: true,
      generationId,
      completedBattle,
      unlockedBattles,
      bracketComplete,
      placement: bracketComplete ? this.toPublicPlacement(generation) : undefined,
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
    if (generation.status !== 'complete' || !generation.placement) {
      return { ok: false, reason: 'bracket_incomplete' };
    }

    return { ok: true, generationId, placement: this.toPublicPlacement(generation) };
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
      const [a, b, c, d] = generation.tracks;
      const semi1 = this.createBattle(generation, 'semifinal', 1, a.id, b.id);
      const semi2 = this.createBattle(generation, 'semifinal', 2, c.id, d.id);

      emitter?.emit('event', {
        type: 'all-ready',
        generationId,
        tracks: generation.tracks.map((t) => ({ id: t.id, letter: t.letter })),
        openBattles: [this.toPublicBattle(generation, semi1), this.toPublicBattle(generation, semi2)],
      } satisfies GenerationEvent);
    }
  }

  private createBattle(
    generation: Generation,
    stage: BattleStage,
    slot: 1 | 2 | undefined,
    leftTrackId: string,
    rightTrackId: string,
  ): Battle {
    const battle: Battle = {
      id: randomUUID(),
      generationId: generation.id,
      stage,
      slot,
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
      stage: battle.stage,
      slot: battle.slot,
      left: { trackId: left.id, letter: left.letter },
      right: { trackId: right.id, letter: right.letter },
      axes: generation.axes.map((key) => ({ key, label: AXIS_LABELS[key] })),
    };
  }

  private toPublicPlacement(generation: Generation): PublicPlacement {
    const placement = generation.placement!;
    const entry = (trackId: string): PublicPlacementEntry => {
      const track = generation.tracks.find((t) => t.id === trackId)!;
      return { track: { id: track.id, letter: track.letter }, model: { id: track.model.id, name: track.model.name } };
    };
    return {
      first: entry(placement.first),
      second: entry(placement.second),
      third: entry(placement.third),
      fourth: entry(placement.fourth),
    };
  }
}

function isPick(value: unknown): value is Pick {
  return value === 'left' || value === 'tie' || value === 'right';
}
