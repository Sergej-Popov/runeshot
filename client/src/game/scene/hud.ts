/**
 * HUD rendering & minimap — extracted from main.ts.
 *
 * All functions take `ctx: GameContext` and read DOM elements directly from
 * the dom module (same as main.ts did).
 */
import { Vector3 } from "@babylonjs/core";
import type { GameContext } from "../runtime/gameContext";
import {
  bossBarEl,
  bossHudEl,
  bossTextEl,
  cheatBadgesEl,
  cheatHistoryEl,
  cheatStatusEl,
  enemyEl,
  healthBarEl,
  healthTextEl,
  levelEl,
  manaBarEl,
  manaTextEl,
  minimapCtx,
  minimapEl,
  runeEl,
  staminaBarEl,
  staminaTextEl,
  potionSlotEls,
  potionCountEls,
  speedCooldownEl,
} from "../../dom";
import { LEVELS, cellKindForLevel } from "../state";
import { POTION_KINDS } from "../runtime/types";
import { runeDisplayName } from "../runtime/runes";
import { freezeRecoveryFraction } from "../runtime/freezeIndicator";
import {
  FREEZE_DURATION,
  MAP_H,
  MAP_W,
  MAX_MANA,
  MAX_STAMINA,
  MINIMAP_SIZES,
  SPEED_BOOST_DURATION,
} from "../runtime/constants";

// ── Cheat badges / history ──────────────────────────────────────────────────

export function setCheatStatus(text: string): void {
  cheatStatusEl.textContent = text;
}

export function addCheatHistory(ctx: GameContext, command: string, result: string): void {
  ctx.cheatHistory.unshift(`${command} -> ${result}`);
  if (ctx.cheatHistory.length > 4) ctx.cheatHistory.length = 4;
  cheatHistoryEl.innerHTML = ctx.cheatHistory.map((row) => `<div>${row}</div>`).join("");
}

export function updateCheatBadges(ctx: GameContext): void {
  const badges: string[] = [];
  if (ctx.godMode) badges.push("FURBALL");
  if (ctx.speedBoost) badges.push("ZOOMIES");
  if (ctx.hasIceShard) badges.push("MEOW");
  cheatBadgesEl.classList.toggle("hidden", badges.length === 0);
  cheatBadgesEl.innerHTML = badges.map((b) => `<span class="cheat-badge">${b}</span>`).join("");
}

// ── Main HUD update ─────────────────────────────────────────────────────────

export function updateHud(ctx: GameContext): void {
  const hp = Math.max(0, Math.floor(ctx.health));
  healthTextEl.textContent = `Health: ${hp}`;
  healthBarEl.style.width = `${Math.max(0, Math.min(100, (ctx.health / ctx.maxHealth) * 100))}%`;
  healthBarEl.classList.toggle("poisoned", ctx.isPlayerPoisoned);
  const staminaPct = Math.max(0, Math.min(100, (ctx.stamina / MAX_STAMINA) * 100));
  staminaTextEl.textContent = `Stamina: ${Math.round(staminaPct)}%`;
  staminaBarEl.style.width = `${staminaPct}%`;
  staminaBarEl.classList.toggle("speed-boosted", ctx.isPlayerSpeedBoosted);
  staminaBarEl.classList.toggle("frozen", ctx.isPlayerFrozen);
  if (ctx.isPlayerFrozen) {
    if (ctx.freezeStartedAt <= 0) ctx.freezeStartedAt = performance.now();
    const recovered = freezeRecoveryFraction(performance.now(), ctx.freezeStartedAt, FREEZE_DURATION);
    const yellowPct = Math.round(recovered * 1000) / 10;
    staminaBarEl.style.background =
      `linear-gradient(90deg, #c8a820 0%, #e8d44a ${yellowPct}%, #36a8ff ${yellowPct}%, #6ce7ff 100%)`;
  } else {
    staminaBarEl.style.background = "";
  }
  levelEl.textContent = ctx.multiplayerRespawnSeconds > 0
    ? `Respawn: ${ctx.multiplayerRespawnSeconds}s`
    : `Level: ${ctx.currentLevel + 1}/${LEVELS.length}`;
  manaTextEl.textContent = `Mana: ${Math.floor(ctx.mana)}/${MAX_MANA}`;
  manaBarEl.style.width = `${Math.max(0, Math.min(100, (ctx.mana / MAX_MANA) * 100))}%`;
  runeEl.textContent = `Rune: ${runeDisplayName(ctx.runeMode, ctx.infernoFuel)}`;

  const alive = ctx.enemies.filter((e) => e.health > 0).length;
  if (ctx.multiplayerSync) {
    if (ctx.multiplayerRespawnSeconds > 0) {
      enemyEl.textContent = `You died. Respawning in ${ctx.multiplayerRespawnSeconds}s`;
    } else {
      enemyEl.textContent = ctx.portalActive ? "Portal: Enter!" : `Server Cats: ${ctx.multiplayerSync.getServerCatCount()}`;
    }
  } else {
    enemyEl.textContent = ctx.portalActive ? "Portal: Enter!" : `Cat Fiends: ${alive}/${ctx.enemies.length}`;
  }

  const boss = ctx.enemies.find((e) => e.type === "boss" && e.health > 0);
  bossHudEl.classList.toggle("hidden", !boss);
  if (boss) {
    bossTextEl.textContent = `Boss HP: ${Math.ceil(boss.health)}/${Math.ceil(boss.maxHealth)}`;
    bossBarEl.style.width = `${Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100))}%`;
  }

  updateCheatBadges(ctx);

  // Update potion belt
  for (let i = 0; i < POTION_KINDS.length; i += 1) {
    const kind = POTION_KINDS[i];
    const count = ctx.potionInventory[kind];
    potionCountEls[i].textContent = `x${count}`;
    potionSlotEls[i].classList.toggle("selected", i === ctx.selectedPotionIndex);
    potionSlotEls[i].classList.toggle("empty", count <= 0);
  }

  // Speed boost radial cooldown indicator
  if (ctx.isPlayerSpeedBoosted && ctx.speedBoostStartedAt > 0) {
    const elapsed = performance.now() - ctx.speedBoostStartedAt;
    const fraction = Math.min(1, elapsed / SPEED_BOOST_DURATION);
    const deg = Math.round(fraction * 360);
    speedCooldownEl.style.background =
      `conic-gradient(transparent ${deg}deg, rgba(0,0,0,0.55) ${deg}deg)`;
    speedCooldownEl.style.display = "block";
  } else {
    speedCooldownEl.style.display = "none";
  }
}

// ── Minimap size ────────────────────────────────────────────────────────────

export function applyMinimapSize(ctx: GameContext): void {
  const size = MINIMAP_SIZES[ctx.minimapSizeIndex];
  minimapEl.width = size;
  minimapEl.height = size;
  minimapEl.style.width = `${size}px`;
  minimapEl.style.height = `${size}px`;
}

// ── Minimap draw ────────────────────────────────────────────────────────────

export function drawMinimap(ctx: GameContext): void {
  const size = minimapEl.width;
  const cell = size / MAP_W;
  const toMiniY = (mapY: number): number => size - mapY * cell;

  minimapCtx.clearRect(0, 0, size, size);
  minimapCtx.fillStyle = "rgba(10, 14, 20, 0.9)";
  minimapCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (ctx.isWallAt(x, y)) {
        minimapCtx.fillStyle = "#5b6476";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
        continue;
      }
      const kind = cellKindForLevel(ctx.currentLevel, x, y);
      if (kind === "pit") {
        minimapCtx.fillStyle = "#131313";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      } else if (kind === "trampoline") {
        minimapCtx.fillStyle = "#29d4bd";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      } else if (kind === "stairs") {
        minimapCtx.fillStyle = "#9f8a62";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      } else if (kind === "platform") {
        minimapCtx.fillStyle = "#8a6543";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      }
    }
  }

  if (ctx.portalMesh && ctx.portalMesh.isVisible) {
    const mp = ctx.worldToMap(ctx.portalMesh.position);
    minimapCtx.fillStyle = "#22d4ff";
    minimapCtx.beginPath();
    minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(3, cell * 0.28), 0, Math.PI * 2);
    minimapCtx.fill();
  }

  for (const enemy of ctx.enemies) {
    if (enemy.health <= 0) continue;
    const mp = ctx.worldToMap(enemy.mesh.position);
    minimapCtx.fillStyle = enemy.type === "boss" ? "#ff5a2f" : enemy.type === "kitten" ? "#ffd17a" : "#ff7a7a";
    minimapCtx.beginPath();
    minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(2.5, cell * 0.22), 0, Math.PI * 2);
    minimapCtx.fill();
  }

  if (ctx.multiplayerSync) {
    const catMarkers = ctx.multiplayerSync.getRemoteCatMinimapMarkers();
    for (const marker of catMarkers) {
      const mp = ctx.worldToMap(new Vector3(marker.x, 0, marker.z));
      minimapCtx.fillStyle = "#ffd17a";
      minimapCtx.beginPath();
      minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(2.8, cell * 0.24), 0, Math.PI * 2);
      minimapCtx.fill();
    }

    const remoteMarkers = ctx.multiplayerSync.getRemoteMinimapMarkers();
    for (const marker of remoteMarkers) {
      const mp = ctx.worldToMap(new Vector3(marker.x, 0, marker.z));
      minimapCtx.fillStyle = "#ff3b3b";
      minimapCtx.beginPath();
      minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(2.8, cell * 0.24), 0, Math.PI * 2);
      minimapCtx.fill();
    }
  }

  const p = ctx.worldToMap(ctx.camera.position);
  minimapCtx.fillStyle = "#22a7ff";
  minimapCtx.beginPath();
  minimapCtx.arc(p.x * cell, toMiniY(p.y), Math.max(3, cell * 0.24), 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.strokeStyle = "#22a7ff";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(p.x * cell, toMiniY(p.y));
  minimapCtx.lineTo((p.x + Math.sin(ctx.yaw) * 0.9) * cell, toMiniY(p.y + Math.cos(ctx.yaw) * 0.9));
  minimapCtx.stroke();
}
