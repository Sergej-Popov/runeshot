import {
  bossHudEl,
  enemyEl,
  grenadeChargeHudEl,
  grenadesEl,
  healthBarEl,
  healthTextEl,
  levelEl,
  manaBarEl,
  manaTextEl,
  smokeGrenadesEl,
  staminaBarEl,
  staminaTextEl,
  weaponEl,
} from "../../dom";

type HudState = {
  health: number;
  mana: number;
  playersOnline: number;
  status: string;
};

const MAX_MANA = 220;

export class HudController {
  update(state: HudState): void {
    healthTextEl.textContent = `Health: ${state.health}`;
    healthBarEl.style.width = `${Math.max(0, Math.min(100, state.health))}%`;

    staminaTextEl.textContent = "Stamina: Server";
    staminaBarEl.style.width = "100%";

    manaTextEl.textContent = `Mana: ${state.mana}/${MAX_MANA}`;
    manaBarEl.style.width = `${Math.max(0, Math.min(100, (state.mana / MAX_MANA) * 100))}%`;

    levelEl.textContent = "Mode: Multiplayer";
    grenadesEl.textContent = "Grenades: Disabled";
    smokeGrenadesEl.textContent = "Smoke: Disabled";
    weaponEl.textContent = "Weapon: Carbine";
    enemyEl.textContent = `${state.status} | Pilots Online: ${state.playersOnline}`;

    bossHudEl.classList.add("hidden");
    grenadeChargeHudEl.classList.add("hidden");
  }
}
