function requiredById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element #${id}`);
  return el as T;
}

export const canvas = requiredById<HTMLCanvasElement>("game");
export const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Failed to initialize 2D canvas context");

export const healthTextEl = requiredById<HTMLElement>("healthText");
export const healthBarEl = requiredById<HTMLElement>("healthBar");
export const levelEl = requiredById<HTMLElement>("level");
export const ammoEl = requiredById<HTMLElement>("ammo");
export const weaponEl = requiredById<HTMLElement>("weapon");
export const enemyEl = requiredById<HTMLElement>("enemy");
export const bossHudEl = requiredById<HTMLElement>("bossHud");
export const bossTextEl = requiredById<HTMLElement>("bossText");
export const bossBarEl = requiredById<HTMLElement>("bossBar");
export const cheatConsoleEl = requiredById<HTMLElement>("cheatConsole");
export const cheatStatusEl = requiredById<HTMLElement>("cheatStatus");
export const cheatBadgesEl = requiredById<HTMLElement>("cheatBadges");
export const cheatHistoryEl = requiredById<HTMLElement>("cheatHistory");
export const cheatInputEl = requiredById<HTMLInputElement>("cheatInput");
