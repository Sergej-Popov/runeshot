import { describe, expect, it } from "vitest";
import { freezeRecoveryFraction } from "./freezeIndicator";

describe("freezeRecoveryFraction", () => {
  it("returns 0 before freeze starts", () => {
    expect(freezeRecoveryFraction(1000, 0, 15_000)).toBe(0);
  });

  it("increases linearly over freeze duration", () => {
    expect(freezeRecoveryFraction(8500, 1000, 15_000)).toBeCloseTo(0.5, 6);
  });

  it("clamps to 1 when duration elapsed", () => {
    expect(freezeRecoveryFraction(20_000, 1000, 15_000)).toBe(1);
  });
});
