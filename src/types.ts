export type WeaponMode = "gun" | "cannon" | "minigun";

export interface Position {
  x: number;
  y: number;
}

export interface LevelConfig {
  playerSpawn: Position;
  portal: Position;
  enemyCount: number;
  platformChallenge?: boolean;
  bossFight?: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
  z: number;
  vz: number;
  onGround: boolean;
  speed: number;
  turnSpeed: number;
  radius: number;
  maxHealth: number;
  health: number;
  ammo: number;
  hasCannon: boolean;
  hasMinigun: boolean;
  weaponMode: WeaponMode;
  safeX: number;
  safeY: number;
}

export interface Enemy {
  type: "normal" | "boss" | "kitten";
  x: number;
  y: number;
  radius: number;
  speed: number;
  health: number;
  maxHealth: number;
  meleeDamage: number;
  meleeRange: number;
  meleeCooldownBase: number;
  meleeCooldown: number;
  canShoot: boolean;
  rangedCooldownBase: number;
  rangedCooldownJitter: number;
  rangedCooldown: number;
  shotSpeed: number;
  shotDamage: number;
  canSpawnKittens: boolean;
  kittenSpawnCooldown: number;
  kittenSpawnRate: number;
  maxKittens: number;
  alive: boolean;
}

export interface EnemyShot {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  life: number;
  damage: number;
  radius: number;
  tint?: string;
}

export interface Pickup {
  type: "health" | "ammo" | "bossWeapon";
  x: number;
  y: number;
  radius: number;
  amount: number;
  alive: boolean;
}

export interface CannonBurst {
  x: number;
  y: number;
  power: number;
  life: number;
  maxLife: number;
}

export interface Portal {
  x: number;
  y: number;
  radius: number;
}

export interface InputState {
  KeyW: boolean;
  KeyA: boolean;
  KeyS: boolean;
  KeyD: boolean;
  ArrowLeft: boolean;
  ArrowRight: boolean;
  Space: boolean;
  jumpRequested: boolean;
  MouseLeft: boolean;
  shootRequested: boolean;
}
