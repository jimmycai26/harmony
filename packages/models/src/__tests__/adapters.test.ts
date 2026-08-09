import { describe, expect, it } from "vitest";
import { ElevenLabsAdapter } from "../adapters/elevenLabs.js";
import { Lyria2Adapter } from "../adapters/lyria2.js";
import { MiniMaxAdapter } from "../adapters/minimax.js";
import { StableAudioAdapter } from "../adapters/stableAudio.js";
import type { ModelAdapter } from "../types.js";

// None of these env vars are set in the test process, so every adapter
// below should fall back to its internal MockModelAdapter rather than
// attempting a real network call — that's the whole point of the
// placeholder-key convention (see README.md).
const adapters: ModelAdapter[] = [
  new StableAudioAdapter(),
  new Lyria2Adapter(),
  new ElevenLabsAdapter(),
  new MiniMaxAdapter(),
];

describe.each(adapters.map((a) => [a.modelId, a] as const))("%s (no API key configured)", (_id, adapter) => {
  it("falls back to a mock job that eventually completes with an audio url", async () => {
    const { jobId } = await adapter.generate("an upbeat pop anthem", { scope: "full-song", genre: "pop" });
    expect(jobId).toBeTruthy();

    const status = await pollUntilTerminal(adapter, jobId);
    expect(status.status).toBe("completed");
    expect(status.audioUrl).toBeTruthy();
  });
});

async function pollUntilTerminal(adapter: ModelAdapter, jobId: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const status = await adapter.getStatus(jobId);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Job ${jobId} never reached a terminal state`);
}
