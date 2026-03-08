/**
 * Cheats UI — cheat console toggle & cheat execution — extracted from main.ts.
 *
 * Every function takes `ctx: GameContext`.
 */
import type { GameContext } from "../runtime/gameContext";
import type { InputState } from "../runtime/types";
import { parseCheatCommand, CHEAT_HELP_TEXT } from "../runtime/cheats";
import { MAX_MANA, MAX_STAMINA, INFERNO_MAX_FUEL } from "../runtime/constants";
import { LEVELS } from "../state";
import {
  canvas,
  cheatConsoleEl,
  cheatInputEl,
} from "../../dom";

// ── Toggle cheat console ────────────────────────────────────────────────────

export function toggleCheatConsole(ctx: GameContext): void {
  ctx.cheatOpen = !ctx.cheatOpen;
  cheatConsoleEl.classList.toggle("hidden", !ctx.cheatOpen);
  if (ctx.cheatOpen) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    ctx.pointerLocked = false;
    Object.keys(ctx.input).forEach((k) => {
      ctx.input[k as keyof InputState] = false;
    });
    cheatInputEl.value = "";
    cheatInputEl.focus();
    ctx.setCheatStatus("Type a cheat and press Enter");
  } else {
    cheatInputEl.blur();
  }
}

// ── Execute cheat command ───────────────────────────────────────────────────

export function runCheat(ctx: GameContext, raw: string): void {
  const action = parseCheatCommand(raw, LEVELS.length);
  if (action === null) {
    ctx.setCheatStatus("Enter a cheat code");
    return;
  }

  switch (action.kind) {
    case "help":
      ctx.setCheatStatus(CHEAT_HELP_TEXT);
      ctx.addCheatHistory("/help", "listed cheats");
      return;

    case "meow":
      ctx.hasIceShard = true;
      ctx.runeMode = "ice-shard";
      ctx.mana = Math.min(MAX_MANA, ctx.mana + 100);
      ctx.setCheatStatus("Ice Shard unlocked");
      ctx.addCheatHistory("meow", "ice-shard");
      ctx.updateHud();
      return;

    case "burn":
      ctx.hasInferno = true;
      ctx.infernoFuel = INFERNO_MAX_FUEL;
      ctx.runeMode = "inferno";
      ctx.setCheatStatus("Inferno unlocked");
      ctx.addCheatHistory("burn", "inferno");
      ctx.updateHud();
      return;

    case "furball":
      ctx.godMode = !ctx.godMode;
      ctx.setCheatStatus(`Infinite health ${ctx.godMode ? "ON" : "OFF"}`);
      ctx.addCheatHistory("furball", ctx.godMode ? "on" : "off");
      ctx.updateHud();
      return;

    case "catnip":
      ctx.health = ctx.maxHealth;
      ctx.mana = MAX_MANA;
      ctx.stamina = MAX_STAMINA;
      ctx.sprintExhausted = false;
      ctx.setCheatStatus("Health and mana maxed");
      ctx.addCheatHistory("catnip", "restored");
      ctx.updateHud();
      return;

    case "zoomies":
      ctx.speedBoost = !ctx.speedBoost;
      ctx.setCheatStatus(`Speed boost ${ctx.speedBoost ? "ON" : "OFF"}`);
      ctx.addCheatHistory("zoomies", ctx.speedBoost ? "on" : "off");
      ctx.updateHud();
      return;

    case "hiss":
      ctx.clearEnemiesCheat();
      ctx.setCheatStatus("Level cleared");
      ctx.addCheatHistory("hiss", "cleared");
      ctx.updateHud();
      return;

    case "resetcheats":
      ctx.speedBoost = false;
      ctx.godMode = false;
      ctx.hasIceShard = false;
      if (ctx.runeMode === "ice-shard") ctx.runeMode = ctx.hasLightningBolt ? "lightning-bolt" : "fireball";
      ctx.setCheatStatus("Cheats reset");
      ctx.addCheatHistory("resetcheats", "off");
      ctx.updateHud();
      return;

    case "nap":
      ctx.startLevel(action.level, false);
      ctx.setCheatStatus(`Jumped to level ${action.level + 1}`);
      ctx.addCheatHistory(raw.trim().toLowerCase(), `level ${action.level + 1}`);
      return;

    case "unknown":
      ctx.setCheatStatus("Unknown cheat");
      ctx.addCheatHistory(raw.trim().toLowerCase(), "unknown");
      return;
  }
}
