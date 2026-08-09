import { isPlaceholder, readEnv } from "../env.js";
import { MockModelAdapter } from "../mock.js";
import type { GenerateOptions, GenerateResult, JobStatus, JobStatusResult, ModelAdapter } from "../types.js";
import { buildPrompt, safeText } from "./shared.js";

/**
 * MiniMax's music generation API. Modeled on
 * https://www.minimax.io/platform/document/T2A%20V2 (music generation +
 * task-query endpoints) as of this package's last update — verify against
 * current docs before pointing this at a real key.
 *
 * Unlike the other three providers, MiniMax's API is genuinely async: submit
 * returns a `task_id` and a separate query endpoint reports progress. So,
 * unlike the other adapters, this one needs no local job store — the
 * provider's own `task_id` *is* our `jobId`, and `getStatus` just re-queries
 * MiniMax each time.
 */
const SUBMIT_URL = "https://api.minimax.chat/v1/music_generation";
const QUERY_URL = "https://api.minimax.chat/v1/query/music_generation";

interface MiniMaxSubmitResponse {
  task_id?: string;
  base_resp?: { status_code: number; status_msg: string };
}

interface MiniMaxQueryResponse {
  status?: "Submitted" | "Processing" | "Success" | "Failed";
  audio_url?: string;
  base_resp?: { status_code: number; status_msg: string };
}

function mapStatus(status: MiniMaxQueryResponse["status"]): JobStatus {
  switch (status) {
    case "Submitted":
      return "queued";
    case "Processing":
      return "processing";
    case "Success":
      return "completed";
    case "Failed":
    default:
      return "failed";
  }
}

export class MiniMaxAdapter implements ModelAdapter {
  readonly modelId = "minimax" as const;
  readonly displayName = "MiniMax";
  private readonly mock = new MockModelAdapter(this.modelId, this.displayName);

  async generate(prompt: string, options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = readEnv("MINIMAX_API_KEY");
    const groupId = readEnv("MINIMAX_GROUP_ID");
    if (isPlaceholder(apiKey) || isPlaceholder(groupId)) {
      return this.mock.generate(prompt, options);
    }

    const response = await fetch(`${SUBMIT_URL}?GroupId=${encodeURIComponent(groupId!)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "music-1.5",
        prompt: buildPrompt(prompt, options),
      }),
    });

    if (!response.ok) {
      throw new Error(`MiniMax API error ${response.status}: ${await safeText(response)}`);
    }

    const body = (await response.json()) as MiniMaxSubmitResponse;
    if (!body.task_id) {
      throw new Error(`MiniMax submit response had no task_id: ${JSON.stringify(body)}`);
    }

    return { jobId: body.task_id };
  }

  async getStatus(jobId: string): Promise<JobStatusResult> {
    const apiKey = readEnv("MINIMAX_API_KEY");
    const groupId = readEnv("MINIMAX_GROUP_ID");
    if (isPlaceholder(apiKey) || isPlaceholder(groupId)) {
      return this.mock.getStatus(jobId);
    }

    const url = `${QUERY_URL}?task_id=${encodeURIComponent(jobId)}&GroupId=${encodeURIComponent(groupId!)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { status: "failed", error: `MiniMax API error ${response.status}: ${await safeText(response)}` };
    }

    const body = (await response.json()) as MiniMaxQueryResponse;
    const status = mapStatus(body.status);
    if (status === "failed") {
      return { status, error: body.base_resp?.status_msg ?? `Unexpected MiniMax status: ${body.status}` };
    }
    if (status === "completed") {
      return { status, audioUrl: body.audio_url };
    }
    return { status };
  }
}
