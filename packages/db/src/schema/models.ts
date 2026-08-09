import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// The AI music-generation models available to battle. Roster is expected to
// change (PRD.md "Open / not yet decided" — onboarding new models over time),
// so this is a normal table, not an enum — see seed.ts for the current
// placeholder 4-model roster.
export const models = pgTable("models", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  provider: text("provider").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
