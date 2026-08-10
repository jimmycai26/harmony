import { eventType, staticSchema } from "inngest";
import type {
  BatchReadyData,
  GenerateBatchRequestedData,
  TrackGenerateRequestedData,
  TrackProgressData,
} from "../types.js";

/**
 * Typed event definitions (Inngest v4's `eventType()` + `staticSchema()`
 * pattern). Each one doubles as a function trigger (`triggers: [{ event:
 * trackProgress }]`) and an event constructor (`trackProgress.create(data)`)
 * so `event.data` inside handlers and the payload passed to
 * `step.sendEvent`/`step.waitForEvent` all share one source of truth: the
 * data shapes in `types.ts`.
 *
 * `staticSchema()` gives compile-time typing only, no runtime validation —
 * fine here since every producer of these events is this package itself.
 */

export const generateBatchRequested = eventType("harmony/generate-batch.requested", {
  schema: staticSchema<GenerateBatchRequestedData & Record<string, unknown>>(),
});

export const trackGenerateRequested = eventType("harmony/track.generate-requested", {
  schema: staticSchema<TrackGenerateRequestedData & Record<string, unknown>>(),
});

export const trackProgress = eventType("harmony/track.progress", {
  schema: staticSchema<TrackProgressData & Record<string, unknown>>(),
});

export const batchReady = eventType("harmony/batch.ready", {
  schema: staticSchema<BatchReadyData & Record<string, unknown>>(),
});
