import type { EnemyType } from "./types";

/**
 * Collision radius for an enemy type.
 * Used for movement, spawning, and hit detection.
 */
export function enemyRadius(type: EnemyType): number {
  if (type === "boss") return 0.52;
  if (type === "kitten") return 0.2;
  return 0.22;
}

/**
 * Melee attack reach distance for an enemy type.
 */
export function meleeRange(type: EnemyType): number {
  if (type === "boss") return 1.6;
  if (type === "kitten") return 1.0;
  return 1.2;
}

/**
 * Y-offset used to determine aiming height on an enemy.
 * Bigger enemies have their hit target higher.
 */
export function enemyTargetHeight(type: EnemyType): number {
  if (type === "boss") return 1.0;
  if (type === "kitten") return 0.56;
  return 0.72;
}

/**
 * Fallback body scale multiplier for procedural enemy meshes
 * (used when glTF models are unavailable).
 */
export function enemyFallbackScale(type: EnemyType): number {
  return (type === "boss" ? 1.38 : type === "kitten" ? 0.62 : 1.0) * 0.7;
}
