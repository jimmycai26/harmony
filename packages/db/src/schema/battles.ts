import { integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pickEnum } from "./enums";
import { generationRequests } from "./generation-requests";
import { tracks } from "./tracks";

// One row per 1v1 battle in the 3-round ladder (PRD.md "2. Listen & Vote"
// battle phase): round 1 is track1 vs track2, and each subsequent round
// pits the winner against the next challenger. `result` is the overall
// left/tie/right pick for the round; `winnerTrackId` denormalizes that into
// a direct FK so downstream Bradley-Terry aggregation can join straight to
// tracks/models without re-deriving the winner from left/right + result.
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
  (table) => [
    // One battle per round per request — the ladder shape (PRD.md: 3 rounds,
    // never a 4-way pick) is enforced here rather than left to app logic.
    uniqueIndex("battles_request_round_unique").on(table.generationRequestId, table.round),
  ],
);

export type Battle = typeof battles.$inferSelect;
export type NewBattle = typeof battles.$inferInsert;
