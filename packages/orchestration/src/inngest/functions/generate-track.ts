import { inngest } from "../client.js";
import { trackGenerateRequested, trackProgress } from "../events.js";
import { createMockModelJobFactory } from "../../mocks/mock-model-job.js";
import type { GenerationResult, ModelJobFactory, TrackResult } from "../../types.js";

/**
 * Poll cadence + budget for a single model job.
 *
 * 2s between polls, 30 attempts -> ~60s of active polling before we give up
 * on a job and report it failed. This is a judgment call, not a measured
 * SLA: generation providers observed in tech-stack research typically land
 * in the 3-15s range for a single track, so 60s leaves generous headroom
 * for a slow-but-alive provider without letting one stuck job hold a whole
 * batch's card open indefinitely (the PRD's simultaneous-unlock UX depends
 * on every card eventually resolving one way or the other).
 */
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 30;

export interface GenerateTrackFunctionOptions {
  /** Delay between poll attempts. Defaults to 2s; overridable so tests don't burn wall-clock time on the full retry budget. */
  pollIntervalMs?: number;
  /** Poll attempts before giving up on a job. Defaults to 30 (~60s at the default interval). */
  maxPollAttempts?: number;
}

/**
 * Builds the per-model-job Inngest function. Takes a `ModelJobFactory` so
 * the mock can be swapped for the real `packages/models` adapter without
 * touching this file — see the README's "Swapping in packages/models"
 * section.
 *
 * `job.start()`/`job.poll()` failures are caught *inside* each `step.run`
 * call and turned into a `{ status: "failed" }` result rather than left to
 * throw. This is deliberate: once a step exhausts Inngest's own retries,
 * the SDK ends the whole invocation as a hard function failure — that
 * failure isn't routed back into a `try/catch` in this handler, so it can
 * never turn into a `harmony/track.progress` event, and the batch would
 * only recover once `generate-batch`'s 90s safety-net timeout lapses. By
 * treating "the provider errored" as normal step *data* instead of a step
 * *exception*, this job's own poll loop stays in control of when to give
 * up, and always gets to send progress.
 */
export function createGenerateTrackFunction(
  jobFactory: ModelJobFactory,
  { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS }: GenerateTrackFunctionOptions = {},
) {
  return inngest.createFunction(
    {
      id: "harmony-generate-track",
      // Applies to genuinely unexpected failures (e.g. the sendEvent step
      // below hitting a transient network error) — not to provider errors,
      // which are handled as data (see the function doc comment above) and
      // never reach Inngest's own step retry mechanism.
      retries: 2,
      // Caps how many track jobs run at once across ALL batches, so one
      // prompt storm can't starve the provider APIs or Inngest's own
      // concurrency budget. 20 = room for 5 concurrent 4-track batches.
      concurrency: { limit: 20 },
      triggers: [{ event: trackGenerateRequested }],
    },
    async ({ event, step }) => {
      const { batchId, modelId, trackIndex, prompt, scope, genre } = event.data;
      const job = jobFactory({ modelId, prompt, scope, genre });

      const started = await step.run("start-job", async () => {
        try {
          const { providerJobId } = await job.start();
          return { ok: true as const, providerJobId };
        } catch (err) {
          return {
            ok: false as const,
            error: err instanceof Error ? err.message : "unknown error starting job",
          };
        }
      });

      let result: TrackResult;

      if (!started.ok) {
        result = { modelId, trackIndex, status: "failed", error: started.error };
      } else {
        const { providerJobId } = started;
        let outcome: GenerationResult | undefined;

        for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
          outcome = await step.run(`poll-job-${attempt}`, async () => {
            try {
              return await job.poll(providerJobId);
            } catch (err) {
              return {
                status: "failed" as const,
                error: err instanceof Error ? err.message : "unknown error polling job",
              };
            }
          });
          if (outcome.status === "ready" || outcome.status === "failed") {
            break;
          }
          await step.sleep(`poll-wait-${attempt}`, pollIntervalMs);
        }

        if (!outcome || (outcome.status !== "ready" && outcome.status !== "failed")) {
          result = {
            modelId,
            trackIndex,
            status: "failed",
            error: `timed out after ${maxPollAttempts * pollIntervalMs}ms waiting for generation`,
          };
        } else if (outcome.status === "failed") {
          result = { modelId, trackIndex, status: "failed", error: outcome.error ?? "generation failed" };
        } else {
          result = { modelId, trackIndex, status: "ready", audioUrl: outcome.audioUrl };
        }
      }

      // Progressive reveal: this fires the instant *this* track resolves,
      // independent of the other 3 in the batch.
      await step.sendEvent("send-track-progress", trackProgress.create({ batchId, ...result }));

      return result;
    },
  );
}

/** Convenience instance wired to the mock, for local dev / the Inngest Dev Server. */
export const generateTrackWithMock = createGenerateTrackFunction(createMockModelJobFactory());
