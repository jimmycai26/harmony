import { describe, expect, it } from "vitest";
import { MODEL_ROSTER, getAllModelAdapters, getModelAdapter } from "../registry.js";

describe("registry", () => {
  it("has the 4-model production roster from the PRD", () => {
    expect(MODEL_ROSTER.map((m) => m.modelId).sort()).toEqual(
      ["elevenlabs", "lyria-2", "minimax", "stable-audio"].sort(),
    );
  });

  it("returns an adapter whose modelId matches the requested id", () => {
    for (const info of MODEL_ROSTER) {
      const adapter = getModelAdapter(info.modelId);
      expect(adapter.modelId).toBe(info.modelId);
    }
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    expect(getModelAdapter("mock")).toBe(getModelAdapter("mock"));
  });

  it("supports the mock adapter even though it's outside the production roster", () => {
    const adapter = getModelAdapter("mock");
    expect(adapter.modelId).toBe("mock");
  });

  it("throws for an unknown model id", () => {
    // @ts-expect-error deliberately invalid id to exercise the runtime guard
    expect(() => getModelAdapter("not-a-real-model")).toThrow();
  });

  it("getAllModelAdapters returns one adapter per roster entry, in order", () => {
    const adapters = getAllModelAdapters();
    expect(adapters.map((a) => a.modelId)).toEqual(MODEL_ROSTER.map((m) => m.modelId));
  });
});
