import type { RuneMode } from "./types";

const BASE_MODES: RuneMode[] = ["fireball"];

export function runeDisplayName(mode: RuneMode, infernoFuel: number): string {
  if (mode === "fireball") return "Fireball";
  if (mode === "lightning-bolt") return "Lightning Bolt";
  if (mode === "ice-shard") return "Ice Shard";
  return `Inferno (${Math.max(0, Math.ceil(infernoFuel))})`;
}

export function nextRuneMode(
  current: RuneMode,
  unlocked: { hasLightningBolt: boolean; hasIceShard: boolean; hasInferno: boolean; infernoFuel: number },
): RuneMode {
  const modes = [...BASE_MODES];
  if (unlocked.hasLightningBolt) modes.push("lightning-bolt");
  if (unlocked.hasIceShard) modes.push("ice-shard");
  if (unlocked.hasInferno && unlocked.infernoFuel > 0) modes.push("inferno");
  const index = modes.indexOf(current);
  return modes[(index + 1) % modes.length];
}
