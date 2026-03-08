/**
 * Projectile & visual-effect lifecycle — extracted from main.ts.
 *
 * Handles cast-fireballs, potion-projectiles, impact-bursts, and effect-clouds.
 * Every function receives `ctx: GameContext`.
 */
import {
  Color3,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { GameContext } from "../runtime/gameContext";
import {
  createFireballImpact,
  evictOldImpactBursts,
  disposeImpactBurst,
  createFreezePotionImpact,
  createPoisonPotionImpact,
  createInfernoStream,
  setInfernoStreamActive,
  stopInfernoStream as stopInfernoStreamModule,
  disposeInfernoStream as disposeInfernoStreamModule,
} from "./effects";
import { getFreezePotionTemplate, getPoisonPotionTemplate } from "./potionModels";
import { getCastMuzzlePosition } from "./hands";
import { playImpactSound } from "../../audio";
import { GRAVITY } from "../runtime/constants";
import type { InfernoStream } from "../runtime/types";

// ── Inferno stream helpers ──────────────────────────────────────────────────

export function stopInfernoStream(ctx: GameContext): void {
  if (!ctx.infernoStream) return;
  stopInfernoStreamModule(ctx.infernoStream);
}

export function disposeInfernoStream(ctx: GameContext): void {
  if (!ctx.infernoStream) return;
  disposeInfernoStreamModule(ctx.infernoStream);
  ctx.infernoStream = null;
}

export function ensureInfernoStream(ctx: GameContext): InfernoStream {
  if (ctx.infernoStream) return ctx.infernoStream;
  ctx.infernoStream = createInfernoStream(ctx.scene, ctx.camera, ctx.particleTextures);
  return ctx.infernoStream;
}

export function updateInfernoStreamVisual(ctx: GameContext, active: boolean): void {
  const stream = ensureInfernoStream(ctx);
  setInfernoStreamActive(stream, active);
  if (!active) stopInfernoStream(ctx);
}

// ── Cast fireball ───────────────────────────────────────────────────────────

export function spawnCastFireball(ctx: GameContext, speed = 24, life = 0.55): void {
  const { scene, camera, castProjectiles } = ctx;

  const origin =
    getCastMuzzlePosition(ctx)
    ?? camera.position.add(camera.getDirection(new Vector3(0, -0.05, 1)).normalize().scale(0.9));
  const direction = camera.getDirection(new Vector3(0, 0, 1)).normalize();

  const mesh = MeshBuilder.CreateSphere("cast-fireball", { diameter: 0.24, segments: 12 }, scene);
  const mat = new StandardMaterial("cast-fireball-mat", scene);
  mat.emissiveColor = new Color3(1.0, 0.58, 0.14);
  mat.diffuseColor = new Color3(0.22, 0.08, 0.02);
  mesh.material = mat;
  mesh.position.copyFrom(origin);
  mesh.isPickable = false;

  const light = new PointLight("cast-fireball-light", origin.clone(), scene);
  light.diffuse = new Color3(1.0, 0.56, 0.2);
  light.intensity = 2.2;
  light.range = 5.5;

  castProjectiles.push({
    mesh,
    light,
    velocity: direction.scale(speed),
    life,
  });
}

// ── Impact helpers ──────────────────────────────────────────────────────────

export function fireballImpact(ctx: GameContext, at: Vector3): void {
  for (const old of evictOldImpactBursts(ctx.impactBursts)) {
    disposeImpactBurst(old);
  }
  playImpactSound();
  ctx.impactBursts.push(createFireballImpact(at, ctx.scene, ctx.particleTextures));
}

export function freezePotionImpact(ctx: GameContext, at: Vector3): void {
  ctx.effectClouds.push(createFreezePotionImpact(at, ctx.scene, ctx.particleTextures));
}

export function poisonPotionImpact(ctx: GameContext, at: Vector3): void {
  ctx.effectClouds.push(createPoisonPotionImpact(at, ctx.scene, ctx.particleTextures));
}

// ── Potion projectile throw ─────────────────────────────────────────────────

export function throwPotionProjectile(
  ctx: GameContext,
  kind: "freeze" | "poison",
  chargeSeconds = 0,
): boolean {
  const { scene, camera, potionProjectiles } = ctx;
  if (ctx.potionCooldown > 0 || ctx.gameOver || ctx.victory) return false;
  ctx.potionCooldown = 0.45;
  ctx.updateHud();

  const mesh = MeshBuilder.CreateSphere("potion-proj", { diameter: 0.22, segments: 10 }, scene);
  const template = kind === "freeze" ? getFreezePotionTemplate() : getPoisonPotionTemplate();
  if (template) {
    const colliderMat = new StandardMaterial("potion-proj-collider-mat", scene);
    colliderMat.alpha = 0.001;
    colliderMat.diffuseColor = new Color3(0, 0, 0);
    colliderMat.specularColor = new Color3(0, 0, 0);
    mesh.material = colliderMat;

    const visual = template.clone(`potion-proj-${kind}`);
    if (visual) {
      visual.setEnabled(true);
      visual.isVisible = true;
      visual.parent = mesh;
      visual.position.setAll(0);
      visual.rotation.setAll(0);
      visual.scaling.setAll(0.1);
      visual.isPickable = false;
    }
  } else {
    const mat = new StandardMaterial("potion-proj-mat", scene);
    if (kind === "freeze") {
      mat.diffuseColor = new Color3(0.55, 0.8, 0.95);
      mat.emissiveColor = new Color3(0.15, 0.3, 0.5);
    } else {
      mat.diffuseColor = new Color3(0.4, 0.86, 0.45);
      mat.emissiveColor = new Color3(0.08, 0.24, 0.1);
    }
    mesh.material = mat;
  }
  mesh.position = camera.position.add(camera.getDirection(new Vector3(0, -0.03, 1)).normalize().scale(0.85));
  mesh.isPickable = false;

  const charge01 = Math.max(0, Math.min(1, chargeSeconds / 1.25));
  const throwSpeed = 8.2 + charge01 * 13.8;
  const throwDir = camera.getDirection(new Vector3(0, 0.12, 1)).normalize();
  potionProjectiles.push({
    mesh,
    velocity: throwDir.scale(throwSpeed),
    life: 1.1 + charge01 * 1.1,
    bouncesRemaining: 5,
    kind,
  });
  return true;
}

// ── Per-frame projectile update ─────────────────────────────────────────────

export function updateProjectiles(ctx: GameContext, dt: number): void {
  const { potionProjectiles, castProjectiles, impactBursts } = ctx;

  // ─ Potion projectiles ─────────────────────────────────────────────────
  for (let i = potionProjectiles.length - 1; i >= 0; i -= 1) {
    const proj = potionProjectiles[i];
    const prev = proj.mesh.position.clone();
    proj.velocity.y -= GRAVITY * 0.72 * dt;
    proj.mesh.position.addInPlace(proj.velocity.scale(dt));
    proj.mesh.rotation.x += dt * 7;
    proj.mesh.rotation.z += dt * 5;
    proj.life -= dt;

    let bounced = false;

    const mapX = ctx.worldToMap(new Vector3(proj.mesh.position.x, prev.y, prev.z));
    if (ctx.isWallAt(mapX.x, mapX.y)) {
      proj.mesh.position.x = prev.x;
      proj.velocity.x = -proj.velocity.x * 0.72;
      bounced = true;
    }

    const mapZ = ctx.worldToMap(new Vector3(prev.x, prev.y, proj.mesh.position.z));
    if (ctx.isWallAt(mapZ.x, mapZ.y)) {
      proj.mesh.position.z = prev.z;
      proj.velocity.z = -proj.velocity.z * 0.72;
      bounced = true;
    }

    const m = ctx.worldToMap(proj.mesh.position);
    const floor = ctx.floorHeightAtMap(m.x, m.y);
    if (proj.mesh.position.y <= floor + 0.12) {
      proj.mesh.position.y = floor + 0.12;
      proj.velocity.y = Math.abs(proj.velocity.y) * 0.56;
      proj.velocity.x *= 0.82;
      proj.velocity.z *= 0.82;
      bounced = true;
    }

    if (bounced) {
      proj.velocity.y *= 0.92;
      proj.bouncesRemaining -= 1;
    }

    const tooSlowAfterBounce =
      proj.bouncesRemaining <= 0 ||
      (Math.abs(proj.velocity.y) < 0.8 && Math.hypot(proj.velocity.x, proj.velocity.z) < 1.2);

    if (proj.life <= 0 || tooSlowAfterBounce) {
      const at = proj.mesh.position.clone();
      proj.mesh.dispose();
      potionProjectiles.splice(i, 1);
      if (proj.kind === "freeze") {
        freezePotionImpact(ctx, at);
      } else {
        poisonPotionImpact(ctx, at);
        if (ctx.multiplayerSync) {
          ctx.multiplayerSync.sendUsePotion("poison", at.x, at.z);
        }
      }
    }
  }

  // ─ Cast fireballs ─────────────────────────────────────────────────────
  for (let i = castProjectiles.length - 1; i >= 0; i -= 1) {
    const proj = castProjectiles[i];
    proj.mesh.position.addInPlace(proj.velocity.scale(dt));
    proj.mesh.rotation.y += dt * 4.5;
    proj.life -= dt;
    proj.light.position.copyFrom(proj.mesh.position);

    const map = ctx.worldToMap(proj.mesh.position);
    const floor = ctx.floorHeightAtMap(map.x, map.y);
    const hitWall = ctx.isWallAt(map.x, map.y);
    const hitFloor = proj.mesh.position.y <= floor + 0.08;
    if (proj.life <= 0 || hitWall || hitFloor) {
      if (!ctx.multiplayerSync) fireballImpact(ctx, proj.mesh.position.clone());
      proj.light.dispose();
      proj.mesh.dispose();
      castProjectiles.splice(i, 1);
    }
  }

  // ─ Impact burst fade / cleanup ────────────────────────────────────────
  for (let i = impactBursts.length - 1; i >= 0; i -= 1) {
    const burst = impactBursts[i];
    burst.life -= dt;
    const t = Math.max(0, burst.life / burst.flashLife);
    const s = 1 + (1 - t) * 5.2;
    burst.mesh.scaling.setAll(s);
    burst.light.intensity = 4.2 * t;
    const mat = burst.mesh.material as StandardMaterial;
    if (mat) mat.alpha = 0.48 * t;

    if (!burst.stopped && burst.life <= 0) {
      for (const sys of burst.systems) sys.stop();
      burst.stopped = true;
    }

    if (burst.life <= burst.cleanupAt) {
      for (const sys of burst.systems) sys.dispose(false);
      burst.light.dispose();
      burst.mesh.dispose();
      impactBursts.splice(i, 1);
    }
  }
}

// ── Per-frame effect-cloud update ───────────────────────────────────────────

export function updateEffectClouds(ctx: GameContext, dt: number): void {
  const { effectClouds } = ctx;
  for (let i = effectClouds.length - 1; i >= 0; i -= 1) {
    const cloud = effectClouds[i];
    cloud.life -= dt;
    if (!cloud.stopped) {
      const t = Math.max(0, Math.min(1, cloud.life / 3.2));
      for (const sys of cloud.systems) {
        sys.emitRate *= 0.985 + t * 0.01;
      }
      if (cloud.life <= 0) {
        for (const sys of cloud.systems) sys.stop();
        cloud.stopped = true;
      }
    }

    if (cloud.life <= cloud.cleanupAt) {
      for (const sys of cloud.systems) sys.dispose(false);
      effectClouds.splice(i, 1);
    }
  }
}
