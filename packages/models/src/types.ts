/**
 * The common contract every model adapter implements. This is the file
 * `packages/orchestration` and `apps/api` should import against — treat
 * changes here as a breaking API change for both.
 */

/** Stable identifier for a model in the roster. Add new models by extending this union. */
export type ModelId = "stable-audio" | "lyria-2" | "elevenlabs" | "minimax" | "mock";

/** Mirrors the step-1 "Scope" chip group in the PRD. */
export type GenerationScope = "full-song" | "beat" | "vocal-take" | "instrumental";

/** Mirrors the step-1 "Genre" chip group in the PRD. */
export type GenerationGenre = "pop" | "lo-fi" | "cinematic" | "electronic" | "jazz";

export interface GenerateOptions {
  scope: GenerationScope;
  genre: GenerationGenre;
}

export interface GenerateResult {
  /** Opaque handle for this generation job. Pass it to `getStatus` to poll. */
  jobId: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobStatusResult {
  status: JobStatus;
  /**
   * Present once `status === "completed"`. May be a real HTTP(S) URL (async
   * providers that host the file) or a `data:` URL (providers that return
   * raw audio bytes synchronously and have no storage layer of their own
   * yet). Callers that need a stable, permanent URL should persist this via
   * `packages/storage` rather than holding onto it long-term.
   */
  audioUrl?: string;
  /** Present when `status === "failed"`. */
  error?: string;
}

/** Static metadata about a roster entry, independent of any adapter instance. */
export interface ModelInfo {
  modelId: ModelId;
  displayName: string;
  provider: string;
  licensing: "closed" | "open-source";
  /** Public docs this adapter's request/response shape was modeled on. */
  docsUrl: string;
}

export interface ModelAdapter {
  readonly modelId: ModelId;
  readonly displayName: string;

  /**
   * Kick off a generation job. Resolves as soon as the job is accepted, not
   * when audio is ready. May reject if the provider refuses the request
   * outright (bad prompt, auth failure) before a job id even exists —
   * callers should wrap calls to `generate` in a try/catch. Once a job id
   * exists, all further outcomes (including later failures) are reported
   * through `getStatus`, which never rejects.
   */
  generate(prompt: string, options: GenerateOptions): Promise<GenerateResult>;

  /**
   * Check on a job started by `generate`. Safe to call repeatedly (poll)
   * until `status` is `"completed"` or `"failed"` — both are terminal.
   * Never rejects; provider-side failures surface as `status: "failed"`
   * with `error` set.
   */
  getStatus(jobId: string): Promise<JobStatusResult>;
}
