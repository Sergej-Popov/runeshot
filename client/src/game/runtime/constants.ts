import { MAP, PIT_FLOOR_HEIGHT } from "../state";

export const TILE_SIZE = 2;
export const MAP_W = MAP[0].length;
export const MAP_H = MAP.length;
export const EYE_HEIGHT = 1.35;
export const WALL_HEIGHT = 3.8;
export const PLAYER_RADIUS = 0.22;
export const GRAVITY = 19;
export const JUMP_VELOCITY = 8.2;
export const WALK_SPEED = 4.2;
export const SPRINT_SPEED = 5.7 * 1.3;
export const SPEED_BOOST_MULT = 1.2;
export const MAX_STAMINA = 5;
export const STAMINA_DRAIN_PER_SEC = 1;
export const STAMINA_RECOVER_PER_SEC = 1;
export const STAMINA_RECOVER_UNLOCK = 1.5;
export const MAX_MANA = 220;
export const MANA_RECOVER_PER_SEC = 0.75;
export const INFERNO_MAX_FUEL = 220;
export const PIT_DEPTH = PIT_FLOOR_HEIGHT;
export const MINIMAP_SIZES = [150, 190, 230] as const;
export const TRAMPOLINE_RADIUS = TILE_SIZE * 0.27;
export const SPEED_BOOST_DURATION = 60_000;
export const FREEZE_DURATION = 15_000;

export const SPAWN_POINTS = [
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
] as const;

export const PICKUP_POINTS = [
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
] as const;
