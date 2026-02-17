export interface LevelConfig {
  playerSpawn: { x: number; y: number };
  portal: { x: number; y: number };
  enemyCount: number;
  platformChallenge?: boolean;
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

export const LEVELS: LevelConfig[] = [
  { playerSpawn: { x: 2.2, y: 2.2 }, portal: { x: 13.5, y: 13.5 }, enemyCount: 4 },
  { playerSpawn: { x: 2.2, y: 13.2 }, portal: { x: 13.5, y: 2.5 }, enemyCount: 6 },
  { playerSpawn: { x: 13.2, y: 2.2 }, portal: { x: 2.5, y: 13.5 }, enemyCount: 8 },
  { playerSpawn: { x: 2.6, y: 8.0 }, portal: { x: 13.5, y: 8.5 }, enemyCount: 8, platformChallenge: true },
  { playerSpawn: { x: 2.4, y: 8.0 }, portal: { x: 13.5, y: 8.5 }, enemyCount: 1, bossFight: true },
  { playerSpawn: { x: 12.8, y: 8.0 }, portal: { x: 2.5, y: 8.5 }, enemyCount: 12 },
  { playerSpawn: { x: 8.0, y: 13.2 }, portal: { x: 8.0, y: 2.4 }, enemyCount: 14 },
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
    const key = `${x},${y}`;
    if (!PLATFORM_PADS.has(key)) PLATFORM_PITS.add(key);
  }
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
