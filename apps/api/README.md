# @harmony/api

Self-contained Fastify/TypeScript API for the Harmony arena flow described in
the repo-root `PRD.md`: generate 4 blind tracks, run a 3-round 1v1 battle
ladder, tease stems, then reveal the winning model.

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
   one `all-ready` event fires carrying the first battle, then the stream
   ends.
3. `POST /battles/:id/vote` — vote on the current battle (overall pick +
   per-axis picks). Response is either the next battle (rounds 1→2, 2→3) or a
   `ladder_complete` result with the winning track once round 3 is voted.
4. `GET /layers/:trackId` — stems/breakdown stub for a track (winner-focused
   per the PRD, but works for any known track id; real stem separation is out
   of scope here).
5. `GET /reveal/:id` — real model identity for the winning track, available
   once the ladder is complete.

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
the axis chips before the ladder even starts.

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
  "firstBattle": {
    "id": "…", "round": 1,
    "left": {"trackId":"…","letter":"A"}, "right": {"trackId":"…","letter":"B"},
    "axes": [{"key":"prompt_match","label":"Prompt match"}, …]
  }
}
```

Notes:

- A client that connects (or reconnects) mid-generation immediately gets a
  replay of every `track-ready` for tracks that are already done, so nothing
  is missed.
- The stream ends right after `all-ready` — there's nothing further to push
  over SSE; the battle ladder progresses via `POST /battles/:id/vote`
  responses instead (each vote response includes the next battle inline).
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

Response while the ladder continues:

```json
{
  "status": "battle_recorded",
  "completedBattle": { "id": "…", "round": 1, "left": {...}, "right": {...}, "axes": [...], "overall": "left", "axisPicks": {...}, "winnerTrackId": "…" },
  "nextBattle": { "id": "…", "round": 2, "left": {...}, "right": {...}, "axes": [...] }
}
```

Response on the round-3 vote:

```json
{
  "status": "ladder_complete",
  "completedBattle": { … },
  "winner": { "trackId": "…", "letter": "B" },
  "revealUrl": "/reveal/…"
}
```

Errors: `404` unknown battle id, `409` battle already voted on, `400` missing
or invalid axis picks (body includes `expectedAxes`).

**Ladder mechanics** (a design decision made for this package, not spelled
out in the PRD): round 1 is track A vs B; the winner faces C in round 2; that
winner faces D in round 3. A `tie` overall pick does **not** dethrone the
current champion — the left-hand track (the incumbent in every round after
round 1) keeps the win. This was the simplest deterministic rule that avoids
a 4th tie-break round; revisit if product wants ties to behave differently.

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
  "winningTrack": { "id": "…", "letter": "B" },
  "model": { "id": "lyria-2", "name": "Lyria 2" }
}
```

`404` unknown generation, `409` if the ladder hasn't finished yet.

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
and reused for all 3 battles in that generation's ladder.

## Mock data layer & integration follow-up

Routes never touch storage directly — they call a `GenerationStore`
interface (`src/store.ts`):

```ts
interface GenerationStore {
  createGeneration(input): Generation;
  getGeneration(id): Generation | undefined;
  subscribeToGenerationEvents(id, listener): (() => void) | undefined;
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
