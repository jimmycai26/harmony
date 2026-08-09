# @harmony/models

Unified adapter layer over Harmony's AI music generation model roster. This
is the package `packages/orchestration` and `apps/api` fan generation
requests out through — they should depend on the `ModelAdapter` contract in
[`src/types.ts`](./src/types.ts) and the factory in
[`src/registry.ts`](./src/registry.ts), not on any individual provider file.

This package is self-contained: its own `package.json` and `tsconfig.json`,
no dependency on root workspace wiring. It hasn't been wired into a root
`pnpm-workspace.yaml` yet — that happens in a separate integration pass.

## Roster

Per the PRD, 4 models run per generation request, closed/proprietary
preferred, and the roster is expected to be actively refined:

| Model | Provider | Licensing | `modelId` |
|---|---|---|---|
| Stable Audio | Stability AI | closed | `stable-audio` |
| Lyria 2 | Google DeepMind (via Vertex AI) | closed | `lyria-2` |
| ElevenLabs | ElevenLabs | closed | `elevenlabs` |
| MiniMax | MiniMax | closed | `minimax` |

Plus a `mock` adapter (`modelId: "mock"`) that isn't part of the production
roster but is always available from the registry for local dev.

`MODEL_ROSTER` in `src/registry.ts` is the single source of truth for the
production 4. **To add or remove a model:** add/remove its `ModelInfo` entry
there, add/remove the matching case in that file's `factories` map, and (if
adding) drop a new adapter file in `src/adapters/`. Nothing else in this
package, or in callers using `getAllModelAdapters()`, needs to change.

## The contract

```ts
interface ModelAdapter {
  readonly modelId: ModelId;
  readonly displayName: string;
  generate(prompt: string, options: { scope: GenerationScope; genre: GenerationGenre }): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<{ status: "queued" | "processing" | "completed" | "failed"; audioUrl?: string; error?: string }>;
}
```

- `generate` starts a job and resolves as soon as it's *accepted* — not when
  audio is ready. It may reject if the provider refuses the request outright
  before a job id exists (bad auth, malformed prompt); callers should wrap
  it in a try/catch.
- `getStatus` polls a job by id. It never rejects — once a job id exists,
  every outcome (including provider-side failures) is reported as a
  `JobStatusResult`, with `status: "failed"` and `error` set on failure.
- `scope`/`genre` are the same enums as the PRD's step-1 chip groups
  (`GenerationScope`, `GenerationGenre` in `src/types.ts`) so callers can
  pass the user's choices straight through.
- `audioUrl` may be a real HTTPS URL or a `data:` URL — see "Why `data:`
  URLs sometimes" below. Callers that need a durable link should persist it
  via `packages/storage` rather than holding onto whatever comes back here.

Get an adapter via the registry rather than importing a concrete class:

```ts
import { getModelAdapter, getAllModelAdapters } from "@harmony/models";

const adapter = getModelAdapter("stable-audio");
const { jobId } = await adapter.generate("a chill lo-fi beat", { scope: "beat", genre: "lo-fi" });
const status = await adapter.getStatus(jobId); // poll until status is "completed" or "failed"

// fan out to the whole production roster at once, per the PRD's 4-models-per-request flow:
const jobs = await Promise.all(getAllModelAdapters().map((a) => a.generate(prompt, options)));
```

## Mocking — no real API keys yet

No real API keys exist yet, so every real adapter reads its key(s) from env
vars and checks them against the placeholder convention in
[`isPlaceholder`](./src/env.ts): any unset, empty, or `dummy-...`-prefixed
value is treated as "not configured." When that's the case, the adapter
transparently delegates to an internal `MockModelAdapter` instead of making
a network call — so this package is fully runnable and testable with zero
credentials, and every adapter behaves identically until real keys land.

`.env.example` documents every var each adapter reads, all set to
`dummy-...` placeholders. Copy it to `.env` (and load it however your app
does — this package doesn't ship a dotenv dependency) to override with real
values later; leave it as-is for now.

For pure local dev without even pretending to have a specific provider, use
`getModelAdapter("mock")` (or `new MockModelAdapter()`) directly — it
returns a fake completed job with a synthetic `audioUrl` after a short
in-memory delay (default 1.5s), independent of any adapter's fallback path.

## Why `data:` URLs sometimes

Three of the four providers (Stable Audio, Lyria 2, ElevenLabs) return
finished audio bytes synchronously in a single HTTP response rather than
handing back a pollable job — there's no real "processing" state to poll.
To keep every adapter honoring the same generate-then-poll contract, those
adapters make the call inside `generate`, then stash the outcome (including
the audio, base64-encoded as a `data:` URL) under a freshly minted job id in
an in-memory store (`src/jobs.ts`); `getStatus` just replays it. There's no
persistent storage layer wired up yet — that's `packages/storage`'s job.
MiniMax's API is genuinely async (submit returns a `task_id`, a separate
endpoint reports progress), so its adapter has no local job store: the
provider's own `task_id` is the `jobId`, and `getStatus` re-queries MiniMax
each call, returning its real hosted `audio_url`.

## A note on the real HTTP shapes

Each real adapter calls what I believe is the current public API shape for
that provider based on available docs/knowledge, linked at the top of each
adapter file and in `MODEL_ROSTER[].docsUrl`. These are **best-effort and
unverified against live credentials** (none exist yet) — treat them as a
strong starting point, not a guarantee, and re-check against current
provider docs before the first real integration test. Lyria 2 in particular
assumes Vertex AI OAuth2 bearer-token auth is swapped in later (e.g. via
`google-auth-library`); `LYRIA2_API_KEY` is a placeholder for that token,
not a literal static API key like the others.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```
