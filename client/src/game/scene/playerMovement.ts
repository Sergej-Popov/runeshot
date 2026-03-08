/**
 * Player movement, gravity, collision, sprint, and per-frame state updates
 * — extracted from main.ts.
 *
 * `updatePlayer(ctx, dt)` is called once per frame from the game loop.
 */
import { Vector3 } from "@babylonjs/core";
import type { GameContext } from "../runtime/gameContext";
import { SERVER_AUTHORITATIVE_ONLY } from "../featureFlags";
import {
  EYE_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  MANA_RECOVER_PER_SEC,
  MAX_MANA,
  MAX_STAMINA,
  PIT_DEPTH,
  SPEED_BOOST_MULT,
  SPRINT_SPEED,
  STAMINA_DRAIN_PER_SEC,
  STAMINA_RECOVER_PER_SEC,
  STAMINA_RECOVER_UNLOCK,
  WALK_SPEED,
} from "../runtime/constants";
import {
  applyHandsRigTransform as applyHandsRigTransformModule,
  getActiveCastHandNode as getActiveCastHandNodeModule,
} from "./hands";
import { updateInfernoStreamVisual } from "./projectiles";

export function updatePlayer(ctx: GameContext, dt: number): void {
  const { input, camera } = ctx;

  const turnDir = (input.ArrowRight ? 1 : 0) - (input.ArrowLeft ? 1 : 0);
  if (turnDir !== 0) ctx.yaw += turnDir * dt * 2.2;

  const fwd = new Vector3(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
  const right = new Vector3(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw));

  const moveAxisZ = (input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0);
  const moveAxisX = (input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0);

  const wanted = fwd.scale(moveAxisZ).add(right.scale(moveAxisX));
  if (wanted.lengthSquared() > 0.001) {
    wanted.normalize();
    const sprintHeld = input.ShiftLeft || input.ShiftRight;
    const canSprint = sprintHeld && !ctx.sprintExhausted && ctx.stamina > 0 && !ctx.isPlayerFrozen;
    const sprinting = canSprint;
    let speedPerSec = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (ctx.speedBoost) speedPerSec *= SPEED_BOOST_MULT;
    if (ctx.isPlayerFrozen) speedPerSec *= 0.4;
    const speed = speedPerSec * dt;

    if (sprinting) {
      if (!ctx.isPlayerSpeedBoosted) {
        ctx.stamina = Math.max(0, ctx.stamina - STAMINA_DRAIN_PER_SEC * dt);
        if (ctx.stamina <= 0.001) {
          ctx.stamina = 0;
          ctx.sprintExhausted = true;
        }
      }
    } else {
      ctx.stamina = Math.min(MAX_STAMINA, ctx.stamina + STAMINA_RECOVER_PER_SEC * dt);
      if (ctx.sprintExhausted && ctx.stamina >= STAMINA_RECOVER_UNLOCK) ctx.sprintExhausted = false;
    }

    const currentFloor = ctx.floorHeightAtWorld(camera.position);

    const tryX = camera.position.add(new Vector3(wanted.x * speed, 0, 0));
    const mapX = ctx.worldToMap(tryX);
    if (ctx.canOccupyMap(mapX.x, mapX.y)) {
      const floorX = ctx.floorHeightAtMap(mapX.x, mapX.y);
      if (floorX - currentFloor <= 0.65 || !ctx.isGrounded) camera.position.x = tryX.x;
    }

    const tryZ = camera.position.add(new Vector3(0, 0, wanted.z * speed));
    const mapZ = ctx.worldToMap(tryZ);
    if (ctx.canOccupyMap(mapZ.x, mapZ.y)) {
      const floorZ = ctx.floorHeightAtMap(mapZ.x, mapZ.y);
      if (floorZ - currentFloor <= 0.65 || !ctx.isGrounded) camera.position.z = tryZ.z;
    }

    ctx.gunBobTime += dt * 8;
  } else {
    ctx.stamina = Math.min(MAX_STAMINA, ctx.stamina + STAMINA_RECOVER_PER_SEC * dt);
    if (ctx.sprintExhausted && ctx.stamina >= STAMINA_RECOVER_UNLOCK) ctx.sprintExhausted = false;
  }

  // Jump
  if (ctx.jumpQueued && ctx.isGrounded && !ctx.gameOver && !ctx.victory) {
    ctx.verticalVelocity = JUMP_VELOCITY;
    ctx.isGrounded = false;
  }
  ctx.jumpQueued = false;

  // Gravity + ground check
  ctx.verticalVelocity -= GRAVITY * dt;
  camera.position.y += ctx.verticalVelocity * dt;

  const floor = ctx.floorHeightAtWorld(camera.position) + EYE_HEIGHT;
  if (camera.position.y <= floor) {
    camera.position.y = floor;
    const onTrampoline = ctx.isOnTrampolinePad(camera.position);
    if (onTrampoline && !ctx.trampolineLock && !ctx.gameOver && !ctx.victory) {
      ctx.verticalVelocity = JUMP_VELOCITY * 1.45;
      ctx.isGrounded = false;
      ctx.trampolineLock = true;
    } else {
      ctx.verticalVelocity = 0;
      ctx.isGrounded = true;
      if (!onTrampoline) ctx.trampolineLock = false;
    }
  } else {
    ctx.isGrounded = false;
    ctx.trampolineLock = false;
  }

  // Safe spawn tracking
  if (ctx.isGrounded && ctx.floorHeightAtWorld(camera.position) >= 0) {
    const map = ctx.worldToMap(camera.position);
    ctx.safeSpawn = { x: map.x, y: map.y };
  }

  // Pit death
  if (camera.position.y < PIT_DEPTH + EYE_HEIGHT - 0.2) {
    ctx.damagePlayer(14);
    ctx.resetPlayerAtSpawn();
  }

  // Camera rotation
  camera.rotation = new Vector3(ctx.pitch, ctx.yaw, 0);

  // Cooldowns + mana regen
  if (ctx.fireCooldown > 0) ctx.fireCooldown -= dt;
  if (ctx.potionCooldown > 0) ctx.potionCooldown -= dt;
  if (!SERVER_AUTHORITATIVE_ONLY && !ctx.multiplayerSync && !ctx.gameOver && !ctx.victory) {
    ctx.mana = Math.min(MAX_MANA, ctx.mana + MANA_RECOVER_PER_SEC * dt);
  }

  // Inferno visual + fire trigger
  const flameActive = ctx.runeMode === "inferno" && input.MouseLeft && !ctx.cheatOpen && ctx.infernoFuel > 0;
  updateInfernoStreamVisual(ctx, flameActive);
  if (input.MouseLeft && !ctx.cheatOpen && ctx.fireCooldown <= 0) ctx.fireRune();

  // Recoil + bob + hand animation
  ctx.recoil = Math.max(0, ctx.recoil - dt * 0.75);
  if (ctx.rightHandWaveTime > 0) ctx.rightHandWaveTime = Math.max(0, ctx.rightHandWaveTime - dt);
  if (ctx.handsRoot) {
    const bob = wanted.lengthSquared() > 0.001 ? Math.sin(ctx.gunBobTime) * 0.015 : 0;
    applyHandsRigTransformModule(ctx, bob, ctx.recoil * 0.35);
  }
  if (ctx.leftHandWaveNode) {
    ctx.leftHandWaveNode.position.copyFrom(ctx.LEFT_HAND_ANCHOR_POS);
    ctx.leftHandWaveNode.rotation.x = 0;
  }
  if (ctx.rightHandWaveNode) {
    ctx.rightHandWaveNode.position.copyFrom(ctx.RIGHT_HAND_ANCHOR_POS);
    ctx.rightHandWaveNode.rotation.x = 0;
  }
  const castHandNode = getActiveCastHandNodeModule(ctx);
  if (castHandNode) {
    const waveNorm = Math.max(0, Math.min(1, ctx.rightHandWaveTime / 0.22));
    const wave = Math.sin((1 - waveNorm) * Math.PI);
    castHandNode.position.z = 0.05 + wave * 0.22 + ctx.recoil * 0.08;
    castHandNode.rotation.x = -wave * 0.26;
  }
}
