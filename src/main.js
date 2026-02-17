const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthTextEl = document.getElementById("healthText");
const healthBarEl = document.getElementById("healthBar");
const levelEl = document.getElementById("level");
const ammoEl = document.getElementById("ammo");
const weaponEl = document.getElementById("weapon");
const enemyEl = document.getElementById("enemy");
const bossHudEl = document.getElementById("bossHud");
const bossTextEl = document.getElementById("bossText");
const bossBarEl = document.getElementById("bossBar");
const cheatConsoleEl = document.getElementById("cheatConsole");
const cheatStatusEl = document.getElementById("cheatStatus");
const cheatBadgesEl = document.getElementById("cheatBadges");
const cheatHistoryEl = document.getElementById("cheatHistory");
const cheatInputEl = document.getElementById("cheatInput");

const MAP = [
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

const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const RAY_COUNT = 320;
const MAX_DEPTH = 24;

const PLAYER = {
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

const LEVELS = [
  {
    playerSpawn: { x: 2.2, y: 2.2 },
    portal: { x: 13.5, y: 13.5 },
    enemyCount: 4,
  },
  {
    playerSpawn: { x: 2.2, y: 13.2 },
    portal: { x: 13.5, y: 2.5 },
    enemyCount: 6,
  },
  {
    playerSpawn: { x: 13.2, y: 2.2 },
    portal: { x: 2.5, y: 13.5 },
    enemyCount: 8,
  },
  {
    playerSpawn: { x: 2.6, y: 8.0 },
    portal: { x: 13.5, y: 8.5 },
    enemyCount: 8,
    platformChallenge: true,
  },
  {
    playerSpawn: { x: 2.4, y: 8.0 },
    portal: { x: 13.5, y: 8.5 },
    enemyCount: 1,
    bossFight: true,
  },
  {
    playerSpawn: { x: 12.8, y: 8.0 },
    portal: { x: 2.5, y: 8.5 },
    enemyCount: 12,
  },
  {
    playerSpawn: { x: 8.0, y: 13.2 },
    portal: { x: 8.0, y: 2.4 },
    enemyCount: 14,
  },
];

const SPAWN_POINTS = [
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

const PICKUP_POINTS = [
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

const PLATFORM_LEVEL_INDEX = 3;
const PLATFORM_PADS = new Set();
for (const x of [4, 6, 8, 10, 12]) {
  PLATFORM_PADS.add(`${x},8`);
  PLATFORM_PADS.add(`${x},7`);
}
const PLATFORM_PITS = new Set();
for (let x = 3; x <= 12; x += 1) {
  for (let y = 7; y <= 9; y += 1) {
    const k = `${x},${y}`;
    if (!PLATFORM_PADS.has(k)) PLATFORM_PITS.add(k);
  }
}
const PLATFORM_PAD_LIST = Array.from(PLATFORM_PADS).map((k) => {
  const [x, y] = k.split(",").map(Number);
  return { x: x + 0.5, y: y + 0.5 };
});
const PLATFORM_PIT_LIST = Array.from(PLATFORM_PITS).map((k) => {
  const [x, y] = k.split(",").map(Number);
  return { x: x + 0.5, y: y + 0.5 };
});

const ENEMY_TEMPLATE = {
  type: "normal",
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
  rangedCooldown: 0,
  alive: true,
};

const input = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
  jumpRequested: false,
  MouseLeft: false,
  shootRequested: false,
};

const enemies = [];
const enemyShots = [];
const pickups = [];
const cannonBursts = [];

let lastTime = 0;
let fireCooldown = 0;
let muzzleFlash = 0;
let recoilKick = 0;
const GRAVITY = 15;
const JUMP_VELOCITY = 8.5;
let gameOver = false;
let victory = false;
let currentLevel = 0;
let portalActive = false;
let portal = { x: 13.5, y: 13.5, radius: 0.45 };
let hasPointerLock = false;
let audioCtx = null;
const music = new Audio("assets/music/doom1.mp3");
music.loop = true;
music.volume = 0.35;
let musicEnabled = true;
let cheatOpen = false;
let godMode = false;
let speedBoost = false;
const cheatHistory = [];
const MINIMAP_SIZES = [140, 170, 220];
let minimapSizeIndex = 1;

function isWall(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return MAP[Math.floor(y)][Math.floor(x)] === "#";
}

function normalizeAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function initAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (musicEnabled) {
    music.play().catch(() => {});
  }
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    music.pause();
    return;
  }
  music.play().catch(() => {});
}

function toggleWeapon() {
  const modes = ["gun"];
  if (PLAYER.hasCannon) modes.push("cannon");
  if (PLAYER.hasMinigun) modes.push("minigun");
  if (modes.length <= 1) return;

  const idx = modes.indexOf(PLAYER.weaponMode);
  PLAYER.weaponMode = modes[(idx + 1) % modes.length];
  updateHud();
}

function cycleMinimapZoom() {
  minimapSizeIndex = (minimapSizeIndex + 1) % MINIMAP_SIZES.length;
}

function setCheatStatus(text) {
  cheatStatusEl.textContent = text;
}

function addCheatHistory(command, result) {
  cheatHistory.unshift(`${command} -> ${result}`);
  if (cheatHistory.length > 3) cheatHistory.length = 3;
  cheatHistoryEl.innerHTML = cheatHistory.map((line) => `<div>${line}</div>`).join("");
}

function toggleCheatConsole() {
  cheatOpen = !cheatOpen;
  cheatConsoleEl.classList.toggle("hidden", !cheatOpen);
  if (cheatOpen) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    for (const key of Object.keys(input)) input[key] = false;
    cheatInputEl.value = "";
    cheatInputEl.focus();
    setCheatStatus("Type a cheat and press Enter");
  } else {
    cheatInputEl.blur();
  }
}

function playTone({
  type = "square",
  startFreq = 440,
  endFreq = 220,
  duration = 0.12,
  gain = 0.08,
  noise = false,
}) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const attack = 0.005;
  const release = Math.max(0.03, duration - attack);
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(gain, now + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  out.connect(audioCtx.destination);

  if (noise) {
    const size = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * 0.9;
    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(Math.max(120, startFreq), now);
    filter.Q.value = 1.5;
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(out);
    src.start(now);
    src.stop(now + duration);
    return;
  }

  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(50, endFreq), now + duration);
  osc.connect(out);
  osc.start(now);
  osc.stop(now + duration);
}

function playGunSound() {
  playTone({ type: "square", startFreq: 170, endFreq: 70, duration: 0.08, gain: 0.09 });
  playTone({ startFreq: 1800, endFreq: 300, duration: 0.07, gain: 0.045, noise: true });
}

function playCannonSound() {
  playTone({ type: "sawtooth", startFreq: 130, endFreq: 55, duration: 0.16, gain: 0.1 });
  playTone({ startFreq: 1400, endFreq: 190, duration: 0.12, gain: 0.06, noise: true });
}

function playCatMeowSound() {
  playTone({ type: "triangle", startFreq: 620, endFreq: 420, duration: 0.09, gain: 0.06 });
  playTone({ type: "triangle", startFreq: 520, endFreq: 760, duration: 0.08, gain: 0.05 });
}

function playEnemyDeathSound() {
  playTone({ type: "sawtooth", startFreq: 220, endFreq: 110, duration: 0.14, gain: 0.07 });
  playTone({ startFreq: 900, endFreq: 180, duration: 0.12, gain: 0.035, noise: true });
}

function playPlayerDeathSound() {
  playTone({ type: "sawtooth", startFreq: 170, endFreq: 55, duration: 0.26, gain: 0.09 });
  playTone({ startFreq: 480, endFreq: 80, duration: 0.24, gain: 0.04, noise: true });
}

function playPortalSound() {
  playTone({ type: "triangle", startFreq: 480, endFreq: 780, duration: 0.12, gain: 0.06 });
  playTone({ type: "triangle", startFreq: 620, endFreq: 980, duration: 0.14, gain: 0.05 });
}

function playPickupSound() {
  playTone({ type: "triangle", startFreq: 760, endFreq: 980, duration: 0.08, gain: 0.05 });
  playTone({ type: "triangle", startFreq: 920, endFreq: 1220, duration: 0.08, gain: 0.04 });
}

function lineOfSight(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return true;

  const step = 0.08;
  let x = ax;
  let y = ay;
  let t = 0;
  while (t < dist) {
    x += (dx / dist) * step;
    y += (dy / dist) * step;
    if (isWall(x, y)) return false;
    t += step;
  }
  return true;
}

function livingEnemyCount() {
  return enemies.filter((e) => e.alive).length;
}

function livingKittensCount() {
  return enemies.filter((e) => e.alive && e.type === "kitten").length;
}

function canOccupy(x, y, radius = PLAYER.radius) {
  return !(
    isWall(x - radius, y - radius) ||
    isWall(x + radius, y - radius) ||
    isWall(x - radius, y + radius) ||
    isWall(x + radius, y + radius)
  );
}

function tileKeyFromPos(x, y) {
  return `${Math.floor(x)},${Math.floor(y)}`;
}

function isPlatformChallengeActive() {
  return currentLevel === PLATFORM_LEVEL_INDEX;
}

function isPitAt(x, y) {
  if (!isPlatformChallengeActive()) return false;
  return PLATFORM_PITS.has(tileKeyFromPos(x, y));
}

function getFloorHeightAt(x, y) {
  if (isWall(x, y)) return 99;
  if (!isPlatformChallengeActive()) return 0;
  const key = tileKeyFromPos(x, y);
  if (PLATFORM_PADS.has(key)) return 1.0;
  if (PLATFORM_PITS.has(key)) return -1.2;
  return 0;
}

function findSafeSpot(x, y) {
  if (canOccupy(x, y) && getFloorHeightAt(x, y) >= 0) return { x, y };
  const spots = [ ...PICKUP_POINTS, ...SPAWN_POINTS, { x: 2.2, y: 2.2 } ];
  for (const s of spots) {
    if (canOccupy(s.x, s.y) && getFloorHeightAt(s.x, s.y) >= 0) return { x: s.x, y: s.y };
  }
  return { x: 2.2, y: 2.2 };
}

function spawnKittenNearBoss(boss) {
  const offsets = [
    { x: 0.6, y: 0 },
    { x: -0.6, y: 0 },
    { x: 0, y: 0.6 },
    { x: 0, y: -0.6 },
    { x: 0.45, y: 0.45 },
    { x: -0.45, y: -0.45 },
  ];
  for (const off of offsets) {
    const sx = boss.x + off.x;
    const sy = boss.y + off.y;
    if (isWall(sx, sy)) continue;
    enemies.push({
      ...ENEMY_TEMPLATE,
      type: "kitten",
      x: sx,
      y: sy,
      radius: 0.2,
      speed: 2.45,
      health: 1,
      maxHealth: 1,
      meleeDamage: 7,
      meleeRange: 1.05,
      meleeCooldownBase: 0.55,
      canShoot: false,
      canSpawnKittens: false,
      rangedCooldownBase: 999,
      rangedCooldownJitter: 0,
      shotDamage: 0,
      shotSpeed: 0,
      meleeCooldown: 0.2 + Math.random() * 0.4,
      alive: true,
    });
    return true;
  }
  return false;
}

function spawnScaledEnemies(levelIndex) {
  enemies.length = 0;
  enemyShots.length = 0;

  const config = LEVELS[levelIndex];
  if (config.bossFight) {
    enemies.push({
      ...ENEMY_TEMPLATE,
      type: "boss",
      x: 11.5,
      y: 8.0,
      radius: 0.45,
      speed: 0.8,
      health: 34,
      maxHealth: 34,
      meleeDamage: 18,
      meleeRange: 1.35,
      meleeCooldownBase: 1.1,
      canShoot: true,
      rangedCooldownBase: 0.95,
      rangedCooldownJitter: 0.35,
      rangedCooldown: 0.5,
      shotDamage: 20,
      shotSpeed: 4.4,
      canSpawnKittens: true,
      kittenSpawnCooldown: 2.5,
      kittenSpawnRate: 4.0,
      maxKittens: 7,
      alive: true,
    });
    return;
  }

  const validSpawns = SPAWN_POINTS.filter((p) => !isWall(p.x, p.y));
  const spawnPool = validSpawns.length > 0 ? validSpawns : [{ x: 8.5, y: 8.5 }];
  const enemyHealth = levelIndex === 3 ? 4 : 2 + levelIndex;
  const enemySpeed = levelIndex === 3 ? 1.2 : 1.0 + levelIndex * 0.12;
  const enemyDamage = levelIndex === 3 ? 11 : 8 + levelIndex * 2;
  const fireCooldownBase = Math.max(0.45, 1.2 - levelIndex * 0.2);
  const fireJitter = Math.max(0.2, 0.55 - levelIndex * 0.07);
  const levelBulletSpeed = levelIndex === 3 ? 4.6 : 6;

  for (let i = 0; i < config.enemyCount; i += 1) {
    const spawn = spawnPool[(i + levelIndex * 3) % spawnPool.length];
    enemies.push({
      ...ENEMY_TEMPLATE,
      x: spawn.x,
      y: spawn.y,
      speed: enemySpeed,
      meleeCooldown: Math.random() * 0.4,
      rangedCooldown: Math.random() * fireCooldownBase,
      health: enemyHealth,
      maxHealth: enemyHealth,
      rangedCooldownBase: fireCooldownBase,
      rangedCooldownJitter: fireJitter,
      shotDamage: enemyDamage,
      shotSpeed: levelBulletSpeed,
      alive: true,
    });
  }
}

function spawnLevelPickups(levelIndex) {
  pickups.length = 0;
  const validPoints = PICKUP_POINTS.filter((p) => !isWall(p.x, p.y));
  const pool = validPoints.length > 0 ? validPoints : [{ x: 8.5, y: 8.5 }];

  const healthPackCount = Math.max(2, 3 + Math.floor(levelIndex / 2) + (levelIndex === 3 ? 1 : 0));
  const ammoPackCount = 4;
  const ammoAmount = 10;
  const healthAmount = 26 - Math.min(8, levelIndex * 2) + (levelIndex === 3 ? 4 : 0);

  for (let i = 0; i < healthPackCount; i += 1) {
    const pos = pool[(i + levelIndex) % pool.length];
    pickups.push({
      type: "health",
      x: pos.x,
      y: pos.y,
      radius: 0.24,
      amount: healthAmount,
      alive: true,
    });
  }

  for (let i = 0; i < ammoPackCount; i += 1) {
    const pos = pool[(i + levelIndex * 2 + 3) % pool.length];
    pickups.push({
      type: "ammo",
      x: pos.x,
      y: pos.y,
      radius: 0.24,
      amount: ammoAmount,
      alive: true,
    });
  }
}

function startLevel(levelIndex, freshRun = false) {
  const config = LEVELS[levelIndex];
  currentLevel = levelIndex;
  portalActive = false;
  portal = { x: config.portal.x, y: config.portal.y, radius: 0.45 };

  const safe = findSafeSpot(config.playerSpawn.x, config.playerSpawn.y);
  PLAYER.x = safe.x;
  PLAYER.y = safe.y;
  PLAYER.z = getFloorHeightAt(safe.x, safe.y);
  PLAYER.vz = 0;
  PLAYER.onGround = true;
  PLAYER.angle = 0;
  PLAYER.safeX = safe.x;
  PLAYER.safeY = safe.y;

  if (!freshRun) {
    PLAYER.ammo = Math.min(120, PLAYER.ammo + 14);
    PLAYER.health = Math.min(PLAYER.maxHealth, PLAYER.health + 18);
  }

  spawnScaledEnemies(levelIndex);
  spawnLevelPickups(levelIndex);
  updateHud();
}

function resetGame() {
  PLAYER.z = getFloorHeightAt(PLAYER.x, PLAYER.y);
  PLAYER.vz = 0;
  PLAYER.onGround = true;
  PLAYER.health = PLAYER.maxHealth;
  PLAYER.ammo = 40;
  PLAYER.hasCannon = false;
  PLAYER.weaponMode = "gun";
  fireCooldown = 0;
  muzzleFlash = 0;
  gameOver = false;
  victory = false;
  startLevel(0, true);
}

function updateHud() {
  const hp = Math.max(0, Math.floor(PLAYER.health));
  const hpPercent = Math.max(0, Math.min(100, (PLAYER.health / PLAYER.maxHealth) * 100));

  healthTextEl.textContent = `Health: ${hp}`;
  healthBarEl.style.width = `${hpPercent}%`;
  levelEl.textContent = `Level: ${currentLevel + 1}/${LEVELS.length}`;
  ammoEl.textContent = `Ammo: ${PLAYER.ammo}`;
  weaponEl.textContent = PLAYER.hasCannon
    ? `Weapon: ${
      PLAYER.weaponMode === "cannon"
        ? "Cannon"
        : PLAYER.weaponMode === "minigun"
          ? "Minigun"
          : "Gun"
    } (E)`
    : PLAYER.hasMinigun
      ? `Weapon: ${PLAYER.weaponMode === "minigun" ? "Minigun" : "Gun"} (E)`
      : "Weapon: Gun";

  const alive = livingEnemyCount();
  enemyEl.textContent = portalActive ? "Portal: Enter!" : `Cat Fiends: ${alive}/${enemies.length}`;

  const boss = enemies.find((e) => e.alive && e.type === "boss");
  if (boss) {
    const percent = Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100));
    bossHudEl.classList.remove("hidden");
    bossTextEl.textContent = `Boss HP: ${Math.max(0, Math.ceil(boss.health))}/${boss.maxHealth}`;
    bossBarEl.style.width = `${percent}%`;
  } else {
    bossHudEl.classList.add("hidden");
  }

  const badges = [];
  if (godMode) badges.push("GOD");
  if (speedBoost) badges.push("ZOOMIES");
  if (PLAYER.hasMinigun) badges.push("MINIGUN");
  cheatBadgesEl.classList.toggle("hidden", badges.length === 0);
  cheatBadgesEl.innerHTML = badges.map((b) => `<span class="cheat-badge">${b}</span>`).join("");
}

function tryMove(nx, ny) {
  const dx = nx - PLAYER.x;
  const dy = ny - PLAYER.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 0.08));

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const px = PLAYER.x + dx * t;
    const py = PLAYER.y + dy * t;
    const currentFloor = getFloorHeightAt(PLAYER.x, PLAYER.y);

    if (canOccupy(px, PLAYER.y)) {
      const floorX = getFloorHeightAt(px, PLAYER.y);
      const canStepX = PLAYER.onGround
        ? floorX - currentFloor <= 0.35
        : floorX <= PLAYER.z + 0.1;
      if (canStepX) PLAYER.x = px;
    }

    if (canOccupy(PLAYER.x, py)) {
      const floorY = getFloorHeightAt(PLAYER.x, py);
      const canStepY = PLAYER.onGround
        ? floorY - getFloorHeightAt(PLAYER.x, PLAYER.y) <= 0.35
        : floorY <= PLAYER.z + 0.1;
      if (canStepY) PLAYER.y = py;
    }
  }
}

function castRay(rayAngle) {
  const step = 0.03;
  let depth = 0;
  let x = PLAYER.x;
  let y = PLAYER.y;

  while (depth < MAX_DEPTH) {
    x += Math.cos(rayAngle) * step;
    y += Math.sin(rayAngle) * step;
    depth += step;
    if (isWall(x, y)) break;
  }

  const corrected = depth * Math.cos(rayAngle - PLAYER.angle);
  return Math.max(0.0001, corrected);
}

function renderEnemySprite(enemy, wallDepths, tint, cameraShift) {
  const dx = enemy.x - PLAYER.x;
  const dy = enemy.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angleToEnemy = Math.atan2(dy, dx);
  const relative = normalizeAngle(angleToEnemy - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.25) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const typeScale = enemy.type === "boss" ? 1.45 : enemy.type === "kitten" ? 0.58 : 1;
  const spriteSize = Math.min(canvas.height, ((canvas.height * 0.75) / dist) * typeScale);
  const left = screenX - spriteSize / 2;
  const top = canvas.height / 2 - spriteSize / 2 + cameraShift;

  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  ctx.save();
  ctx.translate(left, top);

  ctx.fillStyle = tint;
  ctx.fillRect(spriteSize * 0.18, spriteSize * 0.2, spriteSize * 0.64, spriteSize * 0.62);

  // Belly patch
  ctx.fillStyle = "#ffe7d6";
  ctx.fillRect(spriteSize * 0.34, spriteSize * 0.44, spriteSize * 0.32, spriteSize * 0.28);

  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(spriteSize * 0.18, spriteSize * 0.2);
  ctx.lineTo(spriteSize * 0.32, 0);
  ctx.lineTo(spriteSize * 0.45, spriteSize * 0.2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(spriteSize * 0.82, spriteSize * 0.2);
  ctx.lineTo(spriteSize * 0.68, 0);
  ctx.lineTo(spriteSize * 0.55, spriteSize * 0.2);
  ctx.fill();

  ctx.fillStyle = "#1a1313";
  ctx.fillRect(spriteSize * 0.33, spriteSize * 0.45, spriteSize * 0.08, spriteSize * 0.08);
  ctx.fillRect(spriteSize * 0.59, spriteSize * 0.45, spriteSize * 0.08, spriteSize * 0.08);
  ctx.fillRect(spriteSize * 0.45, spriteSize * 0.58, spriteSize * 0.1, spriteSize * 0.08);

  // Whiskers
  ctx.strokeStyle = "#1a1313";
  ctx.lineWidth = Math.max(1, spriteSize * 0.015);
  ctx.beginPath();
  ctx.moveTo(spriteSize * 0.44, spriteSize * 0.61);
  ctx.lineTo(spriteSize * 0.30, spriteSize * 0.58);
  ctx.moveTo(spriteSize * 0.44, spriteSize * 0.63);
  ctx.lineTo(spriteSize * 0.29, spriteSize * 0.65);
  ctx.moveTo(spriteSize * 0.56, spriteSize * 0.61);
  ctx.lineTo(spriteSize * 0.70, spriteSize * 0.58);
  ctx.moveTo(spriteSize * 0.56, spriteSize * 0.63);
  ctx.lineTo(spriteSize * 0.71, spriteSize * 0.65);
  ctx.stroke();

  // Tail
  ctx.strokeStyle = tint;
  ctx.lineWidth = Math.max(2, spriteSize * 0.06);
  ctx.beginPath();
  ctx.moveTo(spriteSize * 0.8, spriteSize * 0.72);
  ctx.quadraticCurveTo(spriteSize * 0.95, spriteSize * 0.64, spriteSize * 0.88, spriteSize * 0.5);
  ctx.stroke();

  if (enemy.type !== "kitten") {
    // Cat blaster
    ctx.fillStyle = "#3c3e45";
    ctx.fillRect(spriteSize * 0.36, spriteSize * 0.70, spriteSize * 0.28, spriteSize * 0.08);
    ctx.fillStyle = "#5f6672";
    ctx.fillRect(spriteSize * 0.64, spriteSize * 0.72, spriteSize * 0.14, spriteSize * 0.04);
  }

  if (enemy.type === "boss") {
    // Can cannon
    ctx.fillStyle = "#cfd4dc";
    ctx.fillRect(spriteSize * 0.62, spriteSize * 0.61, spriteSize * 0.2, spriteSize * 0.16);
    ctx.fillStyle = "#9da5b2";
    ctx.fillRect(spriteSize * 0.62, spriteSize * 0.60, spriteSize * 0.2, spriteSize * 0.03);
    ctx.fillRect(spriteSize * 0.62, spriteSize * 0.74, spriteSize * 0.2, spriteSize * 0.03);
    ctx.fillStyle = "#e96161";
    ctx.fillRect(spriteSize * 0.66, spriteSize * 0.66, spriteSize * 0.12, spriteSize * 0.05);
  }

  if (enemy.canShoot && enemy.rangedCooldown < 0.2) {
    ctx.fillStyle = "#ffcc66";
    ctx.fillRect(spriteSize * 0.44, spriteSize * 0.68, spriteSize * 0.12, spriteSize * 0.08);
  }

  ctx.restore();
}

function renderShot(shot, wallDepths, cameraShift) {
  const dx = shot.x - PLAYER.x;
  const dy = shot.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angleToShot = Math.atan2(dy, dx);
  const relative = normalizeAngle(angleToShot - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.1) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(50, (canvas.height * 0.18) / dist);
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  ctx.fillStyle = "#ff7452";
  ctx.beginPath();
  ctx.arc(screenX, canvas.height / 2 + cameraShift, Math.max(2, size * 0.2), 0, Math.PI * 2);
  ctx.fill();
}

function renderCannonBurst(burst, wallDepths, cameraShift) {
  const dx = burst.x - PLAYER.x;
  const dy = burst.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angleToBurst = Math.atan2(dy, dx);
  const relative = normalizeAngle(angleToBurst - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.15) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(canvas.height * 0.7, (canvas.height * 0.5) / Math.max(0.2, dist)) * (0.55 + burst.power * 0.25);
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  const alpha = Math.max(0, burst.life / burst.maxLife);
  const cy = canvas.height / 2 + size * 0.05 + cameraShift;
  const r = size * (0.22 + (1 - alpha) * 0.45);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(120, 230, 255, ${0.25 + alpha * 0.65})`;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath();
  ctx.arc(screenX, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 245, 180, ${0.18 + alpha * 0.5})`;
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.beginPath();
  ctx.arc(screenX, cy, r * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderPickup(pickup, wallDepths, cameraShift) {
  if (!pickup.alive) return;

  const dx = pickup.x - PLAYER.x;
  const dy = pickup.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const relative = normalizeAngle(angle - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.1) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(canvas.height * 0.55, (canvas.height * 0.45) / Math.max(0.2, dist));
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  const cy = canvas.height / 2 + size * 0.75 + cameraShift;
  const pulse = (Math.sin(performance.now() * 0.01 + pickup.x * 2 + pickup.y) + 1) * 0.5;

  ctx.save();
  ctx.translate(screenX, cy);

  if (pickup.type === "health") {
    ctx.fillStyle = "#d33434";
    ctx.fillRect(-size * 0.2, -size * 0.4, size * 0.4, size * 0.4);
    ctx.fillStyle = "#fff3f3";
    ctx.fillRect(-size * 0.05, -size * 0.34, size * 0.1, size * 0.28);
    ctx.fillRect(-size * 0.14, -size * 0.25, size * 0.28, size * 0.1);
  } else if (pickup.type === "ammo") {
    ctx.fillStyle = "#40607a";
    ctx.fillRect(-size * 0.2, -size * 0.38, size * 0.4, size * 0.36);
    ctx.fillStyle = "#8eaec7";
    ctx.fillRect(-size * 0.16, -size * 0.35, size * 0.32, size * 0.06);
    ctx.fillStyle = "#f4c85d";
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(-size * 0.14 + i * size * 0.1, -size * 0.26, size * 0.06, size * 0.18);
    }
  } else {
    // Boss weapon crate
    ctx.fillStyle = "#6f7d8f";
    ctx.fillRect(-size * 0.22, -size * 0.4, size * 0.44, size * 0.38);
    ctx.fillStyle = "#d7dee8";
    ctx.fillRect(-size * 0.18, -size * 0.34, size * 0.36, size * 0.08);
    ctx.fillStyle = "#d25555";
    ctx.fillRect(-size * 0.08, -size * 0.28, size * 0.16, size * 0.18);
    ctx.fillStyle = "#e5eef9";
    ctx.fillRect(-size * 0.02, -size * 0.26, size * 0.04, size * 0.14);
  }

  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = pickup.type === "health"
    ? `rgba(255, 90, 90, ${0.22 + pulse * 0.15})`
    : pickup.type === "ammo"
      ? `rgba(130, 200, 255, ${0.2 + pulse * 0.15})`
      : `rgba(255, 230, 140, ${0.22 + pulse * 0.15})`;
  ctx.beginPath();
  ctx.arc(0, -size * 0.2, size * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function renderPortal(wallDepths, cameraShift) {
  if (!portalActive) return;

  const dx = portal.x - PLAYER.x;
  const dy = portal.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angleToPortal = Math.atan2(dy, dx);
  const relative = normalizeAngle(angleToPortal - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.2) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(canvas.height * 0.8, (canvas.height * 0.9) / Math.max(0.2, dist));
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
  const r = Math.max(12, size * 0.45);
  const cy = canvas.height / 2 + size * 0.1 + cameraShift;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const grad = ctx.createRadialGradient(screenX, cy, r * 0.15, screenX, cy, r);
  grad.addColorStop(0, `rgba(150, 240, 255, ${0.7 + pulse * 0.2})`);
  grad.addColorStop(0.55, `rgba(70, 120, 255, ${0.5 + pulse * 0.3})`);
  grad.addColorStop(1, "rgba(60, 20, 120, 0.05)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(screenX, cy, r * 0.75, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderPlatformBlock(marker, wallDepths, cameraShift) {
  const dx = marker.x - PLAYER.x;
  const dy = marker.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const relative = normalizeAngle(angle - PLAYER.angle);
  if (Math.abs(relative) > HALF_FOV + 0.2) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(canvas.height * 0.62, (canvas.height * 0.78) / Math.max(0.2, dist));
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  const cy = canvas.height / 2 + size * 1.04 + cameraShift;
  const halfW = size * 0.55;
  const topH = size * 0.42;

  ctx.save();
  // Front face of raised block
  ctx.fillStyle = "#1f5579";
  ctx.fillRect(screenX - halfW * 0.78, cy - topH * 0.08, halfW * 1.56, topH * 0.95);

  // Top face
  ctx.fillStyle = "#4eb8ef";
  ctx.beginPath();
  ctx.moveTo(screenX - halfW * 0.7, cy - topH * 0.08);
  ctx.lineTo(screenX + halfW * 0.7, cy - topH * 0.08);
  ctx.lineTo(screenX + halfW * 0.92, cy - topH * 0.42);
  ctx.lineTo(screenX - halfW * 0.92, cy - topH * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#98dcff";
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.stroke();

  ctx.restore();
}

function renderPitHole(marker, wallDepths, cameraShift) {
  const dx = marker.x - PLAYER.x;
  const dy = marker.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const relative = normalizeAngle(angle - PLAYER.angle);
  if (Math.abs(relative) > HALF_FOV + 0.2) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(canvas.height * 0.55, (canvas.height * 0.7) / Math.max(0.2, dist));
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  const cy = canvas.height / 2 + size * 1.06 + cameraShift;
  ctx.save();
  ctx.fillStyle = "#09090ce0";
  ctx.beginPath();
  ctx.moveTo(screenX - size * 0.56, cy);
  ctx.lineTo(screenX + size * 0.56, cy);
  ctx.lineTo(screenX + size * 0.42, cy + size * 0.2);
  ctx.lineTo(screenX - size * 0.42, cy + size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#3f2029";
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.stroke();
  ctx.restore();
}

function render3D() {
  const w = canvas.width;
  const h = canvas.height;
  const cameraShift = -PLAYER.z * 120;

  ctx.fillStyle = "#7f6d56";
  ctx.fillRect(0, 0, w, h / 2 + cameraShift);
  ctx.fillStyle = "#352821";
  ctx.fillRect(0, h / 2 + cameraShift, w, h / 2 - cameraShift);

  const wallDepths = new Float32Array(RAY_COUNT);
  const colW = w / RAY_COUNT;

  for (let i = 0; i < RAY_COUNT; i += 1) {
    const rayRatio = i / RAY_COUNT;
    const rayAngle = PLAYER.angle - HALF_FOV + rayRatio * FOV;
    const dist = castRay(rayAngle);
    wallDepths[i] = dist;

    const wallH = Math.min(h, (h * 0.9) / dist);
    const y = (h - wallH) / 2 + cameraShift;

    const shade = Math.max(20, Math.floor(210 - dist * 24));
    ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.8)}, ${Math.floor(shade * 0.65)})`;
    ctx.fillRect(i * colW, y, colW + 1, wallH);
  }

  const sprites = [];
  for (const enemy of enemies) {
    if (enemy.alive) sprites.push({ type: "enemy", entity: enemy, dist: Math.hypot(enemy.x - PLAYER.x, enemy.y - PLAYER.y) });
  }
  for (const shot of enemyShots) {
    sprites.push({ type: "shot", entity: shot, dist: Math.hypot(shot.x - PLAYER.x, shot.y - PLAYER.y) });
  }
  for (const burst of cannonBursts) {
    sprites.push({ type: "cannonBurst", entity: burst, dist: Math.hypot(burst.x - PLAYER.x, burst.y - PLAYER.y) });
  }
  for (const pickup of pickups) {
    if (pickup.alive) sprites.push({ type: "pickup", entity: pickup, dist: Math.hypot(pickup.x - PLAYER.x, pickup.y - PLAYER.y) });
  }
  if (isPlatformChallengeActive()) {
    for (const pit of PLATFORM_PIT_LIST) {
      sprites.push({ type: "platformPit", entity: pit, dist: Math.hypot(pit.x - PLAYER.x, pit.y - PLAYER.y) });
    }
    for (const pad of PLATFORM_PAD_LIST) {
      sprites.push({ type: "platformPad", entity: pad, dist: Math.hypot(pad.x - PLAYER.x, pad.y - PLAYER.y) });
    }
  }
  if (portalActive) {
    sprites.push({ type: "portal", dist: Math.hypot(portal.x - PLAYER.x, portal.y - PLAYER.y) });
  }

  sprites.sort((a, b) => b.dist - a.dist);
  for (const sprite of sprites) {
    if (sprite.type === "enemy") {
      let tint = sprite.entity.health === 1 ? "#dc93a8" : "#f2a8b8";
      if (sprite.entity.type === "boss") tint = "#c78666";
      if (sprite.entity.type === "kitten") tint = "#f8c3d0";
      renderEnemySprite(sprite.entity, wallDepths, tint, cameraShift);
    } else if (sprite.type === "pickup") {
      renderPickup(sprite.entity, wallDepths, cameraShift);
    } else if (sprite.type === "portal") {
      renderPortal(wallDepths, cameraShift);
    } else if (sprite.type === "cannonBurst") {
      renderCannonBurst(sprite.entity, wallDepths, cameraShift);
    } else if (sprite.type === "platformPad") {
      renderPlatformBlock(sprite.entity, wallDepths, cameraShift);
    } else if (sprite.type === "platformPit") {
      renderPitHole(sprite.entity, wallDepths, cameraShift);
    } else {
      renderShot(sprite.entity, wallDepths, cameraShift);
    }
  }

  renderWeapon();
  renderCrosshair();
  renderMiniMap();
}

function renderWeapon() {
  const w = canvas.width;
  const h = canvas.height;
  const bob = Math.sin(performance.now() * 0.007) * 3;
  const centerX = w * 0.5;
  const baseY = h * 0.96 + bob + recoilKick;
  const backW = w * 0.24;
  const frontW = w * 0.11;
  const bodyH = h * 0.17;
  const depth = h * 0.09;

  const rearLeft = centerX - backW / 2;
  const rearRight = centerX + backW / 2;
  const frontLeft = centerX - frontW / 2;
  const frontRight = centerX + frontW / 2;
  const topY = baseY - bodyH;
  const muzzleY = topY - depth;
  const sideDrop = h * 0.04;

  // Underlay shell prevents tiny transparent seams between faces.
  ctx.fillStyle = "#13161b";
  ctx.beginPath();
  ctx.moveTo(rearLeft - w * 0.005, baseY + h * 0.003);
  ctx.lineTo(rearRight + w * 0.005, baseY + h * 0.003);
  ctx.lineTo(frontRight + w * 0.003, baseY - sideDrop + h * 0.004);
  ctx.lineTo(frontRight + w * 0.002, muzzleY + h * 0.03);
  ctx.lineTo(frontLeft - w * 0.002, muzzleY + h * 0.03);
  ctx.lineTo(frontLeft - w * 0.003, baseY - sideDrop + h * 0.004);
  ctx.closePath();
  ctx.fill();

  // Side body faces
  ctx.fillStyle = "#1c2026";
  ctx.beginPath();
  ctx.moveTo(rearLeft, baseY);
  ctx.lineTo(frontLeft, baseY - sideDrop);
  ctx.lineTo(frontLeft, topY - sideDrop);
  ctx.lineTo(rearLeft, topY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2c313a";
  ctx.beginPath();
  ctx.moveTo(rearRight, baseY);
  ctx.lineTo(frontRight, baseY - sideDrop);
  ctx.lineTo(frontRight, topY - sideDrop);
  ctx.lineTo(rearRight, topY);
  ctx.closePath();
  ctx.fill();

  // Bottom bridge face
  ctx.fillStyle = "#262b33";
  ctx.beginPath();
  ctx.moveTo(rearLeft, baseY);
  ctx.lineTo(rearRight, baseY);
  ctx.lineTo(frontRight, baseY - sideDrop);
  ctx.lineTo(frontLeft, baseY - sideDrop);
  ctx.closePath();
  ctx.fill();

  // Top face
  ctx.fillStyle = "#3d4652";
  ctx.beginPath();
  ctx.moveTo(rearLeft, topY);
  ctx.lineTo(rearRight, topY);
  ctx.lineTo(frontRight, muzzleY);
  ctx.lineTo(frontLeft, muzzleY);
  ctx.closePath();
  ctx.fill();

  // Front ramp faces seal side openings near the muzzle.
  ctx.fillStyle = "#303742";
  ctx.beginPath();
  ctx.moveTo(frontLeft, topY - sideDrop);
  ctx.lineTo(frontLeft, baseY - sideDrop);
  ctx.lineTo(frontLeft + w * 0.012, muzzleY + h * 0.015);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(frontRight, topY - sideDrop);
  ctx.lineTo(frontRight, baseY - sideDrop);
  ctx.lineTo(frontRight - w * 0.012, muzzleY + h * 0.015);
  ctx.closePath();
  ctx.fill();

  // Front cap
  ctx.fillStyle = "#1f242c";
  ctx.beginPath();
  ctx.moveTo(frontLeft + w * 0.012, muzzleY + h * 0.015);
  ctx.lineTo(frontRight - w * 0.012, muzzleY + h * 0.015);
  ctx.lineTo(frontRight - w * 0.008, muzzleY + h * 0.03);
  ctx.lineTo(frontLeft + w * 0.008, muzzleY + h * 0.03);
  ctx.closePath();
  ctx.fill();

  // Barrel opening
  ctx.fillStyle = "#14161a";
  ctx.beginPath();
  ctx.moveTo(frontLeft + w * 0.01, muzzleY + h * 0.01);
  ctx.lineTo(frontRight - w * 0.01, muzzleY + h * 0.01);
  ctx.lineTo(frontRight - w * 0.016, muzzleY + h * 0.03);
  ctx.lineTo(frontLeft + w * 0.016, muzzleY + h * 0.03);
  ctx.closePath();
  ctx.fill();

  // Highlight strip
  ctx.fillStyle = PLAYER.weaponMode === "cannon" ? "#8ac6d8" : "#7f8a98";
  ctx.beginPath();
  ctx.moveTo(centerX - w * 0.01, topY + h * 0.005);
  ctx.lineTo(centerX + w * 0.01, topY + h * 0.005);
  ctx.lineTo(centerX + w * 0.005, muzzleY + h * 0.01);
  ctx.lineTo(centerX - w * 0.005, muzzleY + h * 0.01);
  ctx.closePath();
  ctx.fill();

  // Grip and trigger box
  ctx.fillStyle = "#171a1f";
  ctx.fillRect(centerX - w * 0.075, baseY - h * 0.01, w * 0.05, h * 0.17);
  ctx.fillStyle = "#2b3038";
  ctx.fillRect(centerX - w * 0.018, baseY - h * 0.006, w * 0.036, h * 0.045);

  if (PLAYER.weaponMode === "cannon" && PLAYER.hasCannon) {
    ctx.fillStyle = "#77c9df";
    ctx.fillRect(centerX - w * 0.022, topY + h * 0.02, w * 0.044, h * 0.018);
  }

  if (muzzleFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = PLAYER.weaponMode === "cannon" ? "#8be9ff" : "#ffcf66";
    ctx.beginPath();
    ctx.moveTo(centerX - w * 0.016, muzzleY + h * 0.006);
    ctx.lineTo(centerX, muzzleY - h * 0.055);
    ctx.lineTo(centerX + w * 0.016, muzzleY + h * 0.006);
    ctx.lineTo(centerX, muzzleY + h * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function renderCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
}

function renderMiniMap() {
  const pad = 14;
  const size = MINIMAP_SIZES[minimapSizeIndex];
  const x0 = canvas.width - size - pad;
  const y0 = pad;
  const cellW = size / MAP_W;
  const cellH = size / MAP_H;

  ctx.save();
  ctx.fillStyle = "#0d121ad6";
  ctx.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.strokeStyle = "#6d7c9a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, size + 12);

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      const key = `${x},${y}`;
      if (isPlatformChallengeActive() && PLATFORM_PITS.has(key)) {
        ctx.fillStyle = "#251015";
      } else if (isPlatformChallengeActive() && PLATFORM_PADS.has(key)) {
        ctx.fillStyle = "#17324a";
      } else {
        ctx.fillStyle = MAP[y][x] === "#" ? "#2a3344" : "#111821";
      }
      ctx.fillRect(x0 + x * cellW, y0 + y * cellH, cellW, cellH);
    }
  }

  if (portalActive) {
    const px = x0 + portal.x * cellW;
    const py = y0 + portal.y * cellH;
    ctx.fillStyle = "#7feaff";
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, cellW * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const ex = x0 + enemy.x * cellW;
    const ey = y0 + enemy.y * cellH;
    ctx.fillStyle = enemy.type === "boss" ? "#ff8d66" : enemy.type === "kitten" ? "#ff8fc4" : "#ff5b5b";
    ctx.fillRect(ex - 2, ey - 2, 4, 4);
  }

  const ppx = x0 + PLAYER.x * cellW;
  const ppy = y0 + PLAYER.y * cellH;
  ctx.fillStyle = "#8dff8a";
  ctx.beginPath();
  ctx.arc(ppx, ppy, Math.max(2.5, cellW * 0.35), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8dff8a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ppx, ppy);
  ctx.lineTo(ppx + Math.cos(PLAYER.angle) * 10, ppy + Math.sin(PLAYER.angle) * 10);
  ctx.stroke();

  ctx.fillStyle = "#d7e4ff";
  ctx.font = "11px Trebuchet MS";
  ctx.fillText(`MINIMAP ${size}`, x0 + 3, y0 - 10);
  ctx.restore();
}

function damagePlayer(amount) {
  if (godMode) return;
  PLAYER.health -= amount;
  if (PLAYER.health <= 0) {
    PLAYER.health = 0;
    gameOver = true;
    playPlayerDeathSound();
  }
  updateHud();
}

function enemyShoot(enemy) {
  const dx = PLAYER.x - enemy.x;
  const dy = PLAYER.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return;

  enemyShots.push({
    x: enemy.x,
    y: enemy.y,
    dx: dx / dist,
    dy: dy / dist,
    speed: enemy.shotSpeed || 6,
    life: 2,
    damage: enemy.shotDamage,
    radius: 0.12,
  });
  playCatMeowSound();
}

function updateEnemyShots(dt) {
  for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
    const shot = enemyShots[i];
    shot.x += shot.dx * shot.speed * dt;
    shot.y += shot.dy * shot.speed * dt;
    shot.life -= dt;

    if (shot.life <= 0 || isWall(shot.x, shot.y)) {
      enemyShots.splice(i, 1);
      continue;
    }

    const distToPlayer = Math.hypot(shot.x - PLAYER.x, shot.y - PLAYER.y);
    if (distToPlayer < PLAYER.radius + shot.radius) {
      damagePlayer(shot.damage);
      enemyShots.splice(i, 1);
    }
  }
}

function updatePickups() {
  if (gameOver || victory) return;

  for (const pickup of pickups) {
    if (!pickup.alive) continue;
    const dist = Math.hypot(pickup.x - PLAYER.x, pickup.y - PLAYER.y);
    if (dist > PLAYER.radius + pickup.radius) continue;

    if (pickup.type === "health") {
      if (PLAYER.health >= PLAYER.maxHealth) continue;
      PLAYER.health = Math.min(PLAYER.maxHealth, PLAYER.health + pickup.amount);
    } else if (pickup.type === "ammo") {
      PLAYER.ammo = Math.min(180, PLAYER.ammo + pickup.amount);
    } else {
      PLAYER.hasCannon = true;
      if (PLAYER.weaponMode !== "cannon") PLAYER.weaponMode = "cannon";
    }

    pickup.alive = false;
    playPickupSound();
    updateHud();
  }
}

function updatePlatformChallenge() {
  if (!isPlatformChallengeActive() || gameOver || victory) return;
  if (PLAYER.z < -1.05) {
    damagePlayer(14);
    PLAYER.x = PLAYER.safeX;
    PLAYER.y = PLAYER.safeY;
    PLAYER.z = getFloorHeightAt(PLAYER.safeX, PLAYER.safeY);
    PLAYER.vz = 0;
    PLAYER.onGround = true;
    return;
  }

  if (PLAYER.onGround && getFloorHeightAt(PLAYER.x, PLAYER.y) >= 0) {
    PLAYER.safeX = PLAYER.x;
    PLAYER.safeY = PLAYER.y;
  }
}

function updateEnemies(dt) {
  if (gameOver || victory) return;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const dx = PLAYER.x - enemy.x;
    const dy = PLAYER.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const canSee = lineOfSight(enemy.x, enemy.y, PLAYER.x, PLAYER.y);

    if (canSee && dist > enemy.meleeRange) {
      const nx = enemy.x + (dx / dist) * enemy.speed * dt;
      const ny = enemy.y + (dy / dist) * enemy.speed * dt;
      if (!isWall(nx, enemy.y)) enemy.x = nx;
      if (!isWall(enemy.x, ny)) enemy.y = ny;
    }

    enemy.meleeCooldown -= dt;
    if (dist < enemy.meleeRange && enemy.meleeCooldown <= 0) {
      damagePlayer(enemy.meleeDamage);
      enemy.meleeCooldown = enemy.meleeCooldownBase;
      if (enemy.type === "kitten") playCatMeowSound();
    }

    enemy.rangedCooldown -= dt;
    if (enemy.canShoot && canSee && dist > 1.6 && dist < 9 && enemy.rangedCooldown <= 0) {
      enemyShoot(enemy);
      enemy.rangedCooldown = enemy.rangedCooldownBase + Math.random() * enemy.rangedCooldownJitter;
    }

    if (enemy.canSpawnKittens) {
      enemy.kittenSpawnCooldown -= dt;
      if (enemy.kittenSpawnCooldown <= 0 && livingKittensCount() < enemy.maxKittens) {
        if (spawnKittenNearBoss(enemy)) {
          enemy.kittenSpawnCooldown = enemy.kittenSpawnRate;
          playCatMeowSound();
        } else {
          enemy.kittenSpawnCooldown = 1.2;
        }
      }
    }
  }

  if (!portalActive && livingEnemyCount() === 0) {
    portalActive = true;
    playPortalSound();
    updateHud();
  }
}

function spawnBossWeaponDrop(enemy) {
  pickups.push({
    type: "bossWeapon",
    x: enemy.x,
    y: enemy.y,
    radius: 0.28,
    amount: 0,
    alive: true,
  });
}

function clearEnemiesCheat() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.alive = false;
    if (enemy.type === "boss") spawnBossWeaponDrop(enemy);
  }
  portalActive = true;
  playPortalSound();
  updateHud();
}

function runCheat(raw) {
  const cheat = raw.trim().toLowerCase();
  if (!cheat) {
    setCheatStatus("Enter a cheat code");
    return;
  }

  if (cheat === "/help" || cheat === "help") {
    const helpText = "Cheats: meow(minigun) | furball(god) | catnip(refill) | zoomies(speed) | hiss(clear lvl) | nap#(goto level) | resetcheats(reset)";
    setCheatStatus(helpText);
    addCheatHistory("/help", "listed cheats");
    return;
  }

  if (cheat === "meow") {
    PLAYER.hasMinigun = true;
    PLAYER.weaponMode = "minigun";
    PLAYER.ammo = Math.min(300, PLAYER.ammo + 80);
    setCheatStatus("Meow: Minigun unlocked");
    addCheatHistory("meow", "minigun unlocked");
    updateHud();
    return;
  }
  if (cheat === "furball") {
    godMode = !godMode;
    setCheatStatus(`Furball: Infinite health ${godMode ? "ON" : "OFF"}`);
    addCheatHistory("furball", `god ${godMode ? "on" : "off"}`);
    updateHud();
    return;
  }
  if (cheat === "catnip") {
    PLAYER.health = PLAYER.maxHealth;
    PLAYER.ammo = 300;
    setCheatStatus("Catnip: Health and ammo maxed");
    addCheatHistory("catnip", "restored");
    updateHud();
    return;
  }
  if (cheat === "zoomies") {
    speedBoost = !speedBoost;
    setCheatStatus(`Zoomies: Speed boost ${speedBoost ? "ON" : "OFF"}`);
    addCheatHistory("zoomies", `speed ${speedBoost ? "on" : "off"}`);
    updateHud();
    return;
  }
  if (cheat === "hiss") {
    clearEnemiesCheat();
    setCheatStatus("Hiss: Level cleared");
    addCheatHistory("hiss", "level cleared");
    return;
  }
  if (cheat === "resetcheats") {
    godMode = false;
    speedBoost = false;
    PLAYER.hasMinigun = false;
    PLAYER.weaponMode = "gun";
    setCheatStatus("ResetCheats: Cheats disabled");
    addCheatHistory("resetcheats", "all off");
    updateHud();
    return;
  }

  const napMatch = cheat.match(/^nap(\d+)$/);
  if (napMatch) {
    const levelNum = Number.parseInt(napMatch[1], 10);
    if (!Number.isFinite(levelNum) || levelNum < 1 || levelNum > LEVELS.length) {
      setCheatStatus(`Nap: level must be 1-${LEVELS.length}`);
      addCheatHistory(cheat, "invalid level");
      return;
    }

    gameOver = false;
    victory = false;
    startLevel(levelNum - 1, false);
    setCheatStatus(`Nap: jumped to level ${levelNum}`);
    addCheatHistory(cheat, `level ${levelNum}`);
    return;
  }

  setCheatStatus("Unknown cheat");
  addCheatHistory(cheat, "unknown");
}

function applyHitDamage(enemy, dmg) {
  enemy.health -= dmg;
  if (enemy.health > 0) return;
  enemy.alive = false;
  playEnemyDeathSound();
  if (enemy.type === "boss") {
    spawnBossWeaponDrop(enemy);
  }
}

function fireGun() {
  if (PLAYER.ammo <= 0) return;
  PLAYER.ammo -= 1;
  fireCooldown = 0.2;
  muzzleFlash = 0.06;
  playGunSound();

  let bestEnemy = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - PLAYER.x;
    const dy = enemy.y - PLAYER.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 11) continue;

    const enemyAngle = Math.atan2(dy, dx);
    const delta = Math.abs(normalizeAngle(enemyAngle - PLAYER.angle));
    if (delta > 0.1) continue;
    if (!lineOfSight(PLAYER.x, PLAYER.y, enemy.x, enemy.y)) continue;

    const score = delta * 3 + dist * 0.05;
    if (score < bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  if (bestEnemy) applyHitDamage(bestEnemy, 1);
}

function fireMinigun() {
  if (PLAYER.ammo <= 0) return;
  PLAYER.ammo -= 1;
  fireCooldown = 0.06;
  muzzleFlash = 0.05;
  playGunSound();

  let bestEnemy = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - PLAYER.x;
    const dy = enemy.y - PLAYER.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) continue;
    const enemyAngle = Math.atan2(dy, dx);
    const spread = (Math.random() - 0.5) * 0.05;
    const delta = Math.abs(normalizeAngle(enemyAngle - (PLAYER.angle + spread)));
    if (delta > 0.14) continue;
    if (!lineOfSight(PLAYER.x, PLAYER.y, enemy.x, enemy.y)) continue;
    const score = delta * 2.5 + dist * 0.04;
    if (score < bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }
  if (bestEnemy) applyHitDamage(bestEnemy, 1);
}

function spawnCannonBurst(x, y, power = 1) {
  cannonBursts.push({
    x,
    y,
    power,
    life: 0.32,
    maxLife: 0.32,
  });
}

function fireCannon() {
  if (PLAYER.ammo < 2) return;
  PLAYER.ammo -= 2;
  fireCooldown = 0.62;
  muzzleFlash = 0.16;
  recoilKick = Math.max(recoilKick, 11);
  playCannonSound();

  const candidates = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - PLAYER.x;
    const dy = enemy.y - PLAYER.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 13) continue;
    const enemyAngle = Math.atan2(dy, dx);
    const delta = Math.abs(normalizeAngle(enemyAngle - PLAYER.angle));
    if (delta > 0.24) continue;
    if (!lineOfSight(PLAYER.x, PLAYER.y, enemy.x, enemy.y)) continue;
    candidates.push({ enemy, dist });
  }

  candidates.sort((a, b) => a.dist - b.dist);
  for (let i = 0; i < Math.min(4, candidates.length); i += 1) {
    applyHitDamage(candidates[i].enemy, 4);
    spawnCannonBurst(candidates[i].enemy.x, candidates[i].enemy.y, 1 + (3 - i) * 0.2);
  }

  if (candidates.length === 0) {
    const fx = PLAYER.x + Math.cos(PLAYER.angle) * 8;
    const fy = PLAYER.y + Math.sin(PLAYER.angle) * 8;
    spawnCannonBurst(fx, fy, 0.9);
  }
}

function shoot() {
  if (fireCooldown > 0 || gameOver || victory) return;

  if (PLAYER.weaponMode === "cannon" && PLAYER.hasCannon) {
    fireCannon();
  } else if (PLAYER.weaponMode === "minigun" && PLAYER.hasMinigun) {
    fireMinigun();
  } else {
    fireGun();
  }
  updateHud();
}

function tryEnterPortal() {
  if (!portalActive || gameOver || victory) return;
  const dist = Math.hypot(PLAYER.x - portal.x, PLAYER.y - portal.y);
  if (dist > PLAYER.radius + portal.radius) return;

  if (currentLevel < LEVELS.length - 1) {
    startLevel(currentLevel + 1, false);
    return;
  }

  victory = true;
}

function update(dt) {
  if (!gameOver && !victory) {
    let moveX = 0;
    let moveY = 0;
    const forwardX = Math.cos(PLAYER.angle);
    const forwardY = Math.sin(PLAYER.angle);
    const rightX = Math.cos(PLAYER.angle + Math.PI / 2);
    const rightY = Math.sin(PLAYER.angle + Math.PI / 2);

    if (input.KeyW) {
      moveX += forwardX;
      moveY += forwardY;
    }
    if (input.KeyS) {
      moveX -= forwardX;
      moveY -= forwardY;
    }
    if (input.KeyA) {
      moveX -= rightX;
      moveY -= rightY;
    }
    if (input.KeyD) {
      moveX += rightX;
      moveY += rightY;
    }

    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
      moveX /= length;
      moveY /= length;
      const moveSpeed = PLAYER.speed * (speedBoost ? 1.65 : 1);
      tryMove(PLAYER.x + moveX * moveSpeed * dt, PLAYER.y + moveY * moveSpeed * dt);
    }

    if (input.ArrowLeft) PLAYER.angle -= PLAYER.turnSpeed * dt;
    if (input.ArrowRight) PLAYER.angle += PLAYER.turnSpeed * dt;

    if (input.jumpRequested && PLAYER.onGround) {
      PLAYER.vz = JUMP_VELOCITY;
      PLAYER.onGround = false;
    }
    input.jumpRequested = false;
  }

  PLAYER.vz -= GRAVITY * dt;
  PLAYER.z += PLAYER.vz * dt;
  const floorHeight = getFloorHeightAt(PLAYER.x, PLAYER.y);
  if (PLAYER.z <= floorHeight) {
    PLAYER.z = floorHeight;
    PLAYER.vz = 0;
    PLAYER.onGround = true;
  } else {
    PLAYER.onGround = false;
  }

  fireCooldown = Math.max(0, fireCooldown - dt);
  muzzleFlash = Math.max(0, muzzleFlash - dt);
  recoilKick *= 0.84;

  for (let i = cannonBursts.length - 1; i >= 0; i -= 1) {
    const burst = cannonBursts[i];
    burst.life -= dt;
    if (burst.life <= 0) cannonBursts.splice(i, 1);
  }

  if (input.shootRequested || input.MouseLeft) {
    shoot();
    input.shootRequested = false;
  }

  updateEnemies(dt);
  updateEnemyShots(dt);
  updatePickups();
  updatePlatformChallenge();
  tryEnterPortal();
}

function renderOverlay() {
  if (!gameOver && !victory) return;

  ctx.fillStyle = "#000000aa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4e6cf";
  ctx.textAlign = "center";
  ctx.font = "bold 52px Trebuchet MS";
  ctx.fillText(gameOver ? "YOU GOT SCRATCHED" : "YOU CLEARED ALL LEVELS", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "24px Trebuchet MS";
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 34);
}

function frame(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;

  update(dt);
  render3D();
  renderOverlay();

  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Tab") {
    e.preventDefault();
    toggleCheatConsole();
    return;
  }
  if (cheatOpen) return;
  initAudio();
  if (e.code === "Space") {
    e.preventDefault();
    input.jumpRequested = true;
  } else if (e.code in input) {
    input[e.code] = true;
  }
  if (e.code === "KeyE") toggleWeapon();
  if (e.code === "KeyN") cycleMinimapZoom();
  if (e.code === "KeyM") toggleMusic();
  if (e.code === "KeyR") resetGame();
});

document.addEventListener("keyup", (e) => {
  if (cheatOpen) return;
  if (e.code in input && e.code !== "Space") input[e.code] = false;
});

cheatInputEl.addEventListener("keydown", (e) => {
  if (e.code === "Enter") {
    e.preventDefault();
    runCheat(cheatInputEl.value);
    cheatInputEl.select();
    return;
  }
  if (e.code === "Escape" || e.code === "Tab") {
    e.preventDefault();
    toggleCheatConsole();
  }
});

canvas.addEventListener("click", () => {
  if (cheatOpen) return;
  initAudio();
  if (!hasPointerLock && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (cheatOpen) return;
  if (e.button !== 0) return;
  initAudio();
  input.MouseLeft = true;
  if (!hasPointerLock && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener("mouseup", (e) => {
  if (e.button === 0) input.MouseLeft = false;
});

document.addEventListener("pointerlockchange", () => {
  hasPointerLock = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", (e) => {
  if (!hasPointerLock || gameOver || victory) return;
  PLAYER.angle += e.movementX * 0.0022;
});

resetGame();
requestAnimationFrame(frame);
