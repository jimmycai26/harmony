import { randomUUID } from "node:crypto";
import { isPlaceholder, readEnv } from "../env.js";
import { getJob, putJob } from "../jobs.js";
import { MockModelAdapter } from "../mock.js";
import type { GenerateOptions, GenerateResult, JobStatusResult, ModelAdapter } from "../types.js";
import { buildPrompt, safeText, scopeToDurationSeconds, toDataUrl } from "./shared.js";

/**
 * ElevenLabs Music. Modeled on https://elevenlabs.io/docs/api-reference/music
 * as of this package's last update — verify against current docs before
 * pointing this at a real key.
 *
 * The endpoint is synchronous (audio bytes stream back in the same
 * response), so `generate` does the whole call up front and stashes the
 * result under a generated job id; `getStatus` just replays it. See
 * `src/jobs.ts`.
 */
const API_URL = "https://api.elevenlabs.io/v1/music";

export class ElevenLabsAdapter implements ModelAdapter {
  readonly modelId = "elevenlabs" as const;
  readonly displayName = "ElevenLabs";
  private readonly mock = new MockModelAdapter(this.modelId, this.displayName);

  async generate(prompt: string, options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = readEnv("ELEVENLABS_API_KEY");
    if (isPlaceholder(apiKey)) {
      return this.mock.generate(prompt, options);
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        prompt: buildPrompt(prompt, options),
        music_length_ms: scopeToDurationSeconds(options.scope) * 1000,
      }),
    });

    const jobId = randomUUID();
    if (!response.ok) {
      putJob(jobId, {
        status: "failed",
        error: `ElevenLabs API error ${response.status}: ${await safeText(response)}`,
      });
      return { jobId };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    putJob(jobId, { status: "completed", audioUrl: toDataUrl(buffer, "audio/mpeg") });
    return { jobId };
  }

  async getStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = readEnv("ELEVENLABS_API_KEY");
    if (isPlaceholder(apiKey)) {
      return this.mock.getStatus(jobId);
    }
    return getJob(jobId) ?? { status: "failed", error: `Unknown job id: ${jobId}` };
  }
}
