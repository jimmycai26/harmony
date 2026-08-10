import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { pickEnum } from "./enums";
import { generationRequests } from "./generation-requests";
import { tracks } from "./tracks";

// One row per 1v1 battle. The validated v1 UX (PRD.md "2. Listen & Vote") is
// a strict 3-round ladder: round 1 is track1 vs track2, and each subsequent
// round pits the winner against the next challenger. `result` is the overall
// left/tie/right pick for the round; `winnerTrackId` denormalizes that into
// a direct FK so downstream Bradley-Terry aggregation can join straight to
// tracks/models without re-deriving the winner from left/right + result.
//
// `round` is deliberately NOT unique per generationRequestId: that would
// hard-code "exactly one battle per round" into the DB, which only holds
// for the current strict-ladder UX. Comparison strategy (ladder vs. e.g. an
// adaptive all-pairs design) is a product decision owned by PRD.md, not
// something this schema should lock in — app logic enforces the ladder
// shape for now, and a future comparison strategy stays representable
// without a migration.
export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationRequestId: uuid("generation_request_id")
      .notNull()
      .references(() => generationRequests.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    leftTrackId: uuid("left_track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    rightTrackId: uuid("right_track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    // Null until the listener casts the overall vote for this round.
    result: pickEnum("result"),
    winnerTrackId: uuid("winner_track_id").references(() => tracks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    votedAt: timestamp("voted_at", { withTimezone: true }),
  },
  (table) => [index("battles_request_round_idx").on(table.generationRequestId, table.round)],
);

export type Battle = typeof battles.$inferSelect;
export type NewBattle = typeof battles.$inferInsert;
