/**
 * Waveform peak data, shaped for wavesurfer.js's PeaksPlugin
 * (https://wavesurfer.xyz/docs/types/plugins_regions.RegionParams — peaks
 * consumption specifically via WaveSurfer.create({ peaks, duration })).
 *
 * Generating this server-side (once, at upload time) means the comparison
 * view can render all 4 waveforms immediately from a few-KB JSON file
 * instead of each client decoding 4 full audio files simultaneously.
 */
export interface PeaksData {
  /** Schema version, so future re-generation can detect stale files. */
  version: 1;
  /** Track duration in seconds, as reported by the decoder. */
  duration: number;
  /** Number of channels the peaks were extracted from. */
  channels: number;
  /** Per-channel min/max peak pairs, one array of [min, max, min, max...] per channel. */
  peaks: number[][];
}

/**
 * Derives the peaks JSON object key from the audio object key, e.g.
 * "tracks/abc123.mp3" -> "tracks/abc123.peaks.json". Keeping the peaks file
 * alongside the audio (same prefix) makes it easy to locate and to delete
 * both together.
 */
export function peaksKeyFor(audioKey: string): string {
  return `${audioKey}.peaks.json`;
}

/**
 * Extracts waveform peak data from an audio buffer.
 *
 * STUB — not yet implemented. Options evaluated:
 *  - `audiowaveform` (BBC, native binary via CLI/child_process): fast, battle
 *    tested, outputs JSON directly in this shape, but requires shelling out
 *    to a compiled binary rather than a pure-JS/npm dependency, which
 *    complicates deployment on serverless targets.
 *  - `audio-decode` + manual min/max binning (pure JS, npm-installable):
 *    the more portable option and the one to reach for first — decode with
 *    `audio-decode`, then downsample to ~800 points/channel by taking
 *    min/max per bucket.
 * Deferred until the orchestration package's generation pipeline lands,
 * since that's where the raw decoded audio buffer will actually be
 * available before upload.
 */
export async function generatePeaks(_audioBuffer: Buffer | ArrayBuffer): Promise<PeaksData> {
  throw new Error(
    "generatePeaks() is not yet implemented — see the TODO comment in packages/storage/src/peaks.ts",
  );
}
