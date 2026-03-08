/**
 * Combat actions — firing, damage, enemy lookup — extracted from main.ts.
 *
 * Every function takes `ctx: GameContext`.
 */
import { AbstractMesh, Node, Vector3 } from "@babylonjs/core";
import type { GameContext } from "../runtime/gameContext";
import type { EnemyEntity } from "../runtime/types";
import { SERVER_AUTHORITATIVE_ONLY } from "../featureFlags";
import { MAX_MANA } from "../runtime/constants";
import {
  playEnemyDeathSound,
  playFireballSound,
  playInfernoSound,
  playLightningBoltSound,
  playPlayerDeathSound,
  playPortalSound,
} from "../../audio";
import { spawnCastFireball, stopInfernoStream, updateInfernoStreamVisual } from "./projectiles";
import { lineOfSight as lineOfSightModule } from "./enemyAi";

// ── Damage ──────────────────────────────────────────────────────────────────

export function damagePlayer(ctx: GameContext, amount: number): void {
  if (ctx.godMode || ctx.gameOver) return;
  ctx.health -= amount;
  if (ctx.health <= 0) {
    ctx.health = 0;
    ctx.gameOver = true;
    playPlayerDeathSound();
    ctx.setCheatStatus("You got shredded. Press R to restart.");
  }
  ctx.updateHud();
}

export function setPortalActive(ctx: GameContext, active: boolean): void {
  if (ctx.portalActive === active) {
    if (ctx.portalMesh) ctx.portalMesh.isVisible = active;
    return;
  }
  ctx.portalActive = active;
  if (ctx.portalMesh) ctx.portalMesh.isVisible = active;
  if (active) playPortalSound();
  ctx.updateHud();
}

export function killEnemy(ctx: GameContext, enemy: EnemyEntity): void {
  enemy.health = 0;
  enemy.runAnimation?.stop();
  enemy.runAnimation?.dispose();
  enemy.runAnimation = null;
  enemy.mesh.dispose();
  playEnemyDeathSound();

  if (enemy.type === "boss") {
    ctx.hasLightningBolt = true;
    ctx.runeMode = "lightning-bolt";
    ctx.mana = Math.min(MAX_MANA, ctx.mana + 35);
  }
}

export function damageEnemy(ctx: GameContext, enemy: EnemyEntity, amount: number): void {
  if (enemy.health <= 0) return;
  enemy.health -= amount;
  if (enemy.health <= 0) {
    killEnemy(ctx, enemy);
    if (!ctx.portalActive && ctx.enemies.filter((e) => e.health > 0).length === 0) {
      setPortalActive(ctx, true);
    }
  }
  ctx.updateHud();
}

export function findEnemyByMesh(ctx: GameContext, mesh: AbstractMesh): EnemyEntity | undefined {
  let cursor: Node | null = mesh;
  while (cursor) {
    const found = ctx.enemies.find((e) => e.mesh === cursor && e.health > 0);
    if (found) return found;
    cursor = cursor.parent;
  }
  return undefined;
}

// ── Inferno cone damage ─────────────────────────────────────────────────────

export function applyInfernoDamage(ctx: GameContext): void {
  const from = ctx.camera.position.add(new Vector3(0, -0.18, 0));
  const forward = ctx.camera.getDirection(new Vector3(0, 0.02, 1)).normalize();
  const maxDistance = 6.2;
  const coneCos = Math.cos(0.46);

  for (const enemy of ctx.enemies) {
    if (enemy.health <= 0) continue;
    const toEnemy = enemy.mesh.position.add(new Vector3(0, 0.42, 0)).subtract(from);
    const dist = toEnemy.length();
    if (dist > maxDistance || dist < 0.001) continue;
    const dir = toEnemy.scale(1 / dist);
    const facing = Vector3.Dot(forward, dir);
    if (facing < coneCos) continue;
    if (!lineOfSightModule(ctx, from, enemy.mesh.position.add(new Vector3(0, 0.42, 0)))) continue;
    const dmg = 0.45 + (1 - dist / maxDistance) * 0.9;
    damageEnemy(ctx, enemy, dmg);
  }
}

// ── Main fire handler ───────────────────────────────────────────────────────

export function fireRune(ctx: GameContext): void {
  if (ctx.gameOver || ctx.victory) return;

  if (SERVER_AUTHORITATIVE_ONLY || ctx.multiplayerSync) {
    if (!ctx.multiplayerSync) return;
    if (ctx.mana < 2) return;
    ctx.mana -= 2;
    ctx.fireCooldown = 0.22;
    ctx.recoil = 0.1;
    ctx.rightHandWaveTime = 0.22;
    playFireballSound();
    const aimDir = ctx.camera.getDirection(new Vector3(0, 0, 1)).normalize();
    ctx.multiplayerSync.sendShoot({
      dirX: aimDir.x,
      dirY: aimDir.y,
      dirZ: aimDir.z,
    });
    ctx.updateHud();
    return;
  }

  let damage = 1;
  let splash = 0;

  if (ctx.runeMode === "inferno") {
    if (ctx.infernoFuel <= 0) {
      ctx.runeMode = ctx.hasLightningBolt ? "lightning-bolt" : ctx.hasIceShard ? "ice-shard" : "fireball";
      ctx.updateHud();
      stopInfernoStream(ctx);
      return;
    }
    ctx.infernoFuel = Math.max(0, ctx.infernoFuel - 2.1);
    ctx.fireCooldown = 0.04;
    ctx.recoil = 0.02;
    playInfernoSound();
    applyInfernoDamage(ctx);
    updateInfernoStreamVisual(ctx, true);
    if (ctx.infernoFuel <= 0.001) {
      ctx.infernoFuel = 0;
      ctx.runeMode = ctx.hasLightningBolt ? "lightning-bolt" : ctx.hasIceShard ? "ice-shard" : "fireball";
      updateInfernoStreamVisual(ctx, false);
    }
    ctx.updateHud();
    return;
  } else if (ctx.runeMode === "lightning-bolt") {
    if (ctx.mana < 2) return;
    ctx.mana -= 2;
    ctx.fireCooldown = 0.58;
    damage = 4;
    splash = 2.2;
    ctx.recoil = 0.17;
    ctx.rightHandWaveTime = 0.22;
    playLightningBoltSound();
  } else if (ctx.runeMode === "ice-shard") {
    if (ctx.mana < 2) return;
    ctx.mana -= 2;
    ctx.fireCooldown = 0.055;
    damage = 1;
    ctx.recoil = 0.04;
    ctx.rightHandWaveTime = 0.18;
    playFireballSound();
  } else {
    if (ctx.mana < 2) return;
    ctx.mana -= 2;
    ctx.fireCooldown = 0.18;
    damage = 1;
    ctx.recoil = 0.09;
    ctx.rightHandWaveTime = 0.22;
    playFireballSound();
    spawnCastFireball(ctx);
  }

  const ray = ctx.camera.getForwardRay(60);
  const pick = ctx.scene.pickWithRay(ray, (mesh) => Boolean(mesh && findEnemyByMesh(ctx, mesh)));
  if (pick?.hit && pick.pickedMesh) {
    const enemy = findEnemyByMesh(ctx, pick.pickedMesh);
    if (enemy) {
      damageEnemy(ctx, enemy, damage);
      if (splash > 0) {
        for (const other of ctx.enemies) {
          if (other.health <= 0 || other === enemy) continue;
          const dist = Vector3.Distance(other.mesh.position, enemy.mesh.position);
          if (dist <= splash) damageEnemy(ctx, other, Math.max(1, damage - 1));
        }
      }
    }
  }

  ctx.updateHud();
}

// ── Clear enemies cheat ─────────────────────────────────────────────────────

export function clearEnemiesCheat(ctx: GameContext): void {
  for (const enemy of ctx.enemies) {
    if (enemy.health <= 0) continue;
    enemy.health = 0;
    enemy.runAnimation?.stop();
    enemy.runAnimation?.dispose();
    enemy.runAnimation = null;
    enemy.mesh.dispose();
  }
  setPortalActive(ctx, true);
}
