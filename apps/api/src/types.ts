export type Scope = 'full_song' | 'beat' | 'vocal' | 'instrumental';
export type Genre = 'pop' | 'lofi' | 'cinematic' | 'electronic' | 'jazz';
export type Pick = 'left' | 'tie' | 'right';
export type Letter = 'A' | 'B' | 'C' | 'D';

export type AxisKey =
  | 'prompt_match'
  | 'production_quality'
  | 'vocals'
  | 'bass_rhythm'
  | 'melody'
  | 'synth_work'
  | 'improvisation';

export interface MockModel {
  id: string;
  name: string;
}

export interface Track {
  id: string;
  letter: Letter;
  status: 'generating' | 'ready';
  audioUrl?: string;
  readyAt?: string;
  /** Real model identity — stays server-side until /reveal. */
  model: MockModel;
}

/**
 * 4-battle bracket: two semifinals run in parallel (slot 1 = A vs B, slot 2
 * = C vs D), then the two semifinal winners meet in the final (1st/2nd
 * place) and the two semifinal losers meet in the consolation match
 * (3rd/4th place) — also run in parallel once both semifinals are done.
 */
export type BattleStage = 'semifinal' | 'final' | 'consolation';

export interface Battle {
  id: string;
  generationId: string;
  stage: BattleStage;
  /** Which semifinal this is (1 or 2); undefined for final/consolation. */
  slot?: 1 | 2;
  leftTrackId: string;
  rightTrackId: string;
  status: 'pending' | 'complete';
  overall?: Pick;
  axisPicks?: Partial<Record<AxisKey, Pick>>;
  winnerTrackId?: string;
  loserTrackId?: string;
}

export interface Placement {
  first: string;
  second: string;
  third: string;
  fourth: string;
}

export interface Generation {
  id: string;
  prompt: string;
  scope: Scope;
  genre: Genre;
  createdAt: string;
  tracks: Track[];
  axes: AxisKey[];
  status: 'generating' | 'battling' | 'complete';
  battles: Battle[];
  /** Track ids ranked 1st-4th; set once both the final and consolation are voted. */
  placement?: Placement;
}

export interface PublicBattle {
  id: string;
  stage: BattleStage;
  slot?: 1 | 2;
  left: { trackId: string; letter: Letter };
  right: { trackId: string; letter: Letter };
  axes: { key: AxisKey; label: string }[];
}

export type GenerationEvent =
  | { type: 'track-ready'; trackId: string; letter: Letter; index: number }
  | {
      type: 'all-ready';
      generationId: string;
      tracks: { id: string; letter: Letter }[];
      /** Both semifinals — open and votable as soon as generation finishes. */
      openBattles: PublicBattle[];
    };
