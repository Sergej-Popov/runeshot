import { describe, it, expect } from "vitest";
import {
  parseCheatCommand,
  FN_KEY_CHEAT_MAP,
  CHEAT_HELP_TEXT,
  type CheatAction,
} from "./cheats";

const MAX_LEVELS = 5;

describe("parseCheatCommand", () => {
  it("returns null for empty input", () => {
    expect(parseCheatCommand("", MAX_LEVELS)).toBeNull();
    expect(parseCheatCommand("   ", MAX_LEVELS)).toBeNull();
  });

  it("parses help", () => {
    expect(parseCheatCommand("help", MAX_LEVELS)).toEqual({ kind: "help" });
    expect(parseCheatCommand("/help", MAX_LEVELS)).toEqual({ kind: "help" });
    expect(parseCheatCommand("  HELP  ", MAX_LEVELS)).toEqual({ kind: "help" });
  });

  it("parses simple cheats", () => {
    expect(parseCheatCommand("meow", MAX_LEVELS)).toEqual({ kind: "meow" });
    expect(parseCheatCommand("BURN", MAX_LEVELS)).toEqual({ kind: "burn" });
    expect(parseCheatCommand("Furball", MAX_LEVELS)).toEqual({ kind: "furball" });
    expect(parseCheatCommand("catnip", MAX_LEVELS)).toEqual({ kind: "catnip" });
    expect(parseCheatCommand("zoomies", MAX_LEVELS)).toEqual({ kind: "zoomies" });
    expect(parseCheatCommand("hiss", MAX_LEVELS)).toEqual({ kind: "hiss" });
    expect(parseCheatCommand("resetcheats", MAX_LEVELS)).toEqual({ kind: "resetcheats" });
  });

  it("parses nap with valid level", () => {
    expect(parseCheatCommand("nap1", MAX_LEVELS)).toEqual({ kind: "nap", level: 0 });
    expect(parseCheatCommand("nap5", MAX_LEVELS)).toEqual({ kind: "nap", level: 4 });
  });

  it("rejects nap with out-of-range level", () => {
    expect(parseCheatCommand("nap0", MAX_LEVELS)).toEqual({ kind: "unknown" });
    expect(parseCheatCommand("nap6", MAX_LEVELS)).toEqual({ kind: "unknown" });
    expect(parseCheatCommand("nap999", MAX_LEVELS)).toEqual({ kind: "unknown" });
  });

  it("rejects unknown commands", () => {
    expect(parseCheatCommand("purr", MAX_LEVELS)).toEqual({ kind: "unknown" });
    expect(parseCheatCommand("nap", MAX_LEVELS)).toEqual({ kind: "unknown" });
    expect(parseCheatCommand("napX", MAX_LEVELS)).toEqual({ kind: "unknown" });
  });
});

describe("FN_KEY_CHEAT_MAP", () => {
  it("maps F1 through F6 and F12", () => {
    expect(FN_KEY_CHEAT_MAP.F1).toBe("meow");
    expect(FN_KEY_CHEAT_MAP.F2).toBe("catnip");
    expect(FN_KEY_CHEAT_MAP.F3).toBe("zoomies");
    expect(FN_KEY_CHEAT_MAP.F4).toBe("furball");
    expect(FN_KEY_CHEAT_MAP.F5).toBe("hiss");
    expect(FN_KEY_CHEAT_MAP.F6).toBe("resetcheats");
    expect(FN_KEY_CHEAT_MAP.F12).toBe("burn");
  });

  it("has exactly 7 entries", () => {
    expect(Object.keys(FN_KEY_CHEAT_MAP)).toHaveLength(7);
  });
});

describe("CHEAT_HELP_TEXT", () => {
  it("contains all cheat names", () => {
    expect(CHEAT_HELP_TEXT).toContain("meow");
    expect(CHEAT_HELP_TEXT).toContain("burn");
    expect(CHEAT_HELP_TEXT).toContain("furball");
    expect(CHEAT_HELP_TEXT).toContain("catnip");
    expect(CHEAT_HELP_TEXT).toContain("zoomies");
    expect(CHEAT_HELP_TEXT).toContain("hiss");
    expect(CHEAT_HELP_TEXT).toContain("nap#");
    expect(CHEAT_HELP_TEXT).toContain("resetcheats");
  });
});
