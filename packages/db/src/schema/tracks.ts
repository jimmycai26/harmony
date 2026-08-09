import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { trackStatusEnum } from "./enums";
import { generationRequests } from "./generation-requests";
import { models } from "./models";

// One row per model output per generation request (PRD.md "2. Listen & Vote"
// loading/reveal phase). `blindLabel` is the letter shown to the listener
// (A/B/C/D) — model identity stays hidden behind it until step 4 (Reveal).
export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationRequestId: uuid("generation_request_id")
      .notNull()
      .references(() => generationRequests.id, { onDelete: "cascade" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => models.id, { onDelete: "restrict" }),
    blindLabel: text("blind_label").notNull(),
    status: trackStatusEnum("status").notNull().default("pending"),
    // Object storage key (e.g. R2/S3), populated once generation succeeds.
    // The storage package owns the bucket/client; this column is just the pointer.
    audioObjectKey: text("audio_object_key"),
    durationSeconds: integer("duration_seconds"),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
  },
  (table) => [
    // One track per model per request, and one letter per request —
    // both guard against the fan-out producing duplicates or label collisions.
    uniqueIndex("tracks_request_model_unique").on(table.generationRequestId, table.modelId),
    uniqueIndex("tracks_request_label_unique").on(table.generationRequestId, table.blindLabel),
  ],
);

export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
