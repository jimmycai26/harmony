import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";
import { tracks } from "./tracks";

// Append-only behavioral log for a track — listens, regenerates, saves,
// downloads. Explicit votes live in `battles`/`battle_axis_votes`; this
// captures the surrounding *implicit* signal (e.g. "listened to B for only
// 4s before moving on" alongside a left/tie/right pick), which is useful
// context for preference-data analysis even though nothing consumes it yet.
// `eventType` is free text (not an enum) for the same reason axis keys are:
// the event vocabulary is expected to grow from the frontend, and each type
// carries different metadata, so it belongs to app logic, not a DB constraint.
export const trackEvents = pgTable(
  "track_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    // e.g. { "listenedSeconds": 4.2 } for a listen event, {} for a save/regenerate.
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("track_events_track_idx").on(table.trackId),
    index("track_events_session_idx").on(table.sessionId),
  ],
);

export type TrackEvent = typeof trackEvents.$inferSelect;
export type NewTrackEvent = typeof trackEvents.$inferInsert;
