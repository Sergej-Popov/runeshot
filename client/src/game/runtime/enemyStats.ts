import type { EnemyType } from "./types";

/**
 * Pure stat block for an enemy — no Babylon dependency.
 * Mesh / animation fields are intentionally omitted so this
 * module stays testable in a plain Node environment.
 */
export type EnemyStats = {
  health: number;
  maxHealth: number;
  speed: number;
  meleeDamage: number;
  meleeCooldown: number;
  shootCooldown: number;
  shootDelay: number;
  bulletSpeed: number;
  rangedDamage: number;
  spawnCooldown: number;
  aiMode: "push";
  aiTimer: number;
  strafeDir: 1 | -1;
};

/** Generate a random strafe direction (extracted for test seam). */
function randomStrafeDir(): 1 | -1 {
  return Math.random() < 0.5 ? -1 : 1;
}

/**
 * Build the stat block for an enemy given its type and the current level.
 *
 * `randomSeed` (0–1) can be supplied to make tests deterministic;
 *  when omitted the function uses `Math.random()`.
 */
export function buildEnemyStats(
  type: EnemyType,
  currentLevel: number,
  randomSeed?: number,
): EnemyStats {
  const rand = randomSeed ?? Math.random();
  const strafeDir: 1 | -1 = rand < 0.5 ? -1 : 1;

  if (type === "boss") {
    return {
      health: 42,
      maxHealth: 42,
      speed: 1.3,
      meleeDamage: 22,
      meleeCooldown: 0.8,
      shootCooldown: 0.5,
      shootDelay: 0.85,
      bulletSpeed: 13.5,
      rangedDamage: 20,
      spawnCooldown: 3.8,
      aiMode: "push",
      aiTimer: 0.4 + rand * 0.8,
      strafeDir,
    };
  }

  if (type === "kitten") {
    return {
      health: 1,
      maxHealth: 1,
      speed: 5.3,
      meleeDamage: 8,
      meleeCooldown: 0.3,
      shootCooldown: 999,
      shootDelay: 999,
      bulletSpeed: 0,
      rangedDamage: 0,
      spawnCooldown: 999,
      aiMode: "push",
      aiTimer: 0.4,
      strafeDir,
    };
  }

  // "normal" enemy — stats scale with level
  const levelScale = currentLevel + 1;
  return {
    health: 2 + levelScale,
    maxHealth: 2 + levelScale,
    speed: 1.8 + Math.min(1.2, currentLevel * 0.14),
    meleeDamage: 8 + currentLevel * 2,
    meleeCooldown: 0.2,
    shootCooldown: 0.8,
    shootDelay: Math.max(0.42, 1.05 - currentLevel * 0.08),
    bulletSpeed: Math.max(8.5, 11.6 - (currentLevel === 3 ? 1.6 : 0)),
    rangedDamage: 8 + currentLevel * 2,
    spawnCooldown: 999,
    aiMode: "push",
    aiTimer: 0.45 + rand * 0.9,
    strafeDir,
  };
}
