import type { RuneMode } from "./types";

// ──────────────────────────────────────────────
// Cheat action types (returned by parseCheatCommand)
// ──────────────────────────────────────────────

export type CheatAction =
  | { kind: "help" }
  | { kind: "meow" }
  | { kind: "burn" }
  | { kind: "furball" }
  | { kind: "catnip" }
  | { kind: "zoomies" }
  | { kind: "hiss" }
  | { kind: "resetcheats" }
  | { kind: "nap"; level: number }
  | { kind: "unknown" };

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** F-key → cheat command mapping. */
export const FN_KEY_CHEAT_MAP: Readonly<Record<string, string>> = {
  F1: "meow",
  F2: "catnip",
  F3: "zoomies",
  F4: "furball",
  F5: "hiss",
  F6: "resetcheats",
  F12: "burn",
};

export const CHEAT_HELP_TEXT =
  "meow | burn | furball | catnip | zoomies | hiss | nap# | resetcheats";

// ──────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────

/**
 * Parse a raw cheat string into a typed action.
 * `maxLevels` is needed for validating "nap#" range.
 * Returns `{ kind: "unknown" }` for unrecognised input, or
 * `null` if the input is empty (caller should display a prompt).
 */
export function parseCheatCommand(
  raw: string,
  maxLevels: number,
): CheatAction | null {
  const cheat = raw.trim().toLowerCase();
  if (!cheat) return null;

  if (cheat === "help" || cheat === "/help") return { kind: "help" };
  if (cheat === "meow") return { kind: "meow" };
  if (cheat === "burn") return { kind: "burn" };
  if (cheat === "furball") return { kind: "furball" };
  if (cheat === "catnip") return { kind: "catnip" };
  if (cheat === "zoomies") return { kind: "zoomies" };
  if (cheat === "hiss") return { kind: "hiss" };
  if (cheat === "resetcheats") return { kind: "resetcheats" };

  // "nap#" — jump to level
  const napMatch = cheat.match(/^nap(\d+)$/);
  if (napMatch) {
    const n = parseInt(napMatch[1], 10);
    if (n >= 1 && n <= maxLevels) {
      return { kind: "nap", level: n - 1 };
    }
  }

  return { kind: "unknown" };
}
