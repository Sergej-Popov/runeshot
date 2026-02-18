import {
  ammoEl,
  bossHudEl,
  enemyEl,
  grenadeChargeHudEl,
  grenadesEl,
  healthBarEl,
  healthTextEl,
  levelEl,
  smokeGrenadesEl,
  staminaBarEl,
  staminaTextEl,
  weaponEl,
} from "../../dom";

type HudState = {
  health: number;
  ammo: number;
  playersOnline: number;
  status: string;
};

export class HudController {
  update(state: HudState): void {
    healthTextEl.textContent = `Health: ${state.health}`;
    healthBarEl.style.width = `${Math.max(0, Math.min(100, state.health))}%`;

    staminaTextEl.textContent = "Stamina: Server";
    staminaBarEl.style.width = "100%";

    levelEl.textContent = "Mode: Multiplayer";
    ammoEl.textContent = `Ammo: ${state.ammo}`;
    grenadesEl.textContent = "Grenades: Disabled";
    smokeGrenadesEl.textContent = "Smoke: Disabled";
    weaponEl.textContent = "Weapon: Carbine";
    enemyEl.textContent = `${state.status} | Pilots Online: ${state.playersOnline}`;

    bossHudEl.classList.add("hidden");
    grenadeChargeHudEl.classList.add("hidden");
  }
}
