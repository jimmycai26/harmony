import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generationGenreEnum, generationScopeEnum } from "./enums";
import { sessions } from "./sessions";

// One row per step-1 submission (PRD.md "1. Generate"). Fans out into 4
// `tracks` rows (one per model) and, once battles start, a 3-round ladder
// of `battles` scoped to this request.
export const generationRequests = pgTable("generation_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  prompt: text("prompt").notNull(),
  scope: generationScopeEnum("scope").notNull(),
  genre: generationGenreEnum("genre").notNull(),
  // Requested generation options beyond scope/genre (e.g. target duration,
  // BPM/key hints), as free-form JSON rather than fixed columns — the exact
  // knob set is expected to grow and vary, and every model that receives
  // the request may honor a different subset (see tracks.generationParameters
  // for what a given model actually used).
  generationParameters: jsonb("generation_parameters"),
  // No auth system yet (PRD.md "Open / not yet decided" — account/identity).
  // FK to the anonymous `sessions` table so requests can be grouped by
  // "same person, same sitting" for the step-4 taste-profile bar.
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GenerationRequest = typeof generationRequests.$inferSelect;
export type NewGenerationRequest = typeof generationRequests.$inferInsert;
