# @harmony/api

Self-contained Fastify/TypeScript API for the Harmony arena flow described in
the repo-root `PRD.md`: generate 4 blind tracks, run a 4-battle 1v1 bracket
that ranks all 4, tease stems, then reveal the models.

> **Note on the bracket shape**: `PRD.md` describes "3 rounds of 1v1
> battles" (a linear ladder: winner keeps facing the next challenger). This
> package instead implements a 4-battle single-elimination bracket with a
> consolation match — two semifinals in parallel (A vs B, C vs D), then the
> two winners meet in a final and the two losers meet in a consolation match,
> both in parallel. This was an explicit, later product decision (not in the
> PRD) because it produces a full 1st–4th ranking instead of just a winner,
> at the cost of one extra battle (4 instead of 3). See
> [The bracket](#the-bracket) below.

This package is standalone on purpose — `packages/db`, `packages/models`,
`packages/orchestration`, and `packages/storage` are being built in parallel
by other crewmates and are **not** imported here. Everything runs against an
in-memory mock data layer (see [Mock data layer](#mock-data-layer--integration-follow-up)
below). It has its own `package.json`/`tsconfig.json` and does not touch the
repo-root workspace config — that wiring is a separate integration pass.

## Running it

```bash
npm install
npm run dev        # tsx watch, http://localhost:3000
npm test           # vitest smoke tests
npm run typecheck
npm run build && npm start   # compiled dist/ build
```

`PORT` and `HOST` env vars override the listen address (defaults `3000` /
`0.0.0.0`).

## The flow, end to end

1. `POST /generate` — kick off a generation, get back 4 track ids (letters
   `A`–`D`, no model names) and the SSE URL.
2. `GET /generate/:id/events` — subscribe to progressive reveal. Each of the
   4 tracks fires a `track-ready` event as it finishes; once all 4 are ready,
   one `all-ready` event fires carrying both open semifinal battles, then the
   stream ends.
3. `POST /battles/:id/vote` — vote on any currently-open battle (overall pick
   + per-axis picks). The response tells you what just unlocked: nothing yet
   (waiting on the sibling semifinal), the final + consolation match (once
   both semifinals are done), or `bracket_complete` with the full 1st–4th
   placement (once both the final and consolation are done).
4. `GET /layers/:trackId` — stems/breakdown stub for a track (winner-focused
   per the PRD, but works for any known track id; real stem separation is out
   of scope here).
5. `GET /reveal/:id` — real model identities for all 4 tracks, ranked
   1st–4th, available once the bracket is complete.

Blindness is enforced server-side: `Track.model` (the real model identity)
is never serialized by `/generate` or the SSE stream or battle responses —
only `/reveal` exposes it, and only after `generation.status === 'complete'`.

## Routes

### `POST /generate`

Body:

```json
{ "prompt": "a dreamy synthwave night drive", "scope": "full_song", "genre": "electronic" }
```

`scope`: `full_song` | `beat` | `vocal` | `instrumental`
`genre`: `pop` | `lofi` | `cinematic` | `electronic` | `jazz`

`201`:

```json
{
  "generationId": "…",
  "status": "generating",
  "tracks": [{ "id": "…", "letter": "A", "status": "generating" }, …],
  "axes": [{ "key": "prompt_match", "label": "Prompt match" }, …],
  "eventsUrl": "/generate/…/events"
}
```

`axes` is the contextual axis list for this generation's battles, computed
once at generate time (see [Axis logic](#axis-logic)) — the client can render
the axis chips before the bracket even starts.

`400` on invalid `prompt`/`scope`/`genre` (zod-validated).

### `GET /generate/:id/events` (SSE)

`Content-Type: text/event-stream`. Event shapes:

```
event: track-ready
data: {"trackId":"…","letter":"B","index":1}

event: all-ready
data: {
  "generationId": "…",
  "tracks": [{"id":"…","letter":"A"}, …],
  "openBattles": [
    { "id":"…", "stage":"semifinal", "slot":1, "left":{"trackId":"…","letter":"A"}, "right":{"trackId":"…","letter":"B"}, "axes":[...] },
    { "id":"…", "stage":"semifinal", "slot":2, "left":{"trackId":"…","letter":"C"}, "right":{"trackId":"…","letter":"D"}, "axes":[...] }
  ]
}
```

Notes:

- A client that connects (or reconnects) mid-generation immediately gets a
  replay of every `track-ready` for tracks that are already done, so nothing
  is missed.
- If a client connects (or reconnects) *after* generation finished — even
  partway through the bracket — `openBattles` reflects whatever's currently
  votable at that moment (the two semifinals, or later the final +
  consolation), not necessarily the original semifinals.
- The stream ends right after `all-ready` — there's nothing further to push
  over SSE; the bracket progresses via `POST /battles/:id/vote` responses
  instead (each vote response includes whatever it just unlocked inline).
- A `: heartbeat\n\n` comment ping is sent every 15s while waiting, to keep
  the connection alive through proxies with idle timeouts.
- `404` if the generation id doesn't exist.

### `POST /battles/:id/vote`

Body:

```json
{
  "overall": "left",
  "axes": { "prompt_match": "left", "production_quality": "tie", "vocals": "right", "melody": "left" }
}
```

`overall`/axis values are `left` | `tie` | `right`. `axes` must include a
pick for every axis key the generation's `axes` list declared (extra keys
are ignored).

Response after a semifinal vote, if the sibling semifinal hasn't been voted
on yet (nothing new to do until it is):

```json
{
  "status": "battle_recorded",
  "completedBattle": { "id": "…", "stage": "semifinal", "slot": 1, "left": {...}, "right": {...}, "axes": [...], "overall": "left", "axisPicks": {...}, "winnerTrackId": "…", "loserTrackId": "…" },
  "unlockedBattles": []
}
```

Response on whichever semifinal vote is the *second* one to land — both the
final and the consolation match unlock together:

```json
{
  "status": "battle_recorded",
  "completedBattle": { … },
  "unlockedBattles": [
    { "id": "…", "stage": "final", "left": {...}, "right": {...}, "axes": [...] },
    { "id": "…", "stage": "consolation", "left": {...}, "right": {...}, "axes": [...] }
  ]
}
```

Response on whichever of the final/consolation vote is the *second* one to
land — the bracket is complete:

```json
{
  "status": "bracket_complete",
  "completedBattle": { … },
  "placement": {
    "first":  { "track": { "id": "…", "letter": "A" }, "model": { "id": "elevenlabs-music", "name": "ElevenLabs Music" } },
    "second": { "track": { "id": "…", "letter": "D" }, "model": { … } },
    "third":  { "track": { "id": "…", "letter": "C" }, "model": { … } },
    "fourth": { "track": { "id": "…", "letter": "B" }, "model": { … } }
  },
  "revealUrl": "/reveal/…"
}
```

Errors: `404` unknown battle id, `409` battle already voted on, `400` missing
or invalid axis picks (body includes `expectedAxes`).

### The bracket

Design decisions made for this package (not spelled out in the PRD):

- **Seeding is random.** Which model ends up in slot A/B/C/D — and
  therefore who faces whom in the semifinals — is randomized on every
  generation (`InMemoryGenerationStore.createGeneration`, see
  [Mock data layer](#mock-data-layer--integration-follow-up)).
- **Shape**: semifinal 1 is A vs B, semifinal 2 is C vs D, run in parallel
  (both open as soon as generation finishes). Once *both* semifinals are
  voted (in either order), the final (semifinal-1 winner vs semifinal-2
  winner) and the consolation match (semifinal-1 loser vs semifinal-2 loser)
  open together. Once *both* of those are voted (in either order), the
  bracket is done: final winner = 1st, final loser = 2nd, consolation
  winner = 3rd, consolation loser = 4th.
- **Ties don't dethrone the left-hand track.** In every battle, a `tie`
  overall pick resolves the same way a `left` pick would — the left-hand
  track is treated as the winner. This is the simplest deterministic rule
  that avoids needing a 5th tie-break battle; revisit if product wants ties
  to behave differently (e.g. a coin-flip, or literally blocking bracket
  progress until the user breaks the tie).

### `GET /layers/:trackId`

```json
{
  "trackId": "…",
  "stems": [
    { "type": "vocals", "label": "Vocals", "url": "https://mock-audio.harmony.local/…/stems/vocals.mp3" },
    { "type": "drums", "label": "Drums", "url": "…" },
    { "type": "bass", "label": "Bass", "url": "…" },
    { "type": "other", "label": "Other / harmonic bed", "url": "…" }
  ]
}
```

Stub only — real stem separation is explicitly out of scope for this
package. `404` for an unknown track id.

### `GET /reveal/:id`

`id` is the **generation** id.

```json
{
  "generationId": "…",
  "placement": {
    "first":  { "track": { "id": "…", "letter": "A" }, "model": { "id": "elevenlabs-music", "name": "ElevenLabs Music" } },
    "second": { "track": { "id": "…", "letter": "D" }, "model": { … } },
    "third":  { "track": { "id": "…", "letter": "C" }, "model": { … } },
    "fourth": { "track": { "id": "…", "letter": "B" }, "model": { … } }
  }
}
```

Same shape as the `placement` field returned inline by the bracket-completing
`/battles/:id/vote` call — this route exists so a client can fetch it again
later (e.g. after a page refresh) without having voted just now.

`404` unknown generation, `409` if the bracket hasn't finished yet.

## Axis logic

From `PRD.md` step 2 ("Each battle shows contextual axis tags..."),
implemented in `src/axes.ts`:

- `prompt_match`, `production_quality` — always present.
- `vocals` — present unless `scope === "instrumental"`.
- `bass_rhythm` (if `scope === "beat"`) **or** `melody` (otherwise) — exactly
  one of the two, always present.
- `synth_work` — added for `genre === "electronic"`.
- `improvisation` — added for `genre === "jazz"`.

Axes are computed once at `POST /generate` time from the chosen scope/genre
and reused for all 4 battles in that generation's bracket.

## Mock data layer & integration follow-up

Routes never touch storage directly — they call a `GenerationStore`
interface (`src/store.ts`):

```ts
interface GenerationStore {
  createGeneration(input): Generation;
  getGeneration(id): Generation | undefined;
  subscribeToGenerationEvents(id, listener): (() => void) | undefined;
  getOpenBattles(generationId): PublicBattle[] | undefined;
  recordVote(battleId, input): RecordVoteResult;
  getLayers(trackId): LayersResult | undefined;
  getReveal(generationId): RevealResult;
}
```

`InMemoryGenerationStore` is the only implementation today:

- Generations, tracks, and battles live in `Map`s in process memory — no
  persistence, nothing survives a restart.
- "Generation" is simulated: each track flips from `generating` to `ready`
  after a random delay (default 1.5–4s, configurable via
  `trackDelayMs` in the constructor) via `setTimeout`, standing in for the
  real orchestration fan-out.
- The 4 models per generation are picked randomly from a 6-model roster
  named in `PRD.md`'s technical-considerations section (Stable Audio 2.5,
  Lyria 2, ElevenLabs Music, MiniMax Music-01, ACE-Step, YuE) — see
  `src/mockModels.ts`. No real audio is generated; `audioUrl`/stem URLs are
  placeholder strings shaped like what real storage URLs will look like.
- Per-generation events are fanned out with a plain `node:events`
  `EventEmitter`, one per generation.

**Swapping this out is the integration-pass follow-up** once
`packages/orchestration` (real fan-out + progress events) and
`packages/db`/`packages/storage` (real persistence + audio storage) land:
write a new `GenerationStore` implementation backed by those packages, wire
it into `buildApp({ store })` in `src/app.ts`, and the route layer
(`src/routes/*.ts`) shouldn't need to change at all — that's the point of the
interface boundary.

## Project layout

```
src/
  types.ts       domain types (Generation, Track, Battle, …)
  axes.ts        contextual axis computation + labels
  mockModels.ts  mock model roster
  schemas.ts     zod request validation
  store.ts       GenerationStore interface + InMemoryGenerationStore
  routes/        one file per route group
  app.ts         buildApp({ store?, logger? }) — used by both index.ts and tests
  index.ts       process entrypoint (buildApp + listen)
test/
  api.test.ts    vitest smoke tests: full flow + validation + error paths
```

`buildApp` takes an optional `store` so tests (and the future real-store
swap) can inject a different `GenerationStore` without touching route code.
