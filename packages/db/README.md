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

Five tables, mirroring the product flow in the repo-root `PRD.md`:

- **`models`** — the model roster. Seeded (`src/seed.ts`) with 4 placeholder
  rows — Stable Audio, Lyria 2, ElevenLabs, MiniMax — **pending final roster
  decisions** (PRD.md flags 6 ToS-clean candidates with the v1 set as "a
  subset of 4, actively refined"). Swap the seed list, not the schema, when
  the roster changes.
- **`generation_requests`** — one row per step-1 submission (prompt + scope
  chip + genre chip). `sessionId` is a nullable free-text column standing in
  for a future auth system (PRD.md lists account/identity as still open) so
  anonymous taste-profile aggregation has something to group by.
- **`tracks`** — one row per model output per request. Carries generation
  `status`, the object-storage pointer (`audioObjectKey` — the storage
  package owns the bucket/client, this is just the key), and the blind
  `blindLabel` letter (A–D) shown to the listener before Reveal. Unique on
  `(generationRequestId, modelId)` and `(generationRequestId, blindLabel)`.
- **`battles`** — one row per 1v1 battle in the 3-round ladder (round 1 is
  track 1 vs track 2; each subsequent round pits the winner against the next
  challenger — never a 4-way pick, per PRD.md). Stores the overall
  `result` (`left`/`tie`/`right`) plus a denormalized `winnerTrackId` FK so
  aggregation can join straight to `tracks` → `models` without re-deriving
  the winner. Unique on `(generationRequestId, round)`.
- **`battle_axis_votes`** — per-axis `left`/`tie`/`right` picks tied to a
  battle (vocals, bass/rhythm, production quality, etc). `axisKey` is
  **free text, not an enum** — the PRD is explicit that axes are computed
  per-request from the step-1 scope/genre choices (no "vocals" axis on an
  instrumental-only request; genre-specific axes like "synth_work" for
  Electronic), so the axis catalog belongs to application logic, not a DB
  constraint. Unique on `(battleId, axisKey)`.

`pick` (`left`/`tie`/`right`) is shared by `battles.result` and
`battle_axis_votes.pick` — same judgment, different granularity.

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
- Auth/session system — `generationRequests.sessionId` is a placeholder
  column, not a real session table.
- Object storage — `tracks.audioObjectKey` is just a pointer; the storage
  package owns actual upload/retrieval.
