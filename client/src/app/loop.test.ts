import { describe, expect, it } from "vitest";
import { computeDeltaSeconds, createFrameHarness } from "./loop";

describe("computeDeltaSeconds", () => {
  it("computes normal frame delta", () => {
    expect(computeDeltaSeconds(1016, 1000)).toBeCloseTo(0.016, 5);
  });

  it("clamps large frame gaps", () => {
    expect(computeDeltaSeconds(1500, 1000)).toBe(0.05);
  });
});

describe("createFrameHarness", () => {
  it("tracks frame-to-frame dt", () => {
    const harness = createFrameHarness(1000);
    expect(harness.step(1016)).toBeCloseTo(0.016, 5);
    expect(harness.step(1040)).toBeCloseTo(0.024, 5);
    expect(harness.getLastNow()).toBe(1040);
  });
});
