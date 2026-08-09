import type { GenerateOptions, GenerationScope } from "../types.js";

/** Folds the PRD's scope/genre chips into a single text prompt for providers with no separate params for them. */
export function buildPrompt(prompt: string, options: GenerateOptions): string {
  return `${prompt} (scope: ${options.scope}, genre: ${options.genre})`;
}

/** Rough duration target per scope, used by providers whose API takes an explicit length. Tune once real usage data exists. */
export function scopeToDurationSeconds(scope: GenerationScope): number {
  switch (scope) {
    case "beat":
      return 15;
    case "vocal-take":
      return 20;
    case "instrumental":
      return 30;
    case "full-song":
      return 60;
  }
}

/** Wraps raw audio bytes as a `data:` URL — a placeholder until `packages/storage` persists these to real URLs. */
export function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}
