import { describe, it, expect } from "vitest";
import { enemyRadius, meleeRange, enemyTargetHeight, enemyFallbackScale } from "./combat";

describe("combat helpers", () => {
  describe("enemyRadius", () => {
    it("boss is largest", () => {
      expect(enemyRadius("boss")).toBe(0.52);
    });
    it("kitten is smallest", () => {
      expect(enemyRadius("kitten")).toBe(0.2);
    });
    it("normal is default", () => {
      expect(enemyRadius("normal")).toBe(0.22);
    });
    it("boss > normal > kitten", () => {
      expect(enemyRadius("boss")).toBeGreaterThan(enemyRadius("normal"));
      expect(enemyRadius("normal")).toBeGreaterThan(enemyRadius("kitten"));
    });
  });

  describe("meleeRange", () => {
    it("boss has longest melee range", () => {
      expect(meleeRange("boss")).toBe(1.6);
    });
    it("kitten has shortest melee range", () => {
      expect(meleeRange("kitten")).toBe(1.0);
    });
    it("normal is between", () => {
      expect(meleeRange("normal")).toBe(1.2);
    });
  });

  describe("enemyTargetHeight", () => {
    it("boss is tallest", () => {
      expect(enemyTargetHeight("boss")).toBe(1.0);
    });
    it("kitten is shortest", () => {
      expect(enemyTargetHeight("kitten")).toBe(0.56);
    });
    it("normal is between", () => {
      expect(enemyTargetHeight("normal")).toBe(0.72);
    });
  });

  describe("enemyFallbackScale", () => {
    it("produces size multiplied by 0.7", () => {
      expect(enemyFallbackScale("boss")).toBeCloseTo(1.38 * 0.7);
      expect(enemyFallbackScale("kitten")).toBeCloseTo(0.62 * 0.7);
      expect(enemyFallbackScale("normal")).toBeCloseTo(1.0 * 0.7);
    });
    it("boss > normal > kitten", () => {
      expect(enemyFallbackScale("boss")).toBeGreaterThan(enemyFallbackScale("normal"));
      expect(enemyFallbackScale("normal")).toBeGreaterThan(enemyFallbackScale("kitten"));
    });
  });
});
