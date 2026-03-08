import { Vector3 } from "@babylonjs/core";

export function mapToWorld(mx: number, my: number, mapW: number, mapH: number, tileSize: number, y = 0): Vector3 {
  return new Vector3((mx - mapW / 2) * tileSize, y, (my - mapH / 2) * tileSize);
}

export function worldToMap(pos: Vector3, mapW: number, mapH: number, tileSize: number): { x: number; y: number } {
  return {
    x: pos.x / tileSize + mapW / 2,
    y: pos.z / tileSize + mapH / 2,
  };
}

export function mapCellCenterWorld(
  cx: number,
  cy: number,
  mapW: number,
  mapH: number,
  tileSize: number,
  y = 0,
): Vector3 {
  return mapToWorld(cx + 0.5, cy + 0.5, mapW, mapH, tileSize, y);
}

export function mapKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseMapKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map((v) => Number(v));
  return { x, y };
}

export function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

export function rotateY(dir: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c);
}
