import { ElevenLabsAdapter } from "./adapters/elevenLabs.js";
import { Lyria2Adapter } from "./adapters/lyria2.js";
import { MiniMaxAdapter } from "./adapters/minimax.js";
import { StableAudioAdapter } from "./adapters/stableAudio.js";
import { MockModelAdapter } from "./mock.js";
import type { ModelAdapter, ModelId, ModelInfo } from "./types.js";

/**
 * Single source of truth for the production roster (the PRD's "4 models
 * per generation"). To add or remove a model:
 *   1. add/remove its entry here
 *   2. add/remove the matching case in `factories` below
 *   3. if adding, drop a new adapter file in `src/adapters/`
 * Nothing else in this package (or in callers using `getAllModelAdapters`)
 * needs to change.
 */
export const MODEL_ROSTER: ModelInfo[] = [
  {
    modelId: "stable-audio",
    displayName: "Stable Audio",
    provider: "Stability AI",
    licensing: "closed",
    docsUrl: "https://platform.stability.ai/docs/api-reference#tag/Audio",
  },
  {
    modelId: "lyria-2",
    displayName: "Lyria 2",
    provider: "Google DeepMind (via Vertex AI)",
    licensing: "closed",
    docsUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/music/generate-music",
  },
  {
    modelId: "elevenlabs",
    displayName: "ElevenLabs",
    provider: "ElevenLabs",
    licensing: "closed",
    docsUrl: "https://elevenlabs.io/docs/api-reference/music",
  },
  {
    modelId: "minimax",
    displayName: "MiniMax",
    provider: "MiniMax",
    licensing: "closed",
    docsUrl: "https://www.minimax.io/platform/document/T2A%20V2",
  },
];

const factories: Record<ModelId, () => ModelAdapter> = {
  "stable-audio": () => new StableAudioAdapter(),
  "lyria-2": () => new Lyria2Adapter(),
  elevenlabs: () => new ElevenLabsAdapter(),
  minimax: () => new MiniMaxAdapter(),
  mock: () => new MockModelAdapter(),
};

const instances = new Map<ModelId, ModelAdapter>();

/** Returns the (singleton) adapter for a model id. `"mock"` is always available for local dev, even outside `MODEL_ROSTER`. */
export function getModelAdapter(modelId: ModelId): ModelAdapter {
  let instance = instances.get(modelId);
  if (!instance) {
    const factory = factories[modelId];
    if (!factory) {
      throw new Error(`Unknown model id: ${modelId}`);
    }
    instance = factory();
    instances.set(modelId, instance);
  }
  return instance;
}

/** Adapters for the current production roster, in fan-out order. */
export function getAllModelAdapters(): ModelAdapter[] {
  return MODEL_ROSTER.map((info) => getModelAdapter(info.modelId));
}
