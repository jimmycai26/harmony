import { randomUUID } from "node:crypto";
import { isPlaceholder, readEnv } from "../env.js";
import { getJob, putJob } from "../jobs.js";
import { MockModelAdapter } from "../mock.js";
import type { GenerateOptions, GenerateResult, JobStatusResult, ModelAdapter } from "../types.js";
import { buildPrompt, safeText, scopeToDurationSeconds, toDataUrl } from "./shared.js";

/**
 * Stability AI's Stable Audio 2.0 text-to-audio endpoint. Modeled on
 * https://platform.stability.ai/docs/api-reference#tag/Audio/paths/~1v2beta~1audio~1stable-audio-2~1text-to-audio/post
 * as of this package's last update — verify against current docs before
 * pointing this at a real key, API shapes drift.
 *
 * The endpoint is synchronous (audio bytes come back in the same response),
 * so `generate` does the whole call up front and stashes the result under a
 * generated job id; `getStatus` just replays it. See `src/jobs.ts`.
 */
const API_URL = "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio";

export class StableAudioAdapter implements ModelAdapter {
  readonly modelId = "stable-audio" as const;
  readonly displayName = "Stable Audio";
  private readonly mock = new MockModelAdapter(this.modelId, this.displayName);

  async generate(prompt: string, options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = readEnv("STABLE_AUDIO_API_KEY");
    if (isPlaceholder(apiKey)) {
      return this.mock.generate(prompt, options);
    }

    const form = new FormData();
    form.set("prompt", buildPrompt(prompt, options));
    form.set("output_format", "mp3");
    form.set("duration", String(scopeToDurationSeconds(options.scope)));

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "audio/*",
      },
      body: form,
    });

    const jobId = randomUUID();
    if (!response.ok) {
      putJob(jobId, {
        status: "failed",
        error: `Stable Audio API error ${response.status}: ${await safeText(response)}`,
      });
      return { jobId };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    putJob(jobId, { status: "completed", audioUrl: toDataUrl(buffer, "audio/mpeg") });
    return { jobId };
  }

  async getStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = readEnv("STABLE_AUDIO_API_KEY");
    if (isPlaceholder(apiKey)) {
      return this.mock.getStatus(jobId);
    }
    return getJob(jobId) ?? { status: "failed", error: `Unknown job id: ${jobId}` };
  }
}
