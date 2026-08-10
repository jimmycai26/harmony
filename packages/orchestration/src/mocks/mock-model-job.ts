import type { GenerationResult, ModelJob, ModelJobFactory } from "../types.js";

/**
 * Stand-in for a real model provider's generation API, used until
 * `packages/models` lands. State lives in a module-level map (not on the
 * job instance) so `poll()` behaves the same way a real HTTP-backed
 * provider would: durable by provider id, indifferent to whether the
 * `ModelJob` instance asking was freshly constructed.
 */

interface MockJobState {
  modelId: string;
  readyAt: number;
  willFail: boolean;
}

export interface MockModelJobOptions {
  /** Minimum simulated generation time, in ms. Default 3s. */
  minLatencyMs?: number;
  /** Maximum simulated generation time, in ms. Default 12s. */
  maxLatencyMs?: number;
  /** Probability (0-1) a job fails once "ready". Default 0.05. */
  failureRate?: number;
  /** Probability (0-1) a job never resolves, to exercise the timeout path. Default 0. */
  hangRate?: number;
}

const jobStore = new Map<string, MockJobState>();
let jobCounter = 0;

class MockModelJob implements ModelJob {
  readonly modelId: string;

  constructor(
    modelId: string,
    private readonly options: Required<MockModelJobOptions>,
  ) {
    this.modelId = modelId;
  }

  async start(): Promise<{ providerJobId: string }> {
    const providerJobId = `mock-${this.modelId}-${Date.now()}-${jobCounter++}`;
    const hung = Math.random() < this.options.hangRate;
    const latency =
      this.options.minLatencyMs +
      Math.random() * (this.options.maxLatencyMs - this.options.minLatencyMs);

    jobStore.set(providerJobId, {
      modelId: this.modelId,
      readyAt: hung ? Number.POSITIVE_INFINITY : Date.now() + latency,
      willFail: Math.random() < this.options.failureRate,
    });

    return { providerJobId };
  }

  async poll(providerJobId: string): Promise<GenerationResult> {
    const job = jobStore.get(providerJobId);
    if (!job) {
      return { status: "failed", error: `unknown mock job id: ${providerJobId}` };
    }
    if (Date.now() < job.readyAt) {
      return { status: "processing" };
    }
    if (job.willFail) {
      return { status: "failed", error: `mock generation failure for model ${job.modelId}` };
    }
    return {
      status: "ready",
      audioUrl: `https://mock-audio.harmony.dev/${job.modelId}/${providerJobId}.mp3`,
    };
  }
}

export function createMockModelJobFactory(
  options: MockModelJobOptions = {},
): ModelJobFactory {
  const resolved: Required<MockModelJobOptions> = {
    minLatencyMs: options.minLatencyMs ?? 3_000,
    maxLatencyMs: options.maxLatencyMs ?? 12_000,
    failureRate: options.failureRate ?? 0.05,
    hangRate: options.hangRate ?? 0,
  };

  return ({ modelId }) => new MockModelJob(modelId, resolved);
}
