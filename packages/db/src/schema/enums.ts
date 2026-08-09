import { pgEnum } from "drizzle-orm/pg-core";

// Step-1 scope chips (PRD.md, "1. Generate"). Extending this list is a migration,
// not an app-config change — keep it in sync with the product's chip copy.
export const generationScopeEnum = pgEnum("generation_scope", [
  "full_song",
  "just_a_beat",
  "vocal_take",
  "instrumental_only",
]);

// Step-1 genre chips (PRD.md, "1. Generate").
export const generationGenreEnum = pgEnum("generation_genre", [
  "pop",
  "lofi",
  "cinematic",
  "electronic",
  "jazz",
]);

export const trackStatusEnum = pgEnum("track_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

// Shared by battles.result and battle_axis_votes.pick — both are the same
// left/tie/right judgment, just at different granularity (whole battle vs. one axis).
export const pickEnum = pgEnum("pick", ["left", "tie", "right"]);
