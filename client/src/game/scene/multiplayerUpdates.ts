/**
 * Multiplayer synchronisation helpers — extracted from main.ts.
 *
 * Each function takes `ctx: GameContext` and reads/writes shared state
 * through the accessor object.  Babylon / DOM dependencies are imported
 * directly because this is a scene module (no unit tests needed).
 */

import { Vector3 } from "@babylonjs/core";
import {
  serverDebugAuthEl,
  serverDebugLobbyEl,
  serverDebugPlayersEl,
  serverDebugRoomEl,
  serverDebugStateEl,
  serverDebugUrlEl,
} from "../../dom";
import { LEVELS } from "../state";
import { EYE_HEIGHT, MAX_MANA } from "../runtime/constants";
import type { GameContext } from "../runtime/gameContext";
import {
  createPoisonCloudVisual as createPoisonCloudVisualModule,
  disposePoisonCloudVisual as disposePoisonCloudVisualModule,
} from "./effects";

// ---------------------------------------------------------------------------
// syncMultiplayerPose — send local player transform to the server
// ---------------------------------------------------------------------------
export function syncMultiplayerPose(ctx: GameContext, now: number): void {
  if (!ctx.multiplayerSync) return;

  try {
    ctx.multiplayerSync.tick({
      x: ctx.camera.position.x,
      y: ctx.camera.position.y - EYE_HEIGHT + 1,
      z: ctx.camera.position.z,
      rotY: ctx.yaw,
      hp: Math.max(0, Math.floor(ctx.health)),
      mana: Math.max(0, Math.floor(ctx.mana)),
    });
  } catch (error) {
    console.error("Multiplayer pose sync failed", error);
  }
}

// ---------------------------------------------------------------------------
// syncMultiplayerVitals — pull authoritative vitals from the server
// ---------------------------------------------------------------------------
export function syncMultiplayerVitals(ctx: GameContext): void {
  if (!ctx.multiplayerSync) return;
  const vitals = ctx.multiplayerSync.getSelfVitals();
  const transform = ctx.multiplayerSync.getSelfTransform();
  ctx.health = Math.max(0, Math.min(ctx.maxHealth, vitals.hp));
  ctx.mana = Math.max(0, Math.min(MAX_MANA, Math.floor(vitals.mana)));

  // Sync potion inventory
  const potions = ctx.multiplayerSync.getPotionInventory();
  ctx.potionInventory.health = potions.health;
  ctx.potionInventory.mana = potions.mana;
  ctx.potionInventory.poison = potions.poison;
  ctx.potionInventory.speed = potions.speed;
  ctx.potionInventory.freeze = potions.freeze;

  ctx.isPlayerPoisoned = ctx.multiplayerSync.isSelfPoisoned();
  const wasBoosted = ctx.isPlayerSpeedBoosted;
  ctx.isPlayerSpeedBoosted = ctx.multiplayerSync.isSelfSpeedBoosted();
  if (ctx.isPlayerSpeedBoosted && !wasBoosted) {
    ctx.speedBoostStartedAt = performance.now();
  } else if (!ctx.isPlayerSpeedBoosted) {
    ctx.speedBoostStartedAt = 0;
  }
  const wasFrozen = ctx.isPlayerFrozen;
  ctx.isPlayerFrozen = ctx.multiplayerSync.isSelfFrozen();
  if (ctx.isPlayerFrozen && !wasFrozen) {
    ctx.freezeStartedAt = performance.now();
  } else if (!ctx.isPlayerFrozen) {
    ctx.freezeStartedAt = 0;
  }

  ctx.multiplayerRespawnSeconds = Math.max(0, Math.ceil(vitals.respawnIn));
  if (ctx.multiplayerRespawnSeconds > 0) {
    ctx.gameOver = true;
    ctx.multiplayerWasDowned = true;
    ctx.setCheatStatus(`You are down. Respawning in ${ctx.multiplayerRespawnSeconds}s...`);
  } else if (ctx.gameOver) {
    if (ctx.multiplayerWasDowned) {
      ctx.camera.position.x = transform.x;
      ctx.camera.position.y = transform.y + EYE_HEIGHT - 1;
      ctx.camera.position.z = transform.z;
      ctx.yaw = transform.rotY;
      ctx.pitch = 0;
      ctx.verticalVelocity = 0;
      ctx.isGrounded = true;
      ctx.trampolineLock = false;
    }
    ctx.multiplayerWasDowned = false;
    ctx.gameOver = false;
    ctx.setCheatStatus("Respawned");
  }
}

// ---------------------------------------------------------------------------
// syncMultiplayerWorldState — level transitions driven by server
// ---------------------------------------------------------------------------
export function syncMultiplayerWorldState(ctx: GameContext): void {
  if (!ctx.multiplayerSync) return;
  const world = ctx.multiplayerSync.getServerWorldState();
  const serverLevel = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(world.level)));
  if (serverLevel !== ctx.currentLevel) {
    ctx.startLevel(serverLevel, true);
    const transform = ctx.multiplayerSync.getSelfTransform();
    ctx.camera.position.x = transform.x;
    ctx.camera.position.y = transform.y + EYE_HEIGHT - 1;
    ctx.camera.position.z = transform.z;
    ctx.yaw = transform.rotY;
    ctx.pitch = 0;
    ctx.verticalVelocity = 0;
    ctx.isGrounded = true;
    ctx.trampolineLock = false;
    ctx.safeSpawn = ctx.worldToMap(ctx.camera.position);
    ctx.setCheatStatus(`Level ${serverLevel + 1}`);
  }
  ctx.setPortalActive(world.portalActive);
}

// ---------------------------------------------------------------------------
// syncPoisonCloudVisuals — reconcile local visuals with server state
// ---------------------------------------------------------------------------
export function syncPoisonCloudVisuals(ctx: GameContext): void {
  if (!ctx.multiplayerSync) return;
  const serverClouds = ctx.multiplayerSync.getPoisonCloudPositions();

  // Remove visuals for clouds no longer on the server
  for (const [id, visual] of ctx.poisonCloudVisuals) {
    if (!serverClouds.has(id)) {
      disposePoisonCloudVisualModule(visual);
      ctx.poisonCloudVisuals.delete(id);
    }
  }

  // Create visuals for new server clouds
  for (const [id, cloud] of serverClouds) {
    if (!ctx.poisonCloudVisuals.has(id)) {
      const pos = new Vector3(cloud.x, cloud.y, cloud.z);
      ctx.poisonCloudVisuals.set(
        id,
        createPoisonCloudVisualModule(pos, ctx.scene, ctx.particleTextures),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// updateServerDebugPanel — refresh the debug overlay with server info
// ---------------------------------------------------------------------------
export function updateServerDebugPanel(ctx: GameContext): void {
  if (!ctx.multiplayerSync) {
    serverDebugStateEl.textContent = "State: Disabled";
    serverDebugAuthEl.textContent = "Auth: No session";
    serverDebugLobbyEl.textContent = "Lobby: n/a";
    serverDebugRoomEl.textContent = "Room: n/a";
    serverDebugPlayersEl.textContent = "Players: 0";
    serverDebugUrlEl.textContent = "URL: n/a";
    return;
  }

  try {
    const info = ctx.multiplayerSync.getDebugInfo();
    serverDebugStateEl.textContent = `State: ${info.state}`;
    serverDebugAuthEl.textContent = `Auth: ${info.auth}`;
    serverDebugLobbyEl.textContent = `Lobby: ${info.lobby}`;
    serverDebugRoomEl.textContent = `Room: ${info.room}`;
    serverDebugPlayersEl.textContent = `Players: ${info.players}`;
    serverDebugUrlEl.textContent = `URL: ${info.url}`;
  } catch (error) {
    serverDebugStateEl.textContent = "State: Debug error";
    console.error("Server debug panel update failed", error);
  }
}
