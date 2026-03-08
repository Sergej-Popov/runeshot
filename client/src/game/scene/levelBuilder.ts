import {
  Mesh,
  MeshBuilder,
  Vector3,
  type AbstractMesh,
  type Scene,
  type StandardMaterial,
} from "@babylonjs/core";
import { MAP_H, MAP_W, PIT_DEPTH, TILE_SIZE, TRAMPOLINE_RADIUS, WALL_HEIGHT } from "../runtime/constants";
import type { LevelMaterials } from "./materials";

export type LevelGeometry = {
  levelMeshes: AbstractMesh[];
  wallMeshes: AbstractMesh[];
  portalMesh: Mesh | null;
};

/**
 * Build all geometry (walls, floors, portal) for a level.
 */
export function buildLevelGeometry(
  scene: Scene,
  materials: LevelMaterials,
  currentLevel: number,
  levels: readonly { portal: { x: number; y: number } }[],
  isWallAt: (mx: number, my: number) => boolean,
  floorHeightAtMap: (mx: number, my: number) => number,
  cellKindForLevel: (level: number, x: number, y: number) => string,
  mapToWorld: (mx: number, my: number, elevation?: number) => Vector3,
): LevelGeometry {
  const levelMeshes: AbstractMesh[] = [];
  const wallMeshes: AbstractMesh[] = [];

  function createWall(x: number, y: number): void {
    const cx = (x + 0.5 - MAP_W / 2) * TILE_SIZE;
    const cz = (y + 0.5 - MAP_H / 2) * TILE_SIZE;
    const py = WALL_HEIGHT / 2;
    const half = TILE_SIZE / 2;

    const makeFace = (name: string, px: number, pz: number, rotY: number): void => {
      const face = MeshBuilder.CreatePlane(name, { width: TILE_SIZE, height: WALL_HEIGHT }, scene);
      face.position = new Vector3(px, py, pz);
      face.rotation.y = rotY;
      face.material = materials.wallMat;
      wallMeshes.push(face);
    };

    if (!isWallAt(x, y - 1)) makeFace(`wall-n-${x}-${y}`, cx, cz - half, Math.PI);
    if (!isWallAt(x, y + 1)) makeFace(`wall-s-${x}-${y}`, cx, cz + half, 0);
    if (!isWallAt(x - 1, y)) makeFace(`wall-w-${x}-${y}`, cx - half, cz, Math.PI / 2);
    if (!isWallAt(x + 1, y)) makeFace(`wall-e-${x}-${y}`, cx + half, cz, -Math.PI / 2);

    const top = MeshBuilder.CreateGround(`wall-top-${x}-${y}`, { width: TILE_SIZE, height: TILE_SIZE }, scene);
    top.position = new Vector3(cx, WALL_HEIGHT, cz);
    top.material = materials.wallMat;
    wallMeshes.push(top);
  }

  function createFloorTile(x: number, y: number): void {
    const height = floorHeightAtMap(x + 0.5, y + 0.5);
    const kind = cellKindForLevel(currentLevel, x, y);
    if (height <= PIT_DEPTH + 0.01) {
      const bottom = MeshBuilder.CreateBox(`pit-${x}-${y}`, { width: TILE_SIZE, depth: TILE_SIZE, height: 0.3 }, scene);
      bottom.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height - 0.15));
      bottom.material = materials.pitMat;
      levelMeshes.push(bottom);

      if (kind === "trampoline") {
        const disc = MeshBuilder.CreateCylinder(`trampoline-disc-${x}-${y}`, {
          height: 0.14,
          diameter: TRAMPOLINE_RADIUS * 2,
          tessellation: 32,
        }, scene);
        disc.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height + 0.07));
        disc.material = materials.trampolineMat;
        levelMeshes.push(disc);

        const ring = MeshBuilder.CreateTorus(`trampoline-ring-${x}-${y}`, {
          diameter: TRAMPOLINE_RADIUS * 2.12,
          thickness: 0.08,
          tessellation: 32,
        }, scene);
        ring.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height + 0.16));
        ring.rotation.x = Math.PI / 2;
        ring.material = materials.trampolineMat;
        levelMeshes.push(ring);
      }
      return;
    }

    const thickness = Math.max(0.3, height + 0.3);
    const block = MeshBuilder.CreateBox(`floor-${x}-${y}`, { width: TILE_SIZE, depth: TILE_SIZE, height: thickness }, scene);
    block.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height - thickness / 2));
    block.material = kind === "stairs" ? materials.stairMat : kind === "platform" ? materials.platformMat : materials.floorMat;
    levelMeshes.push(block);
  }

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (isWallAt(x, y)) createWall(x, y);
      else createFloorTile(x, y);
    }
  }

  const portal = levels[currentLevel].portal;
  const portalMesh = MeshBuilder.CreateTorus("portal", { diameter: 1.9, thickness: 0.24, tessellation: 24 }, scene);
  portalMesh.position.copyFrom(mapToWorld(portal.x, portal.y, 1.5));
  portalMesh.material = materials.portalMat;
  portalMesh.isVisible = false;

  return { levelMeshes, wallMeshes, portalMesh };
}

/**
 * Dispose all meshes from a level geometry result.
 */
export function disposeLevelGeometry(geometry: LevelGeometry): void {
  for (const mesh of [...geometry.levelMeshes, ...geometry.wallMeshes]) mesh.dispose();
  geometry.levelMeshes.length = 0;
  geometry.wallMeshes.length = 0;
  if (geometry.portalMesh) {
    geometry.portalMesh.dispose();
    geometry.portalMesh = null;
  }
}
