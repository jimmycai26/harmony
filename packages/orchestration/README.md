# @harmony/orchestration

Inngest-based fan-out orchestration for Harmony's "4 models generate concurrently" step (PRD step 2, "Listen & Vote"). Given a prompt + scope + genre + 4 model ids, this package kicks off 4 concurrent generation jobs, reports each track's progress independently as it finishes (progressive reveal), and emits one final event once all four are done (simultaneous unlock).

This package is **self-contained** and has no dependency on any other `packages/*` in this repo. It builds against a local mock of the model-adapter interface — see [Swapping in `packages/models`](#swapping-in-packagesmodels) below.

## Why Inngest, and why this shape

Per the tech-stack research referenced in the root `PRD.md` ("managed-first" — Inngest/Trigger.dev over Temporal while the product is pre-scale), fan-out here is done via **Inngest's event-driven pattern**: a parent function sends one event per model, a separate function instance picks up each event and runs independently, and the parent waits for all of them to report back. This is the idiomatic Inngest fan-out shape (as opposed to, say, `Promise.all` over `step.run` calls inside one function), and it buys two things this feature specifically needs:

- **True per-job isolation.** Each model's job is its own Inngest function run, with its own retry/timeout handling. A provider outage on one model can't corrupt or block the other three.
- **Progressive events for free.** Each track job sends its own `harmony/track.progress` event the moment *it* resolves, independent of the other three — this maps directly onto the PRD's "each card independently flips from a locked skeleton to ready" requirement, without this package needing to know anything about polling or batching on the consumer side.

## Two Inngest functions

```
harmony/generate-batch.requested
        │
        ▼
 generate-batch  ──fan-out──▶  4x harmony/track.generate-requested
        │                              │
        │                              ▼
        │                       generate-track (x4, concurrent)
        │                              │
        │                     harmony/track.progress (x4, as each finishes)
        │◀─────────────────────────────┘
        │
 harmony/batch.ready  (once all 4 have reported, ready or failed)
```

### `generate-batch` (`src/inngest/functions/generate-batch.ts`)

Triggered by `harmony/generate-batch.requested`. Sends one `harmony/track.generate-requested` event per model (`step.sendEvent`, one call with an array of 4 events), then does 4 concurrent `step.waitForEvent`s — one per model, matched on `batchId` + `modelId` — each with a 90s safety-net timeout. Once all 4 have settled (by receiving progress or by hitting the safety-net timeout), it sends one `harmony/batch.ready` event with all 4 results.

The `generate-batch` export is triggered directly; there's no factory function here (unlike `generate-track` below) because it doesn't need to swap in a real vs. mock dependency — it only orchestrates events.

### `generate-track` (`src/inngest/functions/generate-track.ts`)

Triggered by `harmony/track.generate-requested`. Runs one model's job to completion: calls `job.start()`, then polls `job.poll()` in a `step.run` + `step.sleep` loop until it sees `ready` or `failed` (or exhausts its poll budget — see [Retry/timeout policy](#retrytimeout-policy)), then sends `harmony/track.progress` with the outcome.

`createGenerateTrackFunction(jobFactory, options?)` is a factory, not a fixed export, because it needs a `ModelJobFactory` injected — currently the shipped mock (`generateTrackWithMock`, wired to `createMockModelJobFactory()`), eventually the real `packages/models` adapter. See below.

**Important design point:** provider failures (`job.start()`/`job.poll()` throwing) are caught *inside* the `step.run` callback and turned into `{ status: "failed" }` **data**, not left to throw out of `step.run`. This was a deliberate correction after testing against Inngest's actual execution semantics: once a step exhausts Inngest's own step-retry budget, the SDK ends the *entire function invocation* as a hard failure — that failure is not routed back into a `try/catch` written in the function body. If this package let provider errors throw naturally, a failing model would never get to send `harmony/track.progress`, and `generate-batch` would have to wait out the full 90s safety-net timeout for that card instead of finding out immediately. Converting provider errors into normal step *data* keeps this job's own poll loop in control of when to give up, and it always gets to report progress.

## Local interface for `packages/models`

`packages/models` (the real model-adapter layer) is being built in parallel and doesn't exist in this worktree. This package defines its own minimal interface for "a thing that can generate a track and reports progress" in **`src/types.ts`**:

```ts
export interface ModelJob {
  readonly modelId: string;
  start(): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<GenerationResult>;
}

export type ModelJobFactory = (params: {
  modelId: string;
  prompt: string;
  scope: Scope;
  genre: Genre;
}) => ModelJob;
```

This mirrors how real async generation APIs typically work: `start()` kicks a job off and hands back an opaque provider-side id; `poll()` re-checks status using that id. It's deliberately **stateless between calls** — `poll()` reconstructs status purely from `providerJobId`, not from anything cached on the `ModelJob` instance — because Inngest may recreate this object on a step replay after a process restart, and a real HTTP-backed provider gets statelessness for free (the provider's own server holds the state). The shipped mock (`src/mocks/mock-model-job.ts`) fakes this with a module-level `Map` standing in for "the provider's server."

### Swapping in `packages/models`

Once `packages/models` exists, it should export something matching `ModelJobFactory` (one factory covering all supported models, keyed by `modelId`). Integration is then:

```ts
import { createGenerateTrackFunction } from "@harmony/orchestration";
import { modelJobFactory } from "@harmony/models"; // the real thing

const generateTrack = createGenerateTrackFunction(modelJobFactory);
```

...in place of the shipped `generateTrackWithMock`. No other change to this package should be needed — `generate-batch` doesn't know or care what's behind `generate-track`.

## Event shape

Four event types, defined once in `src/inngest/events.ts` via Inngest's `eventType()`/`staticSchema()` (compile-time typed, no runtime schema validation — every producer of these events is this package itself, so there's nothing external to validate against). The API layer will need the last two to drive its SSE stream to the frontend:

| Event | Sent by | Consumed by | Purpose |
|---|---|---|---|
| `harmony/generate-batch.requested` | API layer (not yet built) | `generate-batch` | Kick off a batch: `{ batchId, prompt, scope, genre, modelIds }` |
| `harmony/track.generate-requested` | `generate-batch` | `generate-track` | Fan-out: one per model, `{ batchId, modelId, trackIndex, prompt, scope, genre }` |
| `harmony/track.progress` | `generate-track` | `generate-batch`, **API layer** | **Progressive reveal.** One per track, the instant it resolves: `{ batchId, modelId, trackIndex, status: "ready" \| "failed", audioUrl?, error? }` |
| `harmony/batch.ready` | `generate-batch` | **API layer** | **Simultaneous unlock.** Once, only after all 4 tracks have resolved: `{ batchId, tracks: TrackResult[] }` |

`trackIndex` is a track's position in the batch (0-3), not its model identity — the PRD's blind-until-reveal requirement means the frontend should key UI state off `trackIndex`/a letter label, not `modelId`, until step 4.

## Retry/timeout policy

Two judgment calls, made explicit here since there was no measured SLA to derive them from:

- **Poll cadence: 2s interval, 30 attempts (~60s budget) per job.** Generation providers surveyed in the tech-stack research typically land in the 3-15s range for a single track, so 60s leaves generous headroom for a slow-but-alive provider without letting one stuck job hold a card open indefinitely — the PRD's simultaneous-unlock UX depends on every card eventually resolving one way or the other. Configurable via `createGenerateTrackFunction(factory, { pollIntervalMs, maxPollAttempts })` (defaults 2000 / 30) — mainly so tests don't have to burn a full minute of wall-clock time to exercise the timeout path.
- **`generate-batch`'s per-track wait: 90s safety net.** Each track job already bounds itself to ~60s of polling and is designed to always send `harmony/track.progress` (ready or failed) — see the note above about catching provider errors as data specifically so this holds. The 90s wait in `generate-batch` (60s poll budget + buffer for step retry backoff and event delivery) exists only to cover the case where a track job fails hard enough to never emit at all (e.g. the `send-track-progress` step itself hits a transient infra error and burns through Inngest's own `retries: 2` for that step). If a track never reports, `generate-batch` treats it as `failed` after 90s rather than hanging the batch forever.
- **Inngest-level `retries: 2`** on `generate-track` and `retries: 1` on `generate-batch` cover genuinely unexpected failures — e.g. `step.sendEvent` hitting a transient network error — not provider/model errors, which (per the note above) are handled as data and never reach Inngest's step-retry mechanism.

None of this is a measured SLA — it's a reasonable starting point to revisit once there's real provider latency data.

## Local development

```
npm install
npm run dev          # starts a local Inngest-servable HTTP endpoint on :3100, wired to the mock model
npx inngest-cli dev   # in another terminal — connects to the above, gives you a UI to fire harmony/generate-batch.requested
```

`npm test` runs the unit/integration test suite (`node --test` + `tsx`, `@inngest/test` for the Inngest function tests — no live Inngest server needed). `npm run typecheck` / `npm run build` for the rest.

## Testing notes

`generate-track`'s tests exercise the real retry/timeout/error-handling logic end to end via `@inngest/test` (which runs the actual Inngest execution engine against in-memory step state) with tiny deterministic `ModelJob` fakes, rather than the shipped randomized mock. Two framework quirks worth knowing if you extend these:

- `step.sleep` genuinely pauses a durable run until an external trigger resumes it. Inside a single `@inngest/test` execution pass there's nothing to resume it, so tests that need the poll loop to run to exhaustion mock the `poll-wait-*` sleep steps out as no-ops instead of relying on real waits.
- `@inngest/test` always simulates `attempt: 0` (it doesn't yet support simulating a later retry attempt) — which is a large part of why provider errors are handled as step *data* in this package rather than as thrown exceptions in the first place; a design that depended on Inngest routing an exhausted-retries step failure back into a function-level `try/catch` wouldn't be observable in a single-attempt test at all.

`generate-batch`'s fan-out/aggregation logic is comparatively low-risk (straightforward field mapping over `step.waitForEvent` results) and is covered by type-checking plus the manual dev-server flow above rather than an automated integration test — an attempt at mocking multiple concurrent `step.waitForEvent` results through `@inngest/test` ran into an event-schema-validation edge case in that dependency worth revisiting rather than working around under time pressure.
