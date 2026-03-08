import { describe, it, expect } from "vitest";
import { buildEnemyStats, type EnemyStats } from "./enemyStats";

describe("buildEnemyStats", () => {
  const seed = 0.25; // deterministic

  describe("boss", () => {
    const stats = buildEnemyStats("boss", 0, seed);

    it("has fixed health of 42", () => {
      expect(stats.health).toBe(42);
      expect(stats.maxHealth).toBe(42);
    });

    it("has expected speed and damage", () => {
      expect(stats.speed).toBe(1.3);
      expect(stats.meleeDamage).toBe(22);
      expect(stats.rangedDamage).toBe(20);
    });

    it("has spawn cooldown", () => {
      expect(stats.spawnCooldown).toBe(3.8);
    });

    it("ignores currentLevel", () => {
      const s0 = buildEnemyStats("boss", 0, seed);
      const s5 = buildEnemyStats("boss", 5, seed);
      expect(s0.health).toBe(s5.health);
      expect(s0.speed).toBe(s5.speed);
      expect(s0.meleeDamage).toBe(s5.meleeDamage);
    });

    it("uses seed for aiTimer and strafeDir", () => {
      const s1 = buildEnemyStats("boss", 0, 0.1);
      const s2 = buildEnemyStats("boss", 0, 0.9);
      expect(s1.aiTimer).not.toBe(s2.aiTimer);
      expect(s1.strafeDir).toBe(-1); // 0.1 < 0.5
      expect(s2.strafeDir).toBe(1);  // 0.9 >= 0.5
    });
  });

  describe("kitten", () => {
    const stats = buildEnemyStats("kitten", 0, seed);

    it("has 1 health", () => {
      expect(stats.health).toBe(1);
      expect(stats.maxHealth).toBe(1);
    });

    it("is very fast melee-only", () => {
      expect(stats.speed).toBe(5.3);
      expect(stats.shootCooldown).toBe(999);
      expect(stats.bulletSpeed).toBe(0);
      expect(stats.rangedDamage).toBe(0);
    });

    it("ignores currentLevel", () => {
      const s0 = buildEnemyStats("kitten", 0, seed);
      const s5 = buildEnemyStats("kitten", 5, seed);
      expect(s0.health).toBe(s5.health);
      expect(s0.speed).toBe(s5.speed);
    });
  });

  describe("normal enemy", () => {
    it("scales health with level", () => {
      const s0 = buildEnemyStats("normal", 0, seed);
      const s3 = buildEnemyStats("normal", 3, seed);
      expect(s0.health).toBe(3);    // 2 + (0+1)
      expect(s0.maxHealth).toBe(3);
      expect(s3.health).toBe(6);    // 2 + (3+1)
      expect(s3.maxHealth).toBe(6);
    });

    it("scales speed with level, capped", () => {
      const s0 = buildEnemyStats("normal", 0, seed);
      const s10 = buildEnemyStats("normal", 10, seed);
      expect(s0.speed).toBeCloseTo(1.8);
      expect(s10.speed).toBe(1.8 + Math.min(1.2, 10 * 0.14));
    });

    it("scales melee and ranged damage", () => {
      const s0 = buildEnemyStats("normal", 0, seed);
      const s5 = buildEnemyStats("normal", 5, seed);
      expect(s0.meleeDamage).toBe(8);
      expect(s5.meleeDamage).toBe(18); // 8 + 5*2
      expect(s0.rangedDamage).toBe(8);
      expect(s5.rangedDamage).toBe(18);
    });

    it("has special bulletSpeed reduction at level 3", () => {
      const s2 = buildEnemyStats("normal", 2, seed);
      const s3 = buildEnemyStats("normal", 3, seed);
      expect(s2.bulletSpeed).toBe(11.6); // no reduction
      expect(s3.bulletSpeed).toBe(10.0); // 11.6 - 1.6
    });

    it("clamps shootDelay", () => {
      const s0 = buildEnemyStats("normal", 0, seed);
      const s20 = buildEnemyStats("normal", 20, seed);
      expect(s0.shootDelay).toBeCloseTo(1.05);
      expect(s20.shootDelay).toBe(0.42); // clamped
    });

    it("has no spawn cooldown", () => {
      expect(buildEnemyStats("normal", 0, seed).spawnCooldown).toBe(999);
    });
  });
});
