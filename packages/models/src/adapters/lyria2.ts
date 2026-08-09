import { randomUUID } from "node:crypto";
import { isPlaceholder, readEnv } from "../env.js";
import { getJob, putJob } from "../jobs.js";
import { MockModelAdapter } from "../mock.js";
import type { GenerateOptions, GenerateResult, JobStatusResult, ModelAdapter } from "../types.js";
import { buildPrompt, safeText, toDataUrl } from "./shared.js";

/**
 * Google's Lyria 2, served through Vertex AI's `:predict` endpoint. Modeled on
 * https://cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music
 * as of this package's last update — verify against current docs before
 * pointing this at a real key.
 *
 * Real Vertex AI auth is a short-lived OAuth2 bearer token from a service
 * account (e.g. via `google-auth-library`), not a static API key. That
 * wiring doesn't exist yet — `LYRIA2_API_KEY` is a placeholder for it and
 * this adapter sends it as a bearer token, which will need to be swapped
 * for real token minting once credentials exist.
 *
 * The endpoint is synchronous (audio bytes come back in the same response),
 * so `generate` does the whole call up front and stashes the result under a
 * generated job id; `getStatus` just replays it. See `src/jobs.ts`.
 */
function buildApiUrl(): string {
  const region = readEnv("LYRIA2_LOCATION") ?? "us-central1";
  const projectId = readEnv("LYRIA2_PROJECT_ID");
  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/lyria-002:predict`;
}

interface LyriaPrediction {
  bytesBase64Encoded?: string;
  mimeType?: string;
}

interface LyriaResponse {
  predictions?: LyriaPrediction[];
}

export class Lyria2Adapter implements ModelAdapter {
  readonly modelId = "lyria-2" as const;
  readonly displayName = "Lyria 2";
  private readonly mock = new MockModelAdapter(this.modelId, this.displayName);

  async generate(prompt: string, options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = readEnv("LYRIA2_API_KEY");
    const projectId = readEnv("LYRIA2_PROJECT_ID");
    if (isPlaceholder(apiKey) || isPlaceholder(projectId)) {
      return this.mock.generate(prompt, options);
    }

    const response = await fetch(buildApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt: buildPrompt(prompt, options) }],
        parameters: { sampleCount: 1 },
      }),
    });

    const jobId = randomUUID();
    if (!response.ok) {
      putJob(jobId, {
        status: "failed",
        error: `Lyria 2 API error ${response.status}: ${await safeText(response)}`,
      });
      return { jobId };
    }

    const body = (await response.json()) as LyriaResponse;
    const prediction = body.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      putJob(jobId, { status: "failed", error: "Lyria 2 response had no audio prediction" });
      return { jobId };
    }

    const buffer = Buffer.from(prediction.bytesBase64Encoded, "base64");
    putJob(jobId, { status: "completed", audioUrl: toDataUrl(buffer, prediction.mimeType ?? "audio/wav") });
    return { jobId };
  }

  async getStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = readEnv("LYRIA2_API_KEY");
    const projectId = readEnv("LYRIA2_PROJECT_ID");
    if (isPlaceholder(apiKey) || isPlaceholder(projectId)) {
      return this.mock.getStatus(jobId);
    }
    return getJob(jobId) ?? { status: "failed", error: `Unknown job id: ${jobId}` };
  }
}
