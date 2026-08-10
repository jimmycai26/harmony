import { inngest } from "../client.js";
import { batchReady, generateBatchRequested, trackGenerateRequested, trackProgress } from "../events.js";
import type { TrackResult } from "../../types.js";

/**
 * Safety-net timeout for the parent's wait on each track. Each
 * generate-track job already bounds itself to ~60s of polling and always
 * sends a `harmony/track.progress` event (ready or failed) when it's done,
 * so this should rarely fire — it exists to cover the case where a track
 * job itself crashes hard enough to never emit (e.g. exhausts its
 * `retries` on an infra error). 90s = 60s poll budget + buffer for retry
 * backoff and event delivery latency.
 */
const TRACK_WAIT_TIMEOUT = "90s";

/**
 * Fan-out orchestrator for a single generate request. Given a batch of 4
 * model ids, sends 4 independent `harmony/track.generate-requested` events
 * (one per model, handled concurrently by `generate-track` instances), then
 * waits for all 4 to individually report progress before announcing the
 * batch as ready — the parent for the PRD's "reveal cards as they finish,
 * unlock only once all four are ready" step-2 behavior.
 */
export const generateBatch = inngest.createFunction(
  {
    id: "harmony-generate-batch",
    retries: 1,
    triggers: [{ event: generateBatchRequested }],
  },
  async ({ event, step }) => {
    const { batchId, prompt, scope, genre, modelIds } = event.data;

    await step.sendEvent(
      "fan-out-track-jobs",
      modelIds.map((modelId, trackIndex) =>
        trackGenerateRequested.create({ batchId, modelId, trackIndex, prompt, scope, genre }),
      ),
    );

    // Each wait matches on this specific batch + model, via the *incoming*
    // track.progress event's data ("async") compared against this
    // function's own triggering event ("event") plus the model id baked
    // into the CEL expression at fan-out time. Zipping modelId/trackIndex
    // through the same `map` closure that starts the wait (rather than
    // re-deriving them from array position afterwards) keeps each result
    // tied to the job that produced it.
    const tracks: TrackResult[] = await Promise.all(
      modelIds.map(async (modelId, trackIndex) => {
        const evt = await step.waitForEvent(`wait-track-${trackIndex}`, {
          event: trackProgress,
          timeout: TRACK_WAIT_TIMEOUT,
          if: `async.data.batchId == event.data.batchId && async.data.modelId == "${modelId}"`,
        });

        if (!evt) {
          return {
            modelId,
            trackIndex,
            status: "failed" as const,
            error: "track did not report progress before the batch-level timeout",
          };
        }

        return {
          modelId: evt.data.modelId,
          trackIndex: evt.data.trackIndex,
          status: evt.data.status,
          audioUrl: evt.data.audioUrl,
          error: evt.data.error,
        };
      }),
    );

    // Simultaneous-unlock signal: fires once, only after every track has
    // resolved (ready or failed) — never before.
    await step.sendEvent("send-batch-ready", batchReady.create({ batchId, tracks }));

    return { batchId, tracks };
  },
);
