import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockModelJobFactory } from "../mocks/mock-model-job.js";

test("mock job reports processing before its latency window elapses, then ready", async () => {
  const factory = createMockModelJobFactory({ minLatencyMs: 30, maxLatencyMs: 30, failureRate: 0, hangRate: 0 });
  const job = factory({ modelId: "model-a", prompt: "a beat", scope: "beat", genre: "lofi" });

  const { providerJobId } = await job.start();
  const immediate = await job.poll(providerJobId);
  assert.equal(immediate.status, "processing");

  await new Promise((resolve) => setTimeout(resolve, 40));
  const later = await job.poll(providerJobId);
  assert.equal(later.status, "ready");
  assert.ok(later.audioUrl?.includes("model-a"));
});

test("mock job honors a forced failure rate", async () => {
  const factory = createMockModelJobFactory({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 1 });
  const job = factory({ modelId: "model-b", prompt: "a beat", scope: "beat", genre: "lofi" });

  const { providerJobId } = await job.start();
  const outcome = await job.poll(providerJobId);
  assert.equal(outcome.status, "failed");
  assert.match(outcome.error ?? "", /model-b/);
});

test("polling an unknown provider job id fails instead of hanging", async () => {
  const factory = createMockModelJobFactory();
  const job = factory({ modelId: "model-c", prompt: "a beat", scope: "beat", genre: "lofi" });

  const outcome = await job.poll("does-not-exist");
  assert.equal(outcome.status, "failed");
});

test("two jobs from the same factory don't leak state into each other", async () => {
  const factory = createMockModelJobFactory({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 });
  const jobA = factory({ modelId: "model-a", prompt: "p", scope: "beat", genre: "pop" });
  const jobB = factory({ modelId: "model-b", prompt: "p", scope: "beat", genre: "pop" });

  const startA = await jobA.start();
  const startB = await jobB.start();
  assert.notEqual(startA.providerJobId, startB.providerJobId);

  const resultA = await jobA.poll(startA.providerJobId);
  const resultB = await jobB.poll(startB.providerJobId);
  assert.ok(resultA.audioUrl?.includes("model-a"));
  assert.ok(resultB.audioUrl?.includes("model-b"));
});
