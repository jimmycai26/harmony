import { describe, expect, it } from "vitest";
import { MockModelAdapter } from "../mock.js";

describe("MockModelAdapter", () => {
  it("reports processing before the delay elapses, then completed with an audio url", async () => {
    const adapter = new MockModelAdapter("mock", "Mock Model", 30);
    const { jobId } = await adapter.generate("a chill lo-fi beat", { scope: "beat", genre: "lo-fi" });

    const immediate = await adapter.getStatus(jobId);
    expect(immediate.status).toBe("processing");
    expect(immediate.audioUrl).toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 40));

    const settled = await adapter.getStatus(jobId);
    expect(settled.status).toBe("completed");
    expect(settled.audioUrl).toContain(jobId);
  });

  it("reports failed for an unknown job id", async () => {
    const adapter = new MockModelAdapter();
    const result = await adapter.getStatus("does-not-exist");
    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
  });
});
