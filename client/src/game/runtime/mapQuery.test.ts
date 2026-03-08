import { describe, it, expect } from "vitest";
import { canOccupyMap, isSafeGroundAt } from "./mapQuery";

describe("canOccupyMap", () => {
  const openMap = () => false; // no walls anywhere
  const wallAt = (wx: number, wy: number) => (x: number, y: number) =>
    Math.floor(x) === wx && Math.floor(y) === wy;

  it("returns true when no walls exist", () => {
    expect(canOccupyMap(5, 5, 0.22, openMap)).toBe(true);
  });

  it("returns false when a wall blocks a corner", () => {
    // Wall at tile (4, 4)
    const wall44 = wallAt(4, 4);
    // Entity at (4.2, 4.2) with radius 0.22:
    //   top-right corner = (4.42, 4.42) → tile (4,4) → wall hit
    expect(canOccupyMap(4.2, 4.2, 0.22, wall44)).toBe(false);
    // Entity at (3.5, 3.5) — all corners in tile 3
    expect(canOccupyMap(3.5, 3.5, 0.22, wall44)).toBe(true);
  });

  it("returns false when standing exactly on a wall tile edge", () => {
    // Wall at tile (5, 5)
    const wall55 = wallAt(5, 5);
    // entity at (5.5, 5.5) — all four corners at 5.28 and 5.72, all floor to 5
    expect(canOccupyMap(5.5, 5.5, 0.22, wall55)).toBe(false);
  });

  it("returns true when radius is 0", () => {
    const wall55 = wallAt(5, 5);
    // Entity at (4.5, 4.5) with 0 radius — only checks (4.5,4.5) corners, all floor to 4
    expect(canOccupyMap(4.5, 4.5, 0, wall55)).toBe(true);
  });

  it("considers all four corners independently", () => {
    // Wall only at (3, 3)
    const wall33 = wallAt(3, 3);
    // Entity at (3.5, 3.5) with radius 0.22 — all corners floor to 3
    expect(canOccupyMap(3.5, 3.5, 0.22, wall33)).toBe(false);
    // Entity at (4.5, 4.5) — all corners in tile 4
    expect(canOccupyMap(4.5, 4.5, 0.22, wall33)).toBe(true);
  });
});

describe("isSafeGroundAt", () => {
  const PIT_DEPTH = -2;

  it("returns true for normal floor height", () => {
    const normalFloor = () => 0;
    expect(isSafeGroundAt(5, 5, PIT_DEPTH, normalFloor)).toBe(true);
  });

  it("returns false for pit depth", () => {
    const pitFloor = () => PIT_DEPTH;
    expect(isSafeGroundAt(5, 5, PIT_DEPTH, pitFloor)).toBe(false);
  });

  it("returns false for exactly pitDepth + 0.2 (not greater)", () => {
    const edgeFloor = () => PIT_DEPTH + 0.2;
    expect(isSafeGroundAt(5, 5, PIT_DEPTH, edgeFloor)).toBe(false);
  });

  it("returns true for just above threshold", () => {
    const justAbove = () => PIT_DEPTH + 0.21;
    expect(isSafeGroundAt(5, 5, PIT_DEPTH, justAbove)).toBe(true);
  });

  it("passes coordinates through to the callback", () => {
    const calls: [number, number][] = [];
    const spy = (mx: number, my: number) => {
      calls.push([mx, my]);
      return 0;
    };
    isSafeGroundAt(7.3, 2.1, PIT_DEPTH, spy);
    expect(calls).toEqual([[7.3, 2.1]]);
  });
});
