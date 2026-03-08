import { describe, expect, it } from "vitest";
import { nextRuneMode, runeDisplayName } from "./runes";
import type { RuneMode } from "./types";

describe("runeDisplayName", () => {
  it("formats inferno fuel", () => {
    expect(runeDisplayName("inferno", 42.1)).toBe("Inferno (43)");
  });
});

describe("nextRuneMode", () => {
  it("cycles only unlocked runes", () => {
    const unlocked = {
      hasLightningBolt: true,
      hasIceShard: false,
      hasInferno: true,
      infernoFuel: 10,
    };

    let mode: RuneMode = "fireball";
    mode = nextRuneMode(mode, unlocked);
    expect(mode).toBe("lightning-bolt");
    mode = nextRuneMode(mode, unlocked);
    expect(mode).toBe("inferno");
    mode = nextRuneMode(mode, unlocked);
    expect(mode).toBe("fireball");
  });
});
