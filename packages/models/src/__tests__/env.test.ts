import { describe, expect, it } from "vitest";
import { isPlaceholder } from "../env.js";

describe("isPlaceholder", () => {
  it("treats undefined and empty strings as placeholders", () => {
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("   ")).toBe(true);
  });

  it("treats dummy-* values as placeholders, case-insensitively", () => {
    expect(isPlaceholder("dummy-key-pending")).toBe(true);
    expect(isPlaceholder("DUMMY-key-pending")).toBe(true);
  });

  it("treats anything else as a real value", () => {
    expect(isPlaceholder("sk-live-abc123")).toBe(false);
  });
});
