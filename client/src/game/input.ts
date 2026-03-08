/**
 * Input bindings — extracted from main.ts.
 *
 * Sets up keyboard, mouse, and pointer-lock event listeners.
 * All game-state reads/writes go through `ctx: GameContext`.
 */

import { canvas, cheatInputEl } from "../dom";
import { initAudio, toggleMusic } from "../audio";
import { FN_KEY_CHEAT_MAP } from "./runtime/cheats";
import { MINIMAP_SIZES } from "./runtime/constants";
import { POTION_KINDS, type InputState } from "./runtime/types";
import type { GameContext } from "./runtime/gameContext";

export function setupInputBindings(ctx: GameContext): void {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      ctx.useSelectedPotion();
      return;
    }

    if (e.code === "Backquote") {
      e.preventDefault();
      ctx.toggleCheatConsole();
      return;
    }

    if (e.code === "F9") {
      e.preventDefault();
      ctx.toggleHandsDebugPanel();
      return;
    }

    const cheatFromFn = FN_KEY_CHEAT_MAP[e.code];
    if (cheatFromFn) {
      e.preventDefault();
      ctx.runCheat(cheatFromFn);
      return;
    }

    if (ctx.cheatOpen) return;

    if (e.code in ctx.input) {
      ctx.input[e.code as keyof InputState] = true;
      if (e.code === "Space") ctx.jumpQueued = true;
      return;
    }

    if (e.code === "KeyE") {
      ctx.toggleRune();
      return;
    }

    if (e.code === "KeyM") {
      toggleMusic();
      return;
    }

    if (e.code === "KeyN") {
      ctx.minimapSizeIndex = (ctx.minimapSizeIndex + 1) % MINIMAP_SIZES.length;
      ctx.applyMinimapSize();
      return;
    }

    if (e.code === "KeyR") {
      ctx.resetRun();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code in ctx.input) ctx.input[e.code as keyof InputState] = false;
  });

  window.addEventListener("mousedown", (e) => {
    if (ctx.cheatOpen) return;
    initAudio();
    ctx.tryAcquirePointerLock();

    if (e.button === 0) {
      ctx.input.MouseLeft = true;
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
    }

    if (e.button === 1) {
      e.preventDefault();
      ctx.useSelectedPotion();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) ctx.input.MouseLeft = false;
    if (e.button === 2) {
      e.preventDefault();
    }
  });

  window.addEventListener("wheel", (e) => {
    if (ctx.cheatOpen) return;
    if (e.deltaY > 0) {
      ctx.selectedPotionIndex = (ctx.selectedPotionIndex + 1) % POTION_KINDS.length;
    } else if (e.deltaY < 0) {
      ctx.selectedPotionIndex =
        (ctx.selectedPotionIndex - 1 + POTION_KINDS.length) % POTION_KINDS.length;
    }
    ctx.updateHud();
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (ctx.cheatOpen) return;
    const dragTurning = (e.buttons & 1) === 1;
    if (!ctx.pointerLocked && !dragTurning) return;
    ctx.yaw += e.movementX * 0.0026;
    ctx.pitch += e.movementY * 0.0022;
    ctx.pitch = Math.max(-1.28, Math.min(1.28, ctx.pitch));
  });

  document.addEventListener("pointerlockchange", () => {
    ctx.pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener("pointerlockerror", () => {
    ctx.pointerLocked = false;
    ctx.setCheatStatus("Pointer lock blocked. Hold left mouse and drag to turn.");
  });

  canvas.addEventListener("click", () => {
    initAudio();
    ctx.tryAcquirePointerLock();
  });

  cheatInputEl.addEventListener("keydown", (e) => {
    if (e.code === "Enter") {
      e.preventDefault();
      ctx.runCheat(cheatInputEl.value);
      cheatInputEl.select();
      return;
    }

    if (e.code === "Escape" || e.code === "Backquote") {
      e.preventDefault();
      ctx.toggleCheatConsole();
    }
  });
}
