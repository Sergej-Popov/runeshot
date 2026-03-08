import { Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "vitest";
import { mapKey, mapToWorld, parseMapKey, worldToMap } from "./spatial";

describe("spatial helpers", () => {
  it("round-trips map and world coordinates", () => {
    const world = mapToWorld(5.5, 4.5, 16, 16, 2, 0);
    const map = worldToMap(world, 16, 16, 2);
    expect(map.x).toBeCloseTo(5.5, 6);
    expect(map.y).toBeCloseTo(4.5, 6);
  });

  it("serializes and parses map keys", () => {
    const key = mapKey(7, 9);
    expect(parseMapKey(key)).toEqual({ x: 7, y: 9 });
  });

  it("preserves y coordinate in world positions", () => {
    const world = mapToWorld(8, 8, 16, 16, 2, 3.2);
    expect(world).toEqual(new Vector3(0, 3.2, 0));
  });
});
