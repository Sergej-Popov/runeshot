import type { Enemy, LevelConfig, PlayerState, Position } from "./types";

export const MAP = [
  "################",
  "#..............#",
  "#..####........#",
  "#..............#",
  "#......####....#",
  "#..............#",
  "#...#..........#",
  "#...#.....######",
  "#...#..........#",
  "#..............#",
  "#......#.......#",
  "#......#.......#",
  "#..............#",
  "#..............#",
  "#..............#",
  "################",
];

export const MAP_W = MAP[0].length;
export const MAP_H = MAP.length;

export const FOV = Math.PI / 3;
export const HALF_FOV = FOV / 2;
export const RAY_COUNT = 320;
export const MAX_DEPTH = 24;

export const PLAYER: PlayerState = {
  x: 2.2,
  y: 2.2,
  angle: 0,
  z: 0,
  vz: 0,
  onGround: true,
  speed: 3.5,
  turnSpeed: 2.2,
  radius: 0.2,
  maxHealth: 100,
  health: 100,
  ammo: 40,
  hasCannon: false,
  hasMinigun: false,
  weaponMode: "gun",
  safeX: 2.2,
  safeY: 2.2,
};

export const LEVELS: LevelConfig[] = [
  { playerSpawn: { x: 2.2, y: 2.2 }, portal: { x: 13.5, y: 13.5 }, enemyCount: 4 },
  { playerSpawn: { x: 2.2, y: 13.2 }, portal: { x: 13.5, y: 2.5 }, enemyCount: 6 },
  { playerSpawn: { x: 13.2, y: 2.2 }, portal: { x: 2.5, y: 13.5 }, enemyCount: 8 },
  { playerSpawn: { x: 2.6, y: 8.0 }, portal: { x: 13.5, y: 8.5 }, enemyCount: 8, platformChallenge: true },
  { playerSpawn: { x: 2.4, y: 8.0 }, portal: { x: 13.5, y: 8.5 }, enemyCount: 1, bossFight: true },
  { playerSpawn: { x: 12.8, y: 8.0 }, portal: { x: 2.5, y: 8.5 }, enemyCount: 12 },
  { playerSpawn: { x: 8.0, y: 13.2 }, portal: { x: 8.0, y: 2.4 }, enemyCount: 14 },
];

export const SPAWN_POINTS: Position[] = [
  { x: 11.5, y: 10.5 },
  { x: 12.5, y: 3.5 },
  { x: 8.5, y: 12.5 },
  { x: 4.5, y: 9.5 },
  { x: 3.5, y: 5.5 },
  { x: 6.5, y: 2.5 },
  { x: 10.5, y: 6.5 },
  { x: 13.2, y: 11.2 },
  { x: 9.5, y: 4.5 },
  { x: 5.5, y: 13.2 },
  { x: 2.8, y: 10.8 },
  { x: 12.8, y: 8.2 },
];

export const PICKUP_POINTS: Position[] = [
  { x: 3.2, y: 3.2 },
  { x: 6.8, y: 3.4 },
  { x: 10.8, y: 3.6 },
  { x: 13.0, y: 6.0 },
  { x: 12.6, y: 10.6 },
  { x: 9.2, y: 12.6 },
  { x: 5.0, y: 12.8 },
  { x: 3.0, y: 9.6 },
  { x: 7.8, y: 8.0 },
  { x: 11.5, y: 7.8 },
];

export const PLATFORM_LEVEL_INDEX = 3;
export const PLATFORM_PADS = new Set<string>();
for (const x of [4, 6, 8, 10, 12]) {
  PLATFORM_PADS.add(`${x},8`);
  PLATFORM_PADS.add(`${x},7`);
}

export const PLATFORM_PITS = new Set<string>();
for (let x = 3; x <= 12; x += 1) {
  for (let y = 7; y <= 9; y += 1) {
    const k = `${x},${y}`;
    if (!PLATFORM_PADS.has(k)) PLATFORM_PITS.add(k);
  }
}

export const PLATFORM_PAD_LIST = Array.from(PLATFORM_PADS).map((k) => {
  const [x, y] = k.split(",").map(Number);
  return { x: x + 0.5, y: y + 0.5 };
});

export const PLATFORM_PIT_LIST = Array.from(PLATFORM_PITS).map((k) => {
  const [x, y] = k.split(",").map(Number);
  return { x: x + 0.5, y: y + 0.5 };
});

export const ENEMY_TEMPLATE: Enemy = {
  type: "normal",
  x: 0,
  y: 0,
  radius: 0.3,
  speed: 1.0,
  health: 2,
  maxHealth: 2,
  meleeDamage: 9,
  meleeRange: 1.15,
  meleeCooldownBase: 0.9,
  canShoot: true,
  shotSpeed: 6,
  shotDamage: 8,
  canSpawnKittens: false,
  kittenSpawnCooldown: 0,
  kittenSpawnRate: 4.5,
  maxKittens: 0,
  meleeCooldown: 0,
  rangedCooldownBase: 0,
  rangedCooldownJitter: 0,
  rangedCooldown: 0,
  alive: true,
};

export const GRAVITY = 15;
export const JUMP_VELOCITY = 8.5;
export const MINIMAP_SIZES = [140, 170, 220];
