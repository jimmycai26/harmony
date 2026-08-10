import assert from "node:assert/strict";
import { test } from "node:test";
import { InngestTestEngine } from "@inngest/test";
import { createGenerateTrackFunction } from "../inngest/functions/generate-track.js";
import type { GenerationResult, ModelJob, ModelJobFactory, TrackResult } from "../types.js";

/**
 * These exercise the real retry/timeout policy end to end (via
 * `@inngest/test`, which runs the actual Inngest execution engine against
 * in-memory step state), using tiny deterministic `ModelJob` fakes instead
 * of the shipped mock — the shipped mock's randomized latency is fine for
 * manual/dev use but would make these tests flaky or slow. `pollIntervalMs`
 * /`maxPollAttempts` are overridden so the timeout test doesn't spend 60
 * real seconds waiting out the production retry budget (Inngest still
 * rounds any `step.sleep` below 1s up to 1s, so a couple of poll attempts
 * still costs a couple of real seconds).
 *
 * `send-track-progress` is mocked out via `steps` so the run doesn't
 * attempt a real network call to Inngest (there's no dev server/event key
 * in this test process) — the call is still recorded on the `ctx.step.sendEvent`
 * spy, which is what these tests assert against.
 */

const noopSendTrackProgress = { id: "send-track-progress", handler: () => undefined };

const baseEvent = {
  name: "harmony/track.generate-requested" as const,
  data: {
    batchId: "batch-1",
    modelId: "model-a",
    trackIndex: 0,
    prompt: "a lo-fi beat",
    scope: "beat" as const,
    genre: "lofi" as const,
  },
};

function fixedJobFactory(pollResults: GenerationResult[]): ModelJobFactory {
  return ({ modelId }) => {
    let callIndex = 0;
    const job: ModelJob = {
      modelId,
      async start() {
        return { providerJobId: `job-${modelId}` };
      },
      async poll() {
        const result = pollResults[Math.min(callIndex, pollResults.length - 1)]!;
        callIndex += 1;
        return result;
      },
    };
    return job;
  };
}

test("reports ready and emits track.progress as soon as the job resolves", async () => {
  const fn = createGenerateTrackFunction(fixedJobFactory([{ status: "ready", audioUrl: "https://example.com/a.mp3" }]), {
    pollIntervalMs: 1,
    maxPollAttempts: 5,
  });
  const t = new InngestTestEngine({ function: fn });

  const { result, ctx } = await t.execute({ events: [baseEvent], steps: [noopSendTrackProgress] });
  const track = result as TrackResult;

  assert.deepEqual(track, {
    modelId: "model-a",
    trackIndex: 0,
    status: "ready",
    audioUrl: "https://example.com/a.mp3",
  });
  assert.equal(ctx.step.sendEvent.mock.calls.length, 1);
  const [, payload] = ctx.step.sendEvent.mock.calls[0]!;
  assert.equal((payload as { name: string }).name, "harmony/track.progress");
  assert.deepEqual((payload as { data: unknown }).data, { batchId: "batch-1", ...track });
});

test("reports failed (without throwing) when the provider reports failure", async () => {
  const fn = createGenerateTrackFunction(fixedJobFactory([{ status: "failed", error: "provider exploded" }]), {
    pollIntervalMs: 1,
    maxPollAttempts: 5,
  });
  const t = new InngestTestEngine({ function: fn });

  const { result } = await t.execute({ events: [baseEvent], steps: [noopSendTrackProgress] });
  const track = result as TrackResult;

  assert.equal(track.status, "failed");
  assert.equal(track.error, "provider exploded");
});

test("gives up and reports failed after exhausting the poll budget, instead of hanging", async () => {
  const maxPollAttempts = 2;
  const fn = createGenerateTrackFunction(fixedJobFactory([{ status: "processing" }]), {
    pollIntervalMs: 1,
    maxPollAttempts,
  });
  const t = new InngestTestEngine({ function: fn });

  // `step.sleep` genuinely pauses a durable run until an external trigger
  // resumes it — inside a single `t.execute()` pass there's nothing to
  // resume it, so it would hang forever. Mock the sleep steps out (as
  // no-ops) the same way `send-track-progress` is mocked, so the poll loop
  // can actually run to exhaustion within the test.
  const noopSleeps = Array.from({ length: maxPollAttempts }, (_, attempt) => ({
    id: `poll-wait-${attempt}`,
    handler: () => undefined,
  }));

  const { result } = await t.execute({
    events: [baseEvent],
    steps: [noopSendTrackProgress, ...noopSleeps],
  });
  const track = result as TrackResult;

  assert.equal(track.status, "failed");
  assert.match(track.error ?? "", /timed out/);
});

test("reports failed instead of throwing when the job factory's start() rejects", async () => {
  const throwingFactory: ModelJobFactory = ({ modelId }) => ({
    modelId,
    async start(): Promise<{ providerJobId: string }> {
      throw new Error("provider unreachable");
    },
    async poll(): Promise<GenerationResult> {
      throw new Error("should never be called");
    },
  });
  const fn = createGenerateTrackFunction(throwingFactory, { pollIntervalMs: 1, maxPollAttempts: 3 });
  const t = new InngestTestEngine({ function: fn });

  const { result } = await t.execute({ events: [baseEvent], steps: [noopSendTrackProgress] });
  const track = result as TrackResult;

  assert.equal(track.status, "failed");
  assert.equal(track.error, "provider unreachable");
});
