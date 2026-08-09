import { randomUUID } from "node:crypto";
import type { GenerateOptions, GenerateResult, JobStatusResult, ModelAdapter, ModelId } from "./types.js";

const DEFAULT_DELAY_MS = 1500;

interface MockJob {
  readyAt: number;
}

/**
 * Fully in-memory `ModelAdapter`. Useful two ways:
 *  - directly, as `getModelAdapter("mock")`, for local dev with no keys at all
 *  - internally, as the fallback every real adapter delegates to when its
 *    API key is still the `.env.example` placeholder (see each adapter's
 *    `generate`/`getStatus`)
 */
export class MockModelAdapter implements ModelAdapter {
  readonly modelId: ModelId;
  readonly displayName: string;
  private readonly delayMs: number;
  private readonly jobs = new Map<string, MockJob>();

  constructor(modelId: ModelId = "mock", displayName = "Mock Model", delayMs = DEFAULT_DELAY_MS) {
    this.modelId = modelId;
    this.displayName = displayName;
    this.delayMs = delayMs;
  }

  async generate(_prompt: string, _options: GenerateOptions): Promise<GenerateResult> {
    const jobId = randomUUID();
    this.jobs.set(jobId, { readyAt: Date.now() + this.delayMs });
    return { jobId };
  }

  async getStatus(jobId: string): Promise<JobStatusResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { status: "failed", error: `Unknown job id: ${jobId}` };
    }
    if (Date.now() < job.readyAt) {
      return { status: "processing" };
    }
    return {
      status: "completed",
      audioUrl: `https://mock-audio.harmony.invalid/${this.modelId}/${jobId}.mp3`,
    };
  }
}
