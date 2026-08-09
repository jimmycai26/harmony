import type { JobStatusResult } from "./types.js";

/**
 * Several of the real providers (Stable Audio, Lyria 2, ElevenLabs) return
 * finished audio synchronously from a single HTTP call rather than handing
 * back a pollable job id. To keep every adapter honoring the same
 * generate-then-poll contract, those adapters make the call inside
 * `generate`, stash the outcome here under a freshly minted job id, and let
 * `getStatus` just look it up.
 */

const store = new Map<string, JobStatusResult>();

export function putJob(jobId: string, result: JobStatusResult): void {
  store.set(jobId, result);
}

export function getJob(jobId: string): JobStatusResult | undefined {
  return store.get(jobId);
}
