// Types mirroring the harmony-backend API contract (apps/api).
// Source of truth: the captain's launch brief, not this repo — keep in sync by hand
// until the backend publishes a shared package.

export type Scope = "full_song" | "just_a_beat" | "vocal_take" | "instrumental_only";
export type Genre = "pop" | "lofi" | "cinematic" | "electronic" | "jazz";

export type TrackLetter = "A" | "B" | "C" | "D";

export type Vote = "left" | "tie" | "right";

export interface Axis {
  key: string;
  label: string;
}

export interface GenerateTrack {
  id: string;
  letter: TrackLetter;
  status: string;
}

export interface GenerateResponse {
  generationId: string;
  status: string;
  tracks: GenerateTrack[];
  axes: Axis[];
  eventsUrl: string;
}

export type BattleStage = "semifinal" | "final" | "consolation" | "round_robin";

export interface BattleTrackRef {
  trackId: string;
  letter: TrackLetter;
}

export interface PublicBattle {
  id: string;
  stage: BattleStage;
  slot?: 1 | 2;
  left: BattleTrackRef;
  right: BattleTrackRef;
  axes: Axis[];
}

export interface TrackReadyEvent {
  trackId: string;
  letter: TrackLetter;
  index: number;
  // Present when status === "ready"; absent for a failed track.
  audioUrl?: string;
}

export interface AllReadyEvent {
  generationId: string;
  // audioUrl undefined only for the one DNF track in a round-robin (never generated).
  tracks: { id: string; letter: TrackLetter; audioUrl?: string }[];
  openBattles: PublicBattle[];
}

export interface GenerationFailedEvent {
  generationId: string;
  reason: string;
  tracks: GenerateTrack[];
}

export interface VoteRequest {
  overall: Vote;
  axes: Record<string, Vote>;
}

export interface PlacementEntry {
  track: { id: string; letter: TrackLetter };
  model: { id: string; name: string };
}

export interface Placement {
  first: PlacementEntry;
  second: PlacementEntry;
  third: PlacementEntry;
  fourth: PlacementEntry;
}

export interface BattleRecordedResponse {
  status: "battle_recorded";
  completedBattle: PublicBattle;
  unlockedBattles: PublicBattle[];
}

export interface BracketCompleteResponse {
  status: "bracket_complete";
  completedBattle: PublicBattle;
  placement: Placement;
  revealUrl: string;
}

export type VoteResponse = BattleRecordedResponse | BracketCompleteResponse;

export interface Stem {
  type: string;
  label: string;
  url: string;
}

export interface LayersResponse {
  trackId: string;
  stems: Stem[];
}

export interface RevealResponse {
  generationId: string;
  placement: Placement;
}
