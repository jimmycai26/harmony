import { NextRequest } from "next/server";

// Generates a short, quiet, deterministic sine-tone WAV on the fly so the
// mock backend has something real for wavesurfer.js to fetch and decode —
// no binary assets checked into the repo. Swapped for real render output
// once harmony-backend is reachable.

function hashToFreq(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 180 + (h % 240); // 180-420Hz, kept distinct per stem/track id
}

function buildWav(id: string, durationSec: number): Buffer {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.round(sampleRate * durationSec));
  const freq = hashToFreq(id);
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + numSamples);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + numSamples, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28); // byte rate (1 byte/sample * 1 channel)
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(numSamples, 40);

  const amp = 14; // quiet — confirms real playback without being obnoxious
  const fadeSamples = sampleRate * 0.05;
  for (let i = 0; i < numSamples; i++) {
    const envelope = Math.min(1, i / fadeSamples, (numSamples - i) / fadeSamples);
    const sample = 128 + Math.round(amp * envelope * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    buf[headerSize + i] = sample;
  }
  return buf;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "track";
  const duration = Math.min(90, Math.max(5, Number(searchParams.get("duration")) || 40));
  const wav = buildWav(id, duration);
  return new Response(new Uint8Array(wav), {
    headers: {
      "content-type": "audio/wav",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
