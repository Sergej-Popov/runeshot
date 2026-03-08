/**
 * Pure map-query helpers.
 *
 * These accept callback functions for wall/floor checks so they
 * stay testable without Babylon or module-level state.
 */

/**
 * Can an entity of a given radius occupy the map position (mx, my)?
 * Checks all four corner offsets for wall collisions.
 */
export function canOccupyMap(
  mx: number,
  my: number,
  radius: number,
  isWall: (mx: number, my: number) => boolean,
): boolean {
  return !(
    isWall(mx - radius, my - radius) ||
    isWall(mx + radius, my - radius) ||
    isWall(mx - radius, my + radius) ||
    isWall(mx + radius, my + radius)
  );
}

/**
 * Is the floor at map position (mx, my) safe to walk on?
 * Tiles at or below pit depth are considered unsafe (pits, void).
 */
export function isSafeGroundAt(
  mx: number,
  my: number,
  pitDepth: number,
  floorHeight: (mx: number, my: number) => number,
): boolean {
  return floorHeight(mx, my) > pitDepth + 0.2;
}
