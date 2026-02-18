export interface LevelConfig {
  playerSpawn: { x: number; y: number };
  portal: { x: number; y: number };
  enemyCount: number;
  bossFight?: boolean;
}

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

export const PIT_FLOOR_HEIGHT = -3.4;
export const STAIR_STEP_HEIGHT = 0.6;
export const SECOND_FLOOR_HEIGHT = 2.4;

export const LEVELS: LevelConfig[] = [
  { playerSpawn: { x: 2.2, y: 2.2 }, portal: { x: 13.5, y: 13.5 }, enemyCount: 6 },
  { playerSpawn: { x: 2.2, y: 13.2 }, portal: { x: 13.5, y: 2.5 }, enemyCount: 8 },
  { playerSpawn: { x: 13.2, y: 2.2 }, portal: { x: 2.5, y: 13.5 }, enemyCount: 10 },
  { playerSpawn: { x: 2.6, y: 8.0 }, portal: { x: 13.5, y: 8.5 }, enemyCount: 10 },
  { playerSpawn: { x: 2.4, y: 8.0 }, portal: { x: 13.5, y: 8.5 }, enemyCount: 1, bossFight: true },
  { playerSpawn: { x: 10.8, y: 9.4 }, portal: { x: 2.5, y: 8.5 }, enemyCount: 14 },
  { playerSpawn: { x: 8.0, y: 13.2 }, portal: { x: 8.0, y: 2.4 }, enemyCount: 16 },
];

type CellKind = "floor" | "stairs" | "platform" | "pit" | "trampoline";
type TerrainProfile = {
  openWalls: Set<string>;
  extraWalls: Set<string>;
  heights: Map<string, number>;
  stairs: Set<string>;
  pits: Set<string>;
  trampolines: Set<string>;
};

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function makeTerrain(): TerrainProfile {
  return {
    openWalls: new Set<string>(),
    extraWalls: new Set<string>(),
    heights: new Map<string, number>(),
    stairs: new Set<string>(),
    pits: new Set<string>(),
    trampolines: new Set<string>(),
  };
}

const TERRAIN: TerrainProfile[] = LEVELS.map(() => makeTerrain());

function clampLevel(levelIndex: number): number {
  return Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
}

function markOpenRect(levelIndex: number, x0: number, y0: number, x1: number, y1: number): void {
  const t = TERRAIN[clampLevel(levelIndex)];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) t.openWalls.add(key(x, y));
  }
}

function markBlockRect(levelIndex: number, x0: number, y0: number, x1: number, y1: number): void {
  const t = TERRAIN[clampLevel(levelIndex)];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) t.extraWalls.add(key(x, y));
  }
}

function markHeightRect(levelIndex: number, x0: number, y0: number, x1: number, y1: number, height: number): void {
  const t = TERRAIN[clampLevel(levelIndex)];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) t.heights.set(key(x, y), height);
  }
}

function markPitRect(levelIndex: number, x0: number, y0: number, x1: number, y1: number): void {
  const t = TERRAIN[clampLevel(levelIndex)];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const k = key(x, y);
      t.pits.add(k);
      t.heights.set(k, PIT_FLOOR_HEIGHT);
    }
  }
}

function markStair(levelIndex: number, x: number, y: number, height: number): void {
  const t = TERRAIN[clampLevel(levelIndex)];
  const k = key(x, y);
  t.heights.set(k, height);
  t.stairs.add(k);
}

function markStairLine(
  levelIndex: number,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  steps: number,
  startHeight: number,
  stepHeight = STAIR_STEP_HEIGHT,
): void {
  for (let i = 0; i < steps; i += 1) {
    markStair(levelIndex, startX + dx * i, startY + dy * i, startHeight + stepHeight * i);
  }
}

function markTrampoline(levelIndex: number, x: number, y: number): void {
  TERRAIN[clampLevel(levelIndex)].trampolines.add(key(x, y));
}

function configureTerrain(): void {
  // Level 1: open arena + elevated east district.
  markOpenRect(0, 3, 2, 7, 2);
  markOpenRect(0, 6, 4, 9, 4);
  markBlockRect(0, 5, 7, 5, 10);
  markHeightRect(0, 10, 9, 13, 13, SECOND_FLOOR_HEIGHT);
  markStairLine(0, 9, 11, 1, 0, 4, STAIR_STEP_HEIGHT);

  // Level 2: split verticality with central danger lane.
  markOpenRect(1, 3, 2, 6, 2);
  markOpenRect(1, 6, 10, 8, 11);
  markHeightRect(1, 3, 3, 12, 4, SECOND_FLOOR_HEIGHT);
  markStairLine(1, 5, 5, 1, 0, 4, STAIR_STEP_HEIGHT);
  markPitRect(1, 7, 7, 10, 8);
  markTrampoline(1, 8, 7);
  markTrampoline(1, 9, 8);
  markHeightRect(1, 11, 10, 13, 13, 1.2);

  // Level 3: dual deck with diagonal stair pushes.
  markOpenRect(2, 3, 2, 6, 2);
  markOpenRect(2, 6, 4, 9, 4);
  markHeightRect(2, 2, 10, 5, 13, SECOND_FLOOR_HEIGHT);
  markHeightRect(2, 10, 2, 13, 5, SECOND_FLOOR_HEIGHT);
  markStairLine(2, 6, 12, 1, -1, 4, STAIR_STEP_HEIGHT);
  markStairLine(2, 9, 6, 1, -1, 4, STAIR_STEP_HEIGHT);
  markPitRect(2, 7, 8, 9, 10);
  markTrampoline(2, 8, 9);

  // Level 4: platform-heavy traversal layer.
  markPitRect(3, 3, 5, 12, 10);
  markHeightRect(3, 4, 6, 4, 6, SECOND_FLOOR_HEIGHT);
  markHeightRect(3, 6, 7, 6, 7, SECOND_FLOOR_HEIGHT);
  markHeightRect(3, 8, 8, 8, 8, SECOND_FLOOR_HEIGHT);
  markHeightRect(3, 10, 7, 10, 7, SECOND_FLOOR_HEIGHT);
  markHeightRect(3, 12, 6, 12, 6, SECOND_FLOOR_HEIGHT);
  markHeightRect(3, 12, 8, 12, 8, SECOND_FLOOR_HEIGHT);
  markStairLine(3, 2, 8, 1, 0, 4, STAIR_STEP_HEIGHT);
  markStairLine(3, 11, 8, 1, 0, 3, STAIR_STEP_HEIGHT);

  // Level 5: boss arena with raised ring and corner stairs.
  markHeightRect(4, 2, 2, 13, 13, SECOND_FLOOR_HEIGHT);
  markHeightRect(4, 5, 5, 10, 10, 0);
  markStairLine(4, 4, 7, 1, 0, 4, STAIR_STEP_HEIGHT);
  markStairLine(4, 4, 8, 1, 0, 4, STAIR_STEP_HEIGHT);
  markStairLine(4, 10, 7, -1, 0, 4, STAIR_STEP_HEIGHT);
  markStairLine(4, 10, 8, -1, 0, 4, STAIR_STEP_HEIGHT);

  // Level 6: fortress with two floors and trenches.
  markOpenRect(5, 3, 6, 7, 6);
  markHeightRect(5, 2, 2, 5, 5, SECOND_FLOOR_HEIGHT);
  markHeightRect(5, 10, 10, 13, 13, SECOND_FLOOR_HEIGHT);
  markHeightRect(5, 2, 10, 5, 13, SECOND_FLOOR_HEIGHT);
  markStairLine(5, 6, 3, 1, 1, 4, STAIR_STEP_HEIGHT);
  markStairLine(5, 9, 12, -1, -1, 4, STAIR_STEP_HEIGHT);
  markPitRect(5, 7, 6, 8, 9);
  markTrampoline(5, 7, 7);
  markTrampoline(5, 8, 8);

  // Level 7: final stacked gauntlet.
  markBlockRect(6, 6, 6, 9, 9);
  markOpenRect(6, 6, 7, 9, 8);
  markHeightRect(6, 2, 2, 13, 3, SECOND_FLOOR_HEIGHT);
  markHeightRect(6, 2, 12, 13, 13, SECOND_FLOOR_HEIGHT);
  markHeightRect(6, 3, 5, 5, 7, 1.2);
  markHeightRect(6, 10, 8, 12, 10, 1.2);
  markPitRect(6, 4, 8, 6, 10);
  markPitRect(6, 9, 5, 11, 7);
  markTrampoline(6, 5, 9);
  markTrampoline(6, 10, 6);
  markStairLine(6, 3, 4, 1, 0, 4, STAIR_STEP_HEIGHT);
  markStairLine(6, 9, 11, 1, 0, 4, STAIR_STEP_HEIGHT);
}

configureTerrain();

export function isWallForLevel(levelIndex: number, mx: number, my: number): boolean {
  if (mx < 0 || my < 0 || mx >= MAP[0].length || my >= MAP.length) return true;
  const x = Math.floor(mx);
  const y = Math.floor(my);
  const k = key(x, y);
  const t = TERRAIN[clampLevel(levelIndex)];
  if (t.openWalls.has(k)) return false;
  if (t.extraWalls.has(k)) return true;
  return MAP[y][x] === "#";
}

export function floorHeightForLevel(levelIndex: number, mx: number, my: number): number {
  if (isWallForLevel(levelIndex, mx, my)) return 99;
  const x = Math.floor(mx);
  const y = Math.floor(my);
  const t = TERRAIN[clampLevel(levelIndex)];
  return t.heights.get(key(x, y)) ?? 0;
}

export function cellKindForLevel(levelIndex: number, x: number, y: number): CellKind {
  const t = TERRAIN[clampLevel(levelIndex)];
  const k = key(x, y);
  if (t.trampolines.has(k)) return "trampoline";
  if (t.pits.has(k)) return "pit";
  if (t.stairs.has(k)) return "stairs";
  const h = t.heights.get(k) ?? 0;
  if (h >= 1.0) return "platform";
  return "floor";
}

export function isTrampolineForLevel(levelIndex: number, mx: number, my: number): boolean {
  const x = Math.floor(mx);
  const y = Math.floor(my);
  if (x < 0 || y < 0 || x >= MAP[0].length || y >= MAP.length) return false;
  return TERRAIN[clampLevel(levelIndex)].trampolines.has(key(x, y));
}

export function parseNapCheat(input: string, maxLevels: number): number | null {
  const match = input.trim().toLowerCase().match(/^nap(\d+)$/);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value)) return null;
  if (value < 1 || value > maxLevels) return null;
  return value - 1;
}

export function enemyCountForLevel(levelIndex: number): number {
  const base = LEVELS[levelIndex]?.enemyCount ?? 4;
  return Math.max(base, 1);
}
