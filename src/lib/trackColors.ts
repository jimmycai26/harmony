import type { TrackLetter } from "@/lib/api/types";

export const TRACK_COLORS: Record<TrackLetter, string> = {
  A: "var(--track-a)",
  B: "var(--track-b)",
  C: "var(--track-c)",
  D: "var(--track-d)",
};

export const TRACK_HEX: Record<TrackLetter, string> = {
  A: "#FF5A1F",
  B: "#3FE0C5",
  C: "#FF3D8B",
  D: "#C8F135",
};
