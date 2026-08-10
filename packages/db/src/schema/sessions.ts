import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

// Anonymous browsing session, not a user account — PRD.md lists real
// account/identity as unresolved ("Open / not yet decided"). This exists so
// generation_requests can be grouped by "same person across a sitting"
// (needed for the step-4 taste-profile bar, and for individual preference
// analysis later) without presuming how/if auth eventually gets bolted on.
// When real auth lands, this table can grow a nullable `userId` column
// rather than being replaced.
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
