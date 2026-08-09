import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { generationGenreEnum, generationScopeEnum } from "./enums";

// One row per step-1 submission (PRD.md "1. Generate"). Fans out into 4
// `tracks` rows (one per model) and, once battles start, a 3-round ladder
// of `battles` scoped to this request.
export const generationRequests = pgTable("generation_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  prompt: text("prompt").notNull(),
  scope: generationScopeEnum("scope").notNull(),
  genre: generationGenreEnum("genre").notNull(),
  // No auth system yet (PRD.md "Open / not yet decided" — account/identity).
  // Nullable free-text session identifier so anonymous taste-profile
  // aggregation (step 4) has something to group by until real auth lands.
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GenerationRequest = typeof generationRequests.$inferSelect;
export type NewGenerationRequest = typeof generationRequests.$inferInsert;
