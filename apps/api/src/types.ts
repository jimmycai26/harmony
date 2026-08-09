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

export interface Battle {
  id: string;
  generationId: string;
  round: 1 | 2 | 3;
  leftTrackId: string;
  rightTrackId: string;
  status: 'pending' | 'complete';
  overall?: Pick;
  axisPicks?: Partial<Record<AxisKey, Pick>>;
  winnerTrackId?: string;
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
  currentBattleId?: string;
  winnerTrackId?: string;
}

export interface PublicBattle {
  id: string;
  round: 1 | 2 | 3;
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
      firstBattle: PublicBattle;
    };
