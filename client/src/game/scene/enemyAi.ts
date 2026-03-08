/**
 * Enemy AI — movement, pathfinding, shooting, and per-frame update loop.
 *
 * Extracted from main.ts.  All game state is accessed through
 * `ctx: GameContext`.  Babylon helpers (Vector3, MeshBuilder, …)
 * are imported directly because this is a scene module (no unit tests).
 */

import {
  Color3,
  MeshBuilder,
  Ray,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { playCatMeowSound } from "../../audio";
import { enemyRadius as enemyRadiusByType, meleeRange as meleeRangeByType } from "../runtime/combat";
import { MAP_H, MAP_W, PIT_DEPTH, TILE_SIZE } from "../runtime/constants";
import type { GameContext } from "../runtime/gameContext";
import {
  mapCellCenterWorld as mapCellCenterWorldBase,
  mapKey as mapKeyBase,
  normalizeAngle as normalizeAngleBase,
  parseMapKey as parseMapKeyBase,
  rotateY as rotateYBase,
} from "../runtime/spatial";
import type { EnemyEntity } from "../runtime/types";

// ---------------------------------------------------------------------------
// Local helpers (delegate to spatial.ts with bound constants)
// ---------------------------------------------------------------------------
function mapCellCenterWorld(cx: number, cy: number, y = 0): Vector3 {
  return mapCellCenterWorldBase(cx, cy, MAP_W, MAP_H, TILE_SIZE, y);
}

function mapKey(x: number, y: number): string {
  return mapKeyBase(x, y);
}

function parseMapKey(key: string): { x: number; y: number } {
  return parseMapKeyBase(key);
}

function enemyRadius(enemy: EnemyEntity): number {
  return enemyRadiusByType(enemy.type);
}

// ---------------------------------------------------------------------------
// spawnEnemyShot — create a projectile from an enemy toward the player
// ---------------------------------------------------------------------------
export function spawnEnemyShot(ctx: GameContext, enemy: EnemyEntity): void {
  const from = enemy.mesh.position.add(new Vector3(0, 0.8, 0));
  const to = ctx.camera.position.add(new Vector3(0, -0.4, 0));
  const dir = to.subtract(from).normalize();

  const mesh = MeshBuilder.CreateSphere("enemy-shot", { diameter: 0.2 }, ctx.scene);
  const mat = new StandardMaterial("enemy-shot-mat", ctx.scene);
  mat.emissiveColor = enemy.type === "boss" ? new Color3(1, 0.45, 0.1) : new Color3(1, 0.7, 0.2);
  mesh.material = mat;
  mesh.position.copyFrom(from);

  ctx.enemyShots.push({
    mesh,
    velocity: dir.scale(enemy.bulletSpeed),
    life: 2.2,
    damage: enemy.rangedDamage,
  });
  playCatMeowSound();
}

// ---------------------------------------------------------------------------
// lineOfSight — ray-cast against wall meshes
// ---------------------------------------------------------------------------
export function lineOfSight(ctx: GameContext, from: Vector3, to: Vector3): boolean {
  const dir = to.subtract(from);
  const len = dir.length();
  if (len <= 0.001) return true;

  const ray = new Ray(from, dir.normalize(), len);
  const hit = ctx.scene.pickWithRay(ray, (mesh) => ctx.wallMeshes.includes(mesh));
  return !(hit?.hit && (hit.distance ?? len) < len - 0.15);
}

// ---------------------------------------------------------------------------
// spawnKittenNearBoss — spawn a kitten around a boss enemy
// ---------------------------------------------------------------------------
export function spawnKittenNearBoss(ctx: GameContext, boss: EnemyEntity): void {
  const livingKittens = ctx.enemies.filter((e) => e.type === "kitten" && e.health > 0).length;
  if (livingKittens >= 6) return;

  const offsets = [
    new Vector3(0.8, 0, 0),
    new Vector3(-0.8, 0, 0),
    new Vector3(0, 0, 0.8),
    new Vector3(0, 0, -0.8),
  ];

  for (const off of offsets) {
    const world = boss.mesh.position.add(off);
    if (Vector3.Distance(world, ctx.camera.position) < 2.8) continue;
    const m = ctx.worldToMap(world);
    if (!ctx.canOccupyMap(m.x, m.y, 0.2)) continue;
    if (!ctx.isSafeGroundAt(m.x, m.y)) continue;
    ctx.enemies.push(ctx.createEnemy("kitten", m.x, m.y));
    playCatMeowSound();
    return;
  }
}

// ---------------------------------------------------------------------------
// resolveEnemySpawnPosition — find valid ground position near target cell
// ---------------------------------------------------------------------------
export function resolveEnemySpawnPosition(
  ctx: GameContext,
  enemy: EnemyEntity,
  mx: number,
  my: number,
  avoidPos?: Vector3,
  minDistanceFromAvoid = 0,
): void {
  const r = enemyRadius(enemy);
  const isFarEnough = (x: number, y: number): boolean => {
    if (!avoidPos || minDistanceFromAvoid <= 0) return true;
    const w = ctx.mapToWorld(x, y);
    return Vector3.Distance(w, avoidPos) >= minDistanceFromAvoid;
  };
  const isValidEnemyTile = (x: number, y: number): boolean => ctx.floorHeightAtMap(x, y) > PIT_DEPTH + 0.2;
  if (ctx.canOccupyMap(mx, my, r) && isFarEnough(mx, my) && isValidEnemyTile(mx, my)) {
    const w = ctx.mapToWorld(mx, my);
    enemy.mesh.position.x = w.x;
    enemy.mesh.position.y = ctx.floorHeightAtMap(mx, my);
    enemy.mesh.position.z = w.z;
    return;
  }

  for (let radius = 0.45; radius <= 4.2; radius += 0.35) {
    const steps = Math.max(10, Math.floor(10 + radius * 8));
    for (let i = 0; i < steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      const cx = mx + Math.sin(a) * radius;
      const cy = my + Math.cos(a) * radius;
      if (!ctx.canOccupyMap(cx, cy, r)) continue;
      if (!isValidEnemyTile(cx, cy)) continue;
      if (!isFarEnough(cx, cy)) continue;
      const w = ctx.mapToWorld(cx, cy);
      enemy.mesh.position.x = w.x;
      enemy.mesh.position.y = ctx.floorHeightAtMap(cx, cy);
      enemy.mesh.position.z = w.z;
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Animation / movement helpers
// ---------------------------------------------------------------------------
function rotateEnemyToward(enemy: EnemyEntity, dir: Vector3, dt: number, speed = 6.4): void {
  if (dir.lengthSquared() < 0.0001) return;
  const desired = Math.atan2(dir.x, dir.z);
  const delta = normalizeAngleBase(desired - enemy.mesh.rotation.y);
  enemy.mesh.rotation.y += Math.max(-speed * dt, Math.min(speed * dt, delta));
}

function setEnemyRunAnimationState(enemy: EnemyEntity, running: boolean): void {
  if (!enemy.runAnimation) return;
  if (enemy.wasMoving === running) return;
  enemy.wasMoving = running;
  if (running) {
    enemy.runAnimation.start(true);
  } else {
    enemy.runAnimation.stop();
  }
}

function tryMoveEnemy(ctx: GameContext, enemy: EnemyEntity, moveDir: Vector3, amount: number): boolean {
  if (moveDir.lengthSquared() < 0.0001 || amount <= 0) return false;
  const dir = moveDir.normalize();
  const prev = enemy.mesh.position.clone();
  const currentFloor = ctx.floorHeightAtWorld(prev);
  let moved = false;

  const candX = prev.add(new Vector3(dir.x * amount, 0, 0));
  const mapX = ctx.worldToMap(candX);
  if (ctx.canOccupyMap(mapX.x, mapX.y, enemyRadius(enemy))) {
    const floorX = ctx.floorHeightAtMap(mapX.x, mapX.y);
    if (floorX > PIT_DEPTH + 0.2 && floorX - currentFloor <= 0.66) {
      enemy.mesh.position.x = candX.x;
      moved = true;
    }
  }

  const candZ = prev.add(new Vector3(0, 0, dir.z * amount));
  const mapZ = ctx.worldToMap(candZ);
  if (ctx.canOccupyMap(mapZ.x, mapZ.y, enemyRadius(enemy))) {
    const floorZ = ctx.floorHeightAtMap(mapZ.x, mapZ.y);
    if (floorZ > PIT_DEPTH + 0.2 && floorZ - currentFloor <= 0.66) {
      enemy.mesh.position.z = candZ.z;
      moved = true;
    }
  }
  enemy.mesh.position.y = ctx.floorHeightAtWorld(enemy.mesh.position);

  return moved;
}

// ---------------------------------------------------------------------------
// Pathfinding
// ---------------------------------------------------------------------------
function isEnemyWalkableCell(ctx: GameContext, x: number, y: number, r: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  if (!ctx.canOccupyMap(x + 0.5, y + 0.5, r)) return false;
  return ctx.floorHeightAtMap(x + 0.5, y + 0.5) > PIT_DEPTH + 0.2;
}

function findEnemyPathWaypoint(ctx: GameContext, enemy: EnemyEntity, targetWorld: Vector3): Vector3 | null {
  const r = enemyRadius(enemy);
  const startMap = ctx.worldToMap(enemy.mesh.position);
  const goalMap = ctx.worldToMap(targetWorld);
  const sx = Math.max(0, Math.min(MAP_W - 1, Math.floor(startMap.x)));
  const sy = Math.max(0, Math.min(MAP_H - 1, Math.floor(startMap.y)));
  const gx = Math.max(0, Math.min(MAP_W - 1, Math.floor(goalMap.x)));
  const gy = Math.max(0, Math.min(MAP_H - 1, Math.floor(goalMap.y)));

  if (!isEnemyWalkableCell(ctx, sx, sy, r)) return null;
  if (!isEnemyWalkableCell(ctx, gx, gy, r)) return null;

  const start = mapKey(sx, sy);
  const goal = mapKey(gx, gy);
  if (start === goal) return mapCellCenterWorld(gx, gy, enemy.mesh.position.y);

  const queue: string[] = [start];
  const came = new Map<string, string | null>();
  came.set(start, null);
  const visited = new Set<string>([start]);

  let bestKey = start;
  let bestDist = Math.hypot(gx - sx, gy - sy);
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === goal) {
      bestKey = goal;
      break;
    }

    const c = parseMapKey(cur);
    for (const d of dirs) {
      const nx = c.x + d.x;
      const ny = c.y + d.y;
      const nk = mapKey(nx, ny);
      if (visited.has(nk)) continue;
      if (!isEnemyWalkableCell(ctx, nx, ny, r)) continue;
      const curFloor = ctx.floorHeightAtMap(c.x + 0.5, c.y + 0.5);
      const nextFloor = ctx.floorHeightAtMap(nx + 0.5, ny + 0.5);
      if (nextFloor - curFloor > 0.66) continue;
      if (Math.abs(d.x) + Math.abs(d.y) === 2) {
        if (!isEnemyWalkableCell(ctx, c.x + d.x, c.y, r) || !isEnemyWalkableCell(ctx, c.x, c.y + d.y, r)) continue;
      }

      visited.add(nk);
      came.set(nk, cur);
      queue.push(nk);

      const dist = Math.hypot(gx - nx, gy - ny);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = nk;
      }
    }
  }

  if (!came.has(bestKey)) return null;
  const revPath: string[] = [];
  let cur: string | null = bestKey;
  while (cur) {
    revPath.push(cur);
    cur = came.get(cur) ?? null;
  }
  const path = revPath.reverse();
  const nextKey = path[Math.min(1, path.length - 1)];
  const next = parseMapKey(nextKey);
  return mapCellCenterWorld(next.x, next.y, enemy.mesh.position.y);
}

// ---------------------------------------------------------------------------
// Steering / navigation
// ---------------------------------------------------------------------------
function computeEnemySteerDirection(ctx: GameContext, enemy: EnemyEntity, desiredTarget: Vector3): Vector3 {
  const raw = desiredTarget.subtract(enemy.mesh.position);
  raw.y = 0;
  if (raw.lengthSquared() < 0.0001) return Vector3.Zero();
  const desired = raw.normalize();
  const r = enemyRadius(enemy);
  const ahead = enemy.mesh.position.add(desired.scale(1.0));
  const aheadMap = ctx.worldToMap(ahead);
  if (ctx.canOccupyMap(aheadMap.x, aheadMap.y, r)) return desired;

  const samples = [0, -0.25, 0.25, -0.45, 0.45, -0.7, 0.7, -1.0, 1.0, -1.25, 1.25, Math.PI];
  let bestDir: Vector3 | null = null;
  let bestScore = -99999;
  for (const a of samples) {
    const cand = rotateYBase(desired, a);
    const p = enemy.mesh.position.add(cand.scale(0.95));
    const m = ctx.worldToMap(p);
    if (!ctx.canOccupyMap(m.x, m.y, r)) continue;

    let clearance = 0;
    const step = r * 1.9;
    for (const ox of [-step, 0, step]) {
      for (const oy of [-step, 0, step]) {
        if (!ctx.isWallAt(m.x + ox, m.y + oy)) clearance += 1;
      }
    }
    const progress = cand.dot(desired);
    const targetDist = Vector3.Distance(p, desiredTarget);
    const score = progress * 2.8 + clearance * 0.22 - targetDist * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestDir = cand;
    }
  }

  return bestDir ?? desired;
}

function computeNavigatedMoveDir(ctx: GameContext, enemy: EnemyEntity, desiredTarget: Vector3): Vector3 {
  const from = enemy.mesh.position.add(new Vector3(0, 0.7, 0));
  const to = new Vector3(desiredTarget.x, enemy.mesh.position.y + 0.7, desiredTarget.z);
  if (lineOfSight(ctx, from, to)) return computeEnemySteerDirection(ctx, enemy, desiredTarget);

  const waypoint = findEnemyPathWaypoint(ctx, enemy, desiredTarget);
  if (waypoint) return computeEnemySteerDirection(ctx, enemy, waypoint);
  return computeEnemySteerDirection(ctx, enemy, desiredTarget);
}

// ---------------------------------------------------------------------------
// AI target selection
// ---------------------------------------------------------------------------
function pickRoamTarget(ctx: GameContext, enemy: EnemyEntity): Vector3 | null {
  const base = enemy.mesh.position;
  for (let i = 0; i < 12; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.8 + Math.random() * 4.6;
    const p = new Vector3(base.x + Math.sin(a) * r, 0, base.z + Math.cos(a) * r);
    const m = ctx.worldToMap(p);
    if (ctx.canOccupyMap(m.x, m.y, enemyRadius(enemy))) return ctx.mapToWorld(m.x, m.y, base.y);
  }
  return null;
}

function pickCoverTarget(ctx: GameContext, enemy: EnemyEntity, playerPos: Vector3): Vector3 | null {
  const base = enemy.mesh.position;
  for (let i = 0; i < 20; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.2 + Math.random() * 5.2;
    const p = new Vector3(base.x + Math.sin(a) * r, 0, base.z + Math.cos(a) * r);
    const m = ctx.worldToMap(p);
    if (!ctx.canOccupyMap(m.x, m.y, enemyRadius(enemy))) continue;
    const w = ctx.mapToWorld(m.x, m.y, base.y);
    const hidden = !lineOfSight(ctx, w.add(new Vector3(0, 0.8, 0)), playerPos.add(new Vector3(0, -0.2, 0)));
    if (hidden) return w;
  }
  return null;
}

function pickFlankTarget(ctx: GameContext, enemy: EnemyEntity, playerPos: Vector3): Vector3 | null {
  const fromPlayer = enemy.mesh.position.subtract(playerPos);
  fromPlayer.y = 0;
  if (fromPlayer.lengthSquared() < 0.0001) fromPlayer.set(1, 0, 0);
  fromPlayer.normalize();
  const side = new Vector3(fromPlayer.z, 0, -fromPlayer.x).scale(enemy.strafeDir);
  for (let i = 0; i < 6; i += 1) {
    const dist = 3.2 + i * 0.75;
    const cand = playerPos.add(side.scale(dist)).add(fromPlayer.scale(1.2 + i * 0.25));
    const m = ctx.worldToMap(cand);
    if (!ctx.canOccupyMap(m.x, m.y, enemyRadius(enemy))) continue;
    return ctx.mapToWorld(m.x, m.y, enemy.mesh.position.y);
  }
  return null;
}

function retargetEnemyAi(ctx: GameContext, enemy: EnemyEntity, playerPos: Vector3, canSee: boolean, dist: number): void {
  if (enemy.type === "kitten") {
    enemy.aiMode = dist < 1.6 ? "strafe" : "push";
    enemy.aiTimer = 0.35 + Math.random() * 0.35;
    enemy.aiTarget = null;
    if (enemy.aiMode === "strafe") enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
    return;
  }

  if (canSee) enemy.lastSeenPlayer = playerPos.clone();

  const lowHealth = enemy.health <= Math.max(2, enemy.maxHealth * 0.35);
  if (lowHealth && Math.random() < 0.75) {
    enemy.aiMode = "retreat";
    enemy.aiTimer = 0.9 + Math.random() * 1.1;
    enemy.aiTarget = null;
    return;
  }

  if (canSee) {
    if (dist < 2.2) {
      enemy.aiMode = "retreat";
      enemy.aiTimer = 0.6 + Math.random() * 0.8;
      enemy.aiTarget = null;
      return;
    }

    const roll = Math.random();
    if (roll < 0.38) {
      enemy.aiMode = "strafe";
      enemy.aiTimer = 0.8 + Math.random() * 1.15;
      enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
      enemy.aiTarget = null;
      return;
    }

    if (roll < 0.68) {
      enemy.aiMode = "flank";
      enemy.aiTimer = 1.1 + Math.random() * 1.2;
      enemy.aiTarget = pickFlankTarget(ctx, enemy, playerPos) ?? pickRoamTarget(ctx, enemy);
      return;
    }

    enemy.aiMode = "hide";
    enemy.aiTimer = 1.2 + Math.random() * 1.6;
    enemy.aiTarget = pickCoverTarget(ctx, enemy, playerPos) ?? pickFlankTarget(ctx, enemy, playerPos) ?? pickRoamTarget(ctx, enemy);
    return;
  }

  if (enemy.lastSeenPlayer) {
    enemy.aiMode = Math.random() < 0.55 ? "flank" : "hide";
    enemy.aiTimer = 1.0 + Math.random() * 1.2;
    enemy.aiTarget =
      (enemy.aiMode === "hide" ? pickCoverTarget(ctx, enemy, enemy.lastSeenPlayer) : pickFlankTarget(ctx, enemy, enemy.lastSeenPlayer)) ??
      pickRoamTarget(ctx, enemy);
    return;
  }

  enemy.aiMode = "roam";
  enemy.aiTimer = 1.1 + Math.random() * 1.8;
  enemy.aiTarget = pickRoamTarget(ctx, enemy);
}

// ---------------------------------------------------------------------------
// updateEnemies — per-frame update for all living enemies
// ---------------------------------------------------------------------------
export function updateEnemies(ctx: GameContext, dt: number): void {
  const playerPos = ctx.camera.position.clone();

  for (const enemy of ctx.enemies) {
    if (enemy.health <= 0) continue;

    const toPlayer = playerPos.subtract(enemy.mesh.position);
    toPlayer.y = 0;
    const dist = Math.max(0.0001, toPlayer.length());
    const dirToPlayer = toPlayer.scale(1 / dist);
    const canSee = lineOfSight(ctx, enemy.mesh.position.add(new Vector3(0, 0.8, 0)), playerPos.add(new Vector3(0, -0.2, 0)));

    enemy.aiTimer -= dt;
    if (enemy.aiTimer <= 0 || (enemy.aiTarget && Vector3.Distance(enemy.mesh.position, enemy.aiTarget) < 0.65)) {
      retargetEnemyAi(ctx, enemy, playerPos, canSee, dist);
    }

    let desiredTarget: Vector3 | null = null;
    const desiredMinDist = enemy.type === "boss" ? 2.3 : enemy.type === "kitten" ? 0.8 : 2.0;
    const desiredMaxDist = enemy.type === "boss" ? 8.5 : enemy.type === "kitten" ? 1.6 : 10.0;

    if (enemy.aiMode === "push") {
      if (dist > desiredMinDist) desiredTarget = playerPos;
    } else if (enemy.aiMode === "retreat") {
      if (dist < desiredMaxDist) desiredTarget = enemy.mesh.position.add(dirToPlayer.scale(-4.8));
    } else if (enemy.aiMode === "strafe") {
      const side = new Vector3(dirToPlayer.z, 0, -dirToPlayer.x).scale(enemy.strafeDir);
      let keep = new Vector3(0, 0, 0);
      if (dist > desiredMaxDist) keep = dirToPlayer.scale(0.45);
      else if (dist < desiredMinDist) keep = dirToPlayer.scale(-0.45);
      desiredTarget = enemy.mesh.position.add(side.scale(3.2)).add(keep.scale(2.0));
    } else {
      const target = enemy.aiTarget;
      if (target) {
        desiredTarget = target;
      }
    }

    let moveDir = new Vector3(0, 0, 0);
    if (desiredTarget) {
      moveDir = computeNavigatedMoveDir(ctx, enemy, desiredTarget);
    }

    const moveScale =
      enemy.aiMode === "retreat" ? 1.15 :
        enemy.aiMode === "flank" ? 1.08 :
          enemy.aiMode === "hide" ? 0.9 :
            enemy.aiMode === "roam" ? 0.75 : 1.0;
    const moved = tryMoveEnemy(ctx, enemy, moveDir, enemy.speed * moveScale * dt);
    setEnemyRunAnimationState(enemy, moved);

    if (!moved && enemy.aiMode !== "push" && enemy.type !== "kitten") enemy.aiTimer = 0;

    enemy.meleeCooldown -= dt;
    const meleeRange = meleeRangeByType(enemy.type);
    if (dist <= meleeRange && enemy.meleeCooldown <= 0) {
      ctx.damagePlayer(enemy.meleeDamage);
      enemy.meleeCooldown = enemy.type === "kitten" ? 0.45 : 0.85;
    }

    enemy.shootCooldown -= dt;
    if (enemy.bulletSpeed > 0 && dist < 22 && enemy.shootCooldown <= 0) {
      if (canSee) {
        rotateEnemyToward(enemy, dirToPlayer, dt, 18);
        spawnEnemyShot(ctx, enemy);
        const sneakBonus = enemy.aiMode === "hide" ? 0.82 : enemy.aiMode === "flank" ? 0.9 : 1;
        enemy.shootCooldown = enemy.shootDelay * sneakBonus * (0.92 + Math.random() * 0.18);
      }
    }

    if (canSee && enemy.aiMode !== "hide" && enemy.aiMode !== "roam") {
      rotateEnemyToward(enemy, dirToPlayer, dt, 4.8);
    } else if (moveDir.lengthSquared() > 0.0008) {
      rotateEnemyToward(enemy, moveDir, dt, 5.8);
    }

    if (enemy.type === "boss") {
      enemy.spawnCooldown -= dt;
      if (enemy.spawnCooldown <= 0) {
        spawnKittenNearBoss(ctx, enemy);
        enemy.spawnCooldown = 3.8;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// updateEnemyShots — per-frame update for enemy projectiles
// ---------------------------------------------------------------------------
export function updateEnemyShots(ctx: GameContext, dt: number): void {
  for (let i = ctx.enemyShots.length - 1; i >= 0; i -= 1) {
    const shot = ctx.enemyShots[i];
    shot.mesh.position.addInPlace(shot.velocity.scale(dt));
    shot.life -= dt;

    const map = ctx.worldToMap(shot.mesh.position);
    const out = shot.life <= 0 || ctx.isWallAt(map.x, map.y);
    if (out) {
      shot.mesh.dispose();
      ctx.enemyShots.splice(i, 1);
      continue;
    }

    const dist = Vector3.Distance(shot.mesh.position, ctx.camera.position);
    if (dist <= 0.6) {
      ctx.damagePlayer(shot.damage);
      shot.mesh.dispose();
      ctx.enemyShots.splice(i, 1);
    }
  }
}
