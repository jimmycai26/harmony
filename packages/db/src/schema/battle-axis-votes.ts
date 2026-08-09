import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pickEnum } from "./enums";
import { battles } from "./battles";

// Per-axis Left/Tie/Right picks within a battle (PRD.md "2. Listen & Vote":
// "contextual axis tags... vocals, bass/rhythm, production quality...").
// Axis keys are intentionally free text, not an enum — the PRD is explicit
// that axes are derived at request time from the step-1 scope/genre choices
// (e.g. no "vocals" axis on an instrumental-only request, genre-specific
// axes like "synth_work" or "improvisation"), so the set is owned by
// application logic, not the DB schema. Expect keys such as: prompt_match,
// production_quality, vocals, bass_rhythm, melody, synth_work, improvisation.
export const battleAxisVotes = pgTable(
  "battle_axis_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    battleId: uuid("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    axisKey: text("axis_key").notNull(),
    pick: pickEnum("pick").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One pick per axis per battle.
    uniqueIndex("battle_axis_votes_battle_axis_unique").on(table.battleId, table.axisKey),
  ],
);

export type BattleAxisVote = typeof battleAxisVotes.$inferSelect;
export type NewBattleAxisVote = typeof battleAxisVotes.$inferInsert;
