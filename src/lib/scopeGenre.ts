import type { Genre, Scope } from "@/lib/api/types";

export const SCOPES: { label: string; value: Scope }[] = [
  { label: "Full song", value: "full_song" },
  { label: "Just a beat", value: "just_a_beat" },
  { label: "Vocal take", value: "vocal_take" },
  { label: "Instrumental only", value: "instrumental_only" },
];

export const GENRES: { label: string; value: Genre }[] = [
  { label: "Pop", value: "pop" },
  { label: "Lo-fi", value: "lofi" },
  { label: "Cinematic", value: "cinematic" },
  { label: "Electronic", value: "electronic" },
  { label: "Jazz", value: "jazz" },
];

export function scopeLabel(scope: Scope): string {
  return SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

export function genreLabel(genre: Genre): string {
  return GENRES.find((g) => g.value === genre)?.label ?? genre;
}
