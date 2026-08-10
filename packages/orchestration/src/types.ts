/**
 * Local interface stand-in for `packages/models`.
 *
 * `packages/models` is being built in parallel and doesn't exist in this
 * worktree yet. Everything in this file is the contract this package
 * expects that package to eventually satisfy — see the README's
 * "Swapping in packages/models" section for the integration steps.
 */

export type Scope = "full-song" | "beat" | "vocal-take" | "instrumental";
export type Genre = "pop" | "lofi" | "cinematic" | "electronic" | "jazz";

export type GenerationStatus = "pending" | "processing" | "ready" | "failed";

export interface GenerationResult {
  status: GenerationStatus;
  /** Present when status === "ready". */
  audioUrl?: string;
  /** Present when status === "failed". */
  error?: string;
}

/**
 * A single model's generation job. Mirrors how real async generation APIs
 * work: `start()` kicks the job off and hands back an opaque provider-side
 * id, `poll()` re-checks status using that id.
 *
 * Deliberately stateless between calls (no state lives on `this` beyond the
 * `modelId` label) — `poll()` must be able to reconstruct status purely from
 * `providerJobId`, because Inngest may recreate this object on a step
 * replay after a process restart. A real HTTP-backed adapter gets this for
 * free (the provider's server holds the state); the in-memory mock in
 * `mocks/mock-model-job.ts` fakes it with a module-level map.
 */
export interface ModelJob {
  readonly modelId: string;
  start(): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<GenerationResult>;
}

/**
 * Constructs a `ModelJob` for one model. `packages/models` should export
 * something satisfying this signature (one factory covering all supported
 * models, keyed by `modelId`) so it can be passed straight into
 * `createGenerateTrackFunction()` in place of the mock.
 */
export type ModelJobFactory = (params: {
  modelId: string;
  prompt: string;
  scope: Scope;
  genre: Genre;
}) => ModelJob;

export interface TrackResult {
  modelId: string;
  /** Position within the 4-track batch (0-3). Not the model's identity — reveal stays blind until step 4. */
  trackIndex: number;
  status: Extract<GenerationStatus, "ready" | "failed">;
  audioUrl?: string;
  error?: string;
}

export interface GenerateBatchRequestedData {
  batchId: string;
  prompt: string;
  scope: Scope;
  genre: Genre;
  /** Exactly 4 model ids, per the PRD's "4 models per generation" decision. */
  modelIds: [string, string, string, string];
}

export interface TrackGenerateRequestedData {
  batchId: string;
  modelId: string;
  trackIndex: number;
  prompt: string;
  scope: Scope;
  genre: Genre;
}

export interface TrackProgressData extends TrackResult {
  batchId: string;
}

export interface BatchReadyData {
  batchId: string;
  tracks: TrackResult[];
}

/**
 * The four Inngest event types this package sends/receives. The API layer
 * consumes `harmony/track.progress` (progressive reveal, one per finished
 * card) and `harmony/batch.ready` (simultaneous unlock signal) to drive its
 * SSE stream to the frontend.
 */
export type HarmonyEvents = {
  "harmony/generate-batch.requested": { data: GenerateBatchRequestedData };
  "harmony/track.generate-requested": { data: TrackGenerateRequestedData };
  "harmony/track.progress": { data: TrackProgressData };
  "harmony/batch.ready": { data: BatchReadyData };
};
