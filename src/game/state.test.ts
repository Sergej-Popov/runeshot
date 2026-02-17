import { describe, expect, it } from "vitest";
import { LEVELS, enemyCountForLevel, parseNapCheat } from "./state";

describe("parseNapCheat", () => {
  it("parses valid level cheats", () => {
    expect(parseNapCheat("nap1", LEVELS.length)).toBe(0);
    expect(parseNapCheat("nap4", LEVELS.length)).toBe(3);
  });

  it("rejects invalid values", () => {
    expect(parseNapCheat("nap0", LEVELS.length)).toBeNull();
    expect(parseNapCheat("nap999", LEVELS.length)).toBeNull();
    expect(parseNapCheat("meow", LEVELS.length)).toBeNull();
  });
});

describe("enemyCountForLevel", () => {
  it("never returns below 1", () => {
    expect(enemyCountForLevel(0)).toBeGreaterThanOrEqual(1);
    expect(enemyCountForLevel(999)).toBeGreaterThanOrEqual(1);
  });
});
