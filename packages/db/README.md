# @harmony/db

Postgres schema, migrations, and seed data for Harmony. Self-contained package —
no dependency on repo-root workspace wiring (that lands in a separate
integration pass).

## Stack

[Drizzle ORM](https://orm.drizzle.team) + [`drizzle-kit`](https://orm.drizzle.team/kit-docs/overview)
for schema/migrations, [`postgres`](https://github.com/porsager/postgres) as
the driver. This matches the brief's recommendation (TypeScript-native, no
codegen step, migrations are plain reviewable SQL under `drizzle/`) — no
deviation taken.

## Setup

```bash
cd packages/db
npm install
cp .env.example .env   # then point DATABASE_URL at a real Postgres instance
```

Requires Postgres 13+ (uses the core `gen_random_uuid()` function; no
extensions need to be enabled).

## Scripts

- `npm run db:generate` — diff the schema in `src/schema/` against the last
  migration and write a new SQL file under `drizzle/`. Run this after
  changing any schema file.
- `npm run db:migrate` — apply pending migrations in `drizzle/` to
  `DATABASE_URL`.
- `npm run db:push` — push the schema straight to the DB without generating a
  migration file. Convenient for local iteration; don't use it against a
  shared/prod database.
- `npm run db:seed` — insert the placeholder model roster (see below).
  Idempotent — safe to re-run.
- `npm run db:studio` — open Drizzle Studio against `DATABASE_URL`.

Local loop from scratch:

```bash
npm run db:migrate
npm run db:seed
```

## Schema

Seven tables, mirroring the product flow in the repo-root `PRD.md`:

- **`models`** — the model roster. Seeded (`src/seed.ts`) with 4 placeholder
  rows — Stable Audio, Lyria 2, ElevenLabs, MiniMax — **pending final roster
  decisions** (PRD.md flags 6 ToS-clean candidates with the v1 set as "a
  subset of 4, actively refined"). Swap the seed list, not the schema, when
  the roster changes. `currentVersion` is informational only (see "Model
  versioning" below) — it is not the source of truth for what generated a
  given historical track.
- **`sessions`** — an anonymous browsing session, not a user account (PRD.md
  lists real account/identity as unresolved). Exists purely so requests can
  be grouped by "same person, same sitting" for the step-4 taste-profile bar
  and for later individual preference analysis. If real auth lands later,
  this table gains a nullable `userId` rather than being replaced.
- **`generation_requests`** — one row per step-1 submission (prompt + scope
  chip + genre chip). `sessionId` is a nullable FK into `sessions`.
  `generationParameters` is `jsonb` for request-level knobs beyond
  scope/genre (target duration, BPM/key hints, ...) — free-form because the
  knob set is expected to grow and isn't fixed enough to deserve columns yet.
- **`tracks`** — one row per model output per request. Carries generation
  `status`, the object-storage pointer (`audioObjectKey` — the storage
  package owns the bucket/client, this is just the key), and the blind
  `blindLabel` letter (A–D) shown to the listener before Reveal.
  `modelVersion` and `generationParameters` are a per-track *snapshot* of
  what actually produced this track (see "Model versioning" below). Unique
  on `(generationRequestId, modelId)` and `(generationRequestId, blindLabel)`.
- **`battles`** — one row per 1v1 battle. The validated v1 UX is a strict
  3-round ladder (round 1 is track 1 vs track 2; each subsequent round pits
  the winner against the next challenger — never a 4-way pick, per PRD.md).
  Stores the overall `result` (`left`/`tie`/`right`) plus a denormalized
  `winnerTrackId` FK so aggregation can join straight to `tracks` → `models`
  without re-deriving the winner. `(generationRequestId, round)` is indexed
  but **not unique** — see "Comparison strategy" below for why.
- **`battle_axis_votes`** — per-axis `left`/`tie`/`right` picks tied to a
  battle (vocals, bass/rhythm, production quality, etc). `axisKey` is
  **free text, not an enum** — the PRD is explicit that axes are computed
  per-request from the step-1 scope/genre choices (no "vocals" axis on an
  instrumental-only request; genre-specific axes like "synth_work" for
  Electronic), so the axis catalog belongs to application logic, not a DB
  constraint. Unique on `(battleId, axisKey)`.
- **`track_events`** — append-only behavioral log for a track (listens,
  regenerates, saves, downloads). Explicit votes live in `battles` /
  `battle_axis_votes`; this captures surrounding *implicit* signal (e.g.
  "listened to B for only 4s before moving on"), which is useful context for
  preference-data analysis even though nothing consumes it yet.
  `eventType` is free text for the same reason `axisKey` is — the event
  vocabulary is expected to grow from the frontend.

`pick` (`left`/`tie`/`right`) is shared by `battles.result` and
`battle_axis_votes.pick` — same judgment, different granularity.

### Model versioning

`models.currentVersion` says "what we currently point new generations at."
It is **not** the historical record — if a model gets upgraded, old tracks
must not silently get reinterpreted as having come from the new version.
The actual source of truth is `tracks.modelVersion` (and
`tracks.generationParameters` for the params actually used), captured as a
snapshot at generation time. Aggregation/analysis that cares about model
identity over time should read from `tracks`, never assume `models` reflects
history.

### Comparison strategy: ladder now, schema doesn't lock it in

The validated v1 UX is a strict 3-round ladder — that's a product decision
(PRD.md, informed by user testing), not something this package should
dictate. Earlier this schema enforced "exactly one battle per round" with a
unique constraint; that's been relaxed to a plain index. The ladder shape is
still what the app produces today, but the schema no longer prevents a
future adaptive/all-pairs comparison strategy (e.g. A-vs-B, A-vs-C, A-vs-D,
B-vs-C, ...) without a migration, since that would only require inserting
more `battles` rows, not a schema change.

### Blind-label randomization is an app-layer responsibility

`tracks.blindLabel` is just a column value set per request — nothing in the
schema ties letter "A" to a particular model across requests. Preventing
position/label bias (e.g. always giving Stable Audio the "A" slot) requires
the orchestration/generation code to assign letters randomly per request;
the DB only guarantees labels are unique *within* a request.

### Design decisions worth flagging

- **UUID primary keys** (`gen_random_uuid()`) everywhere, for
  merge-friendliness across the async generation/orchestration pipeline and
  so track/battle IDs are safe to hand to clients before a battle resolves.
- **`scope` and `genre` are Postgres enums**, not free text — PRD.md
  enumerates a fixed chip set for both (Full song/Just a beat/Vocal
  take/Instrumental only; Pop/Lo-fi/Cinematic/Electronic/Jazz). Extending
  either is a migration (`ALTER TYPE ... ADD VALUE`), which is the right
  friction for a UI-defined chip list.
- **`models` is a table, not an enum** — the roster is explicitly expected to
  change over time (ToS review, licensing), so it needs to be editable data,
  not a schema change.
- **Axis keys are free text** (see above) — the one deliberate spot where the
  schema is intentionally loose, because the PRD calls out that the axis set
  is contextual and computed by the app.
- **Bradley-Terry-readiness**: aggregate ranking needs, per battle, the two
  competing models and the outcome. That's a straight join —
  `battles → tracks (left/right) → models` plus `battles.winnerTrackId` (or
  `result` for ties) — with `battle_axis_votes` joined in the same way for
  per-axis Bradley-Terry variants. No pivoting or reshaping needed; this was
  the main constraint driving the `tracks` indirection (rather than putting
  `modelId` directly on `battles`) so a track's model identity is looked up
  once and reused for both the overall and per-axis aggregations.

## What's out of scope here

- The Bradley-Terry aggregation/ranking computation itself (PRD.md flags this
  as a later concern) — this package only shapes the tables so it's
  computable later.
- Real auth/user accounts — `sessions` is deliberately anonymous; PRD.md
  lists account/identity as unresolved.
- Object storage — `tracks.audioObjectKey` is just a pointer; the storage
  package owns actual upload/retrieval.
- **Splitting `models` into `models` + `model_deployments`** (e.g. same
  underlying model reachable via Replicate, Fal, or self-hosted) — a
  reasonable future direction, deliberately not done here because it
  overlaps with how `packages/orchestration` will actually call these APIs,
  which is being designed in parallel in a separate worktree. Adding a
  deployment-routing table here risked guessing wrong about that shape;
  better to add it once orchestration's needs are known. `models.provider`
  stays a simple label for now.
