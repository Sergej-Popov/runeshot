import {
  AbstractMesh,
  AssetContainer,
  AnimationGroup,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Node,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  Ray,
  Scene,
  SceneLoader,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import "@babylonjs/loaders/OBJ";
import "@babylonjs/loaders/glTF";
import {
  bossBarEl,
  bossHudEl,
  bossTextEl,
  canvas,
  cheatBadgesEl,
  cheatConsoleEl,
  cheatHistoryEl,
  cheatInputEl,
  cheatStatusEl,
  enemyEl,
  grenadeChargeBarEl,
  grenadeChargeHudEl,
  grenadesEl,
  healthBarEl,
  healthTextEl,
  levelEl,
  manaBarEl,
  manaTextEl,
  minimapCtx,
  minimapEl,
  serverDebugAuthEl,
  serverDebugLobbyEl,
  serverDebugPlayersEl,
  serverDebugRoomEl,
  serverDebugStateEl,
  serverDebugUrlEl,
  smokeGrenadesEl,
  staminaBarEl,
  staminaTextEl,
  weaponEl,
} from "./dom";
import {
  initAudio,
  playCannonSound,
  playCatMeowSound,
  playEnemyDeathSound,
  playFlamethrowerSound,
  playGrenadeBounceSound,
  playGrenadeExplodeSound,
  playGunSound,
  playPickupSound,
  playPlayerDeathSound,
  playPortalSound,
  toggleMusic,
} from "./audio";
import {
  cellKindForLevel,
  LEVELS,
  PIT_FLOOR_HEIGHT,
  MAP,
  enemyCountForLevel,
  floorHeightForLevel,
  isWallForLevel,
  isTrampolineForLevel,
  parseNapCheat,
} from "./game/state";
import { SERVER_AUTHORITATIVE_ONLY } from "./game/featureFlags";
import { animatePickupVisual, createPickupVisual, disposePickupVisual, type PickupVisual, type PickupVisualKind } from "./game/pickupVisuals";
import { LegacyMultiplayerSync } from "./multiplayer/legacySync";

type WeaponMode = "gun" | "cannon" | "minigun" | "flamethrower";
type EnemyType = "normal" | "boss" | "kitten";

type EnemyEntity = {
  mesh: TransformNode;
  type: EnemyType;
  health: number;
  maxHealth: number;
  speed: number;
  meleeDamage: number;
  meleeCooldown: number;
  shootCooldown: number;
  shootDelay: number;
  bulletSpeed: number;
  rangedDamage: number;
  spawnCooldown: number;
  aiMode: "push" | "strafe" | "flank" | "retreat" | "hide" | "roam";
  aiTimer: number;
  aiTarget: Vector3 | null;
  lastSeenPlayer: Vector3 | null;
  strafeDir: 1 | -1;
  runAnimation: AnimationGroup | null;
  wasMoving: boolean;
};

type EnemyShot = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  damage: number;
};

type PickupKind = "health" | "mana" | "grenade" | "flame";
type Pickup = {
  kind: PickupKind;
  amount: number;
  visual: PickupVisual;
};

type GrenadeProjectile = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  bouncesRemaining: number;
  kind: "explosive" | "smoke";
};

type GrenadeBurst = {
  mesh: Mesh;
  light: PointLight;
  life: number;
  flashLife: number;
  radius: number;
  systems: ParticleSystem[];
  cleanupAt: number;
  stopped: boolean;
};

type SmokeCloud = {
  systems: ParticleSystem[];
  life: number;
  cleanupAt: number;
  stopped: boolean;
};

type FlameStream = {
  nozzle: Mesh;
  core: ParticleSystem;
  smoke: ParticleSystem;
  embers: ParticleSystem;
};

type InputState = {
  KeyW: boolean;
  KeyA: boolean;
  KeyS: boolean;
  KeyD: boolean;
  ShiftLeft: boolean;
  ShiftRight: boolean;
  ArrowLeft: boolean;
  ArrowRight: boolean;
  Space: boolean;
  MouseLeft: boolean;
  MouseRight: boolean;
};

const TILE_SIZE = 2;
const MAP_W = MAP[0].length;
const MAP_H = MAP.length;
const EYE_HEIGHT = 1.35;
const WALL_HEIGHT = 3.8;
const PLAYER_RADIUS = 0.22;
const GRAVITY = 19;
const JUMP_VELOCITY = 8.2;
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 5.7 * 1.3;
const SPEED_BOOST_MULT = 1.2;
const MAX_STAMINA = 5;
const STAMINA_DRAIN_PER_SEC = 1;
const STAMINA_RECOVER_PER_SEC = 1;
const STAMINA_RECOVER_UNLOCK = 1.5;
const MAX_MANA = 220;
const MANA_RECOVER_PER_SEC = 0.75;
const FLAMETHROWER_MAX_FUEL = 220;
const PIT_DEPTH = PIT_FLOOR_HEIGHT;
const MINIMAP_SIZES = [150, 190, 230];
const TRAMPOLINE_RADIUS = TILE_SIZE * 0.27;

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

const input: InputState = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ShiftLeft: false,
  ShiftRight: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
  MouseLeft: false,
  MouseRight: false,
};

const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.06, 0.09, 1);

const camera = new UniversalCamera("player", new Vector3(0, EYE_HEIGHT, 0), scene);
camera.minZ = 0.05;
camera.fov = Math.PI / 3;
camera.inputs.clear();
scene.activeCamera = camera;

const light = new HemisphericLight("sun", new Vector3(0.35, 1, 0.2), scene);
light.intensity = 0.98;

const skybox = MeshBuilder.CreateSphere(
  "sky-dome",
  { diameter: 900, segments: 32, sideOrientation: VertexData.BACKSIDE },
  scene,
);
const skyboxMat = new StandardMaterial("skybox-mat", scene);
skyboxMat.backFaceCulling = false;
skyboxMat.disableLighting = true;
skyboxMat.specularColor = new Color3(0, 0, 0);
const skyTex = new DynamicTexture("skybox-tex", { width: 2048, height: 1024 }, scene, false);
const skyCtx = skyTex.getContext();
const grad = skyCtx.createLinearGradient(0, 0, 0, 1024);
grad.addColorStop(0, "#111a33");
grad.addColorStop(0.5, "#22345a");
grad.addColorStop(1, "#5e7fa6");
skyCtx.fillStyle = grad;
skyCtx.fillRect(0, 0, 2048, 1024);
for (let i = 0; i < 240; i += 1) {
  const x = Math.random() * 2048;
  const y = Math.random() * 700;
  const r = Math.random() * 1.6 + 0.2;
  skyCtx.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.65})`;
  skyCtx.beginPath();
  skyCtx.arc(x, y, r, 0, Math.PI * 2);
  skyCtx.fill();
}
skyTex.update(false);
skyTex.wrapU = Texture.WRAP_ADDRESSMODE;
skyTex.wrapV = Texture.CLAMP_ADDRESSMODE;
skyboxMat.emissiveTexture = skyTex;
skyboxMat.diffuseTexture = skyTex;
skybox.material = skyboxMat;
skybox.infiniteDistance = true;

const wallMat = new StandardMaterial("wall", scene);
wallMat.diffuseColor = new Color3(0.33, 0.33, 0.4);
wallMat.backFaceCulling = false;
const wallTex = new DynamicTexture("wall-brick-tex", { width: 1024, height: 1024 }, scene, false);
const wallCtx = wallTex.getContext();
wallCtx.fillStyle = "#6a4a3a";
wallCtx.fillRect(0, 0, 1024, 1024);

const brickH = 64;
const brickW = 128;
for (let row = 0; row < 16; row += 1) {
  const y = row * brickH;
  const offset = (row % 2) * (brickW / 2);
  for (let x = -brickW; x < 1024 + brickW; x += brickW) {
    const bx = x + offset;
    const tint = 92 + Math.floor(Math.random() * 36);
    wallCtx.fillStyle = `rgb(${tint + 28}, ${tint + 8}, ${tint - 6})`;
    wallCtx.fillRect(bx + 2, y + 2, brickW - 4, brickH - 4);

    wallCtx.fillStyle = "rgba(255,255,255,0.08)";
    wallCtx.fillRect(bx + 8, y + 8, brickW - 24, 6);
    wallCtx.fillStyle = "rgba(0,0,0,0.15)";
    wallCtx.fillRect(bx + 6, y + brickH - 12, brickW - 16, 5);
  }
}

wallCtx.strokeStyle = "rgba(40,28,22,0.65)";
wallCtx.lineWidth = 2;
for (let y = 0; y <= 1024; y += brickH) {
  wallCtx.beginPath();
  wallCtx.moveTo(0, y);
  wallCtx.lineTo(1024, y);
  wallCtx.stroke();
}

wallTex.update(false);
wallTex.wrapU = Texture.WRAP_ADDRESSMODE;
wallTex.wrapV = Texture.WRAP_ADDRESSMODE;
wallTex.vScale = 1.2;
wallMat.diffuseTexture = wallTex;
wallMat.specularColor = new Color3(0.08, 0.08, 0.08);
const floorMat = new StandardMaterial("floor", scene);
floorMat.diffuseColor = new Color3(0.2, 0.2, 0.24);
const pitMat = new StandardMaterial("pit", scene);
pitMat.diffuseColor = new Color3(0.04, 0.04, 0.05);
const platformMat = new StandardMaterial("platform", scene);
platformMat.diffuseColor = new Color3(0.35, 0.23, 0.17);
const stairMat = new StandardMaterial("stair", scene);
stairMat.diffuseColor = new Color3(0.46, 0.36, 0.22);
const trampolineMat = new StandardMaterial("trampoline", scene);
trampolineMat.diffuseColor = new Color3(0.15, 0.15, 0.18);
trampolineMat.emissiveColor = new Color3(0.04, 0.7, 0.6);
const portalMat = new StandardMaterial("portal", scene);
portalMat.diffuseColor = new Color3(0.1, 0.6, 0.95);
portalMat.emissiveColor = new Color3(0.1, 0.8, 1.0);

const grenadeFlameMat = new StandardMaterial("grenade-flame", scene);
grenadeFlameMat.emissiveColor = new Color3(1.0, 0.62, 0.2);
grenadeFlameMat.diffuseColor = new Color3(0.78, 0.3, 0.08);
const grenadeSmokeMat = new StandardMaterial("grenade-smoke", scene);
grenadeSmokeMat.emissiveColor = new Color3(0.22, 0.16, 0.12);
grenadeSmokeMat.diffuseColor = new Color3(0.18, 0.16, 0.15);
grenadeSmokeMat.alpha = 0.5;
const smokeParticleTex = new DynamicTexture("smoke-particle-tex", { width: 128, height: 128 }, scene, false);
const smokeCtx = smokeParticleTex.getContext();
const smokeGrad = smokeCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
smokeGrad.addColorStop(0, "rgba(255,255,255,0.95)");
smokeGrad.addColorStop(0.35, "rgba(210,210,210,0.72)");
smokeGrad.addColorStop(0.75, "rgba(120,120,120,0.32)");
smokeGrad.addColorStop(1, "rgba(30,30,30,0)");
smokeCtx.fillStyle = smokeGrad;
smokeCtx.fillRect(0, 0, 128, 128);
for (let i = 0; i < 120; i += 1) {
  smokeCtx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
  smokeCtx.beginPath();
  smokeCtx.arc(Math.random() * 128, Math.random() * 128, Math.random() * 2.8 + 0.4, 0, Math.PI * 2);
  smokeCtx.fill();
}
smokeParticleTex.update(false);
const fireParticleTex = new DynamicTexture("fire-particle-tex", { width: 128, height: 128 }, scene, false);
const fireCtx = fireParticleTex.getContext();
const fireGrad = fireCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
fireGrad.addColorStop(0, "rgba(255,255,230,1)");
fireGrad.addColorStop(0.22, "rgba(255,190,80,0.95)");
fireGrad.addColorStop(0.55, "rgba(255,95,25,0.7)");
fireGrad.addColorStop(1, "rgba(40,10,0,0)");
fireCtx.fillStyle = fireGrad;
fireCtx.fillRect(0, 0, 128, 128);
fireParticleTex.update(false);

let levelMeshes: AbstractMesh[] = [];
let wallMeshes: AbstractMesh[] = [];
let enemies: EnemyEntity[] = [];
let enemyShots: EnemyShot[] = [];
let pickups: Pickup[] = [];
let grenadeProjectiles: GrenadeProjectile[] = [];
let grenadeBursts: GrenadeBurst[] = [];
let smokeClouds: SmokeCloud[] = [];
let flameStream: FlameStream | null = null;
let enemyModelContainer: AssetContainer | null = null;
let enemyModelHeight = 1;
let enemyModelId = 0;
let portalMesh: Mesh | null = null;
let gunRoot: TransformNode | null = null;
let gunSlide: Mesh | null = null;
let gunBobTime = 0;
let recoil = 0;

let currentLevel = 0;
let health = 100;
let maxHealth = 100;
let mana = 60;
let grenades = 1;
let smokeGrenades = 2;
let portalActive = false;
let gameOver = false;
let victory = false;
let speedBoost = false;
let godMode = false;
let cheatOpen = false;
let hasCannon = false;
let hasMinigun = false;
let hasFlamethrower = false;
let flameFuel = 0;
let weaponMode: WeaponMode = "gun";
let jumpQueued = false;
let isGrounded = true;
let verticalVelocity = 0;
let trampolineLock = false;
let yaw = 0;
let pitch = 0;
let fireCooldown = 0;
let grenadeCooldown = 0;
let grenadeChargeStart = 0;
let pointerLocked = false;
let safeSpawn = { x: 2.2, y: 2.2 };
let lastTime = performance.now();
let minimapSizeIndex = 1;
let stamina = MAX_STAMINA;
let sprintExhausted = false;
const cheatHistory: string[] = [];
let multiplayerSync: LegacyMultiplayerSync | null = null;
let multiplayerRespawnSeconds = 0;
let multiplayerWasDowned = false;

function tryAcquirePointerLock(): void {
  if (cheatOpen) return;
  if (document.pointerLockElement === canvas) return;
  const req = canvas.requestPointerLock();
  if (req && typeof req.catch === "function") {
    req.catch(() => {});
  }
}

function mapToWorld(mx: number, my: number, y = 0): Vector3 {
  return new Vector3((mx - MAP_W / 2) * TILE_SIZE, y, (my - MAP_H / 2) * TILE_SIZE);
}

function worldToMap(pos: Vector3): { x: number; y: number } {
  return {
    x: pos.x / TILE_SIZE + MAP_W / 2,
    y: pos.z / TILE_SIZE + MAP_H / 2,
  };
}

function isWallAt(mx: number, my: number): boolean {
  return isWallForLevel(currentLevel, mx, my);
}

function floorHeightAtMap(mx: number, my: number): number {
  return floorHeightForLevel(currentLevel, mx, my);
}

function floorHeightAtWorld(pos: Vector3): number {
  const map = worldToMap(pos);
  return floorHeightAtMap(map.x, map.y);
}

function isOnTrampolinePad(pos: Vector3): boolean {
  const map = worldToMap(pos);
  if (!isTrampolineForLevel(currentLevel, map.x, map.y)) return false;
  const cx = Math.floor(map.x) + 0.5;
  const cy = Math.floor(map.y) + 0.5;
  const dx = map.x - cx;
  const dy = map.y - cy;
  return dx * dx + dy * dy <= (TRAMPOLINE_RADIUS / TILE_SIZE) * (TRAMPOLINE_RADIUS / TILE_SIZE);
}

function canOccupyMap(mx: number, my: number, radius = PLAYER_RADIUS): boolean {
  return !(
    isWallAt(mx - radius, my - radius) ||
    isWallAt(mx + radius, my - radius) ||
    isWallAt(mx - radius, my + radius) ||
    isWallAt(mx + radius, my + radius)
  );
}

function isSafeGroundAt(mx: number, my: number): boolean {
  return floorHeightAtMap(mx, my) > PIT_DEPTH + 0.2;
}

function setCheatStatus(text: string): void {
  cheatStatusEl.textContent = text;
}

function addCheatHistory(command: string, result: string): void {
  cheatHistory.unshift(`${command} -> ${result}`);
  if (cheatHistory.length > 4) cheatHistory.length = 4;
  cheatHistoryEl.innerHTML = cheatHistory.map((row) => `<div>${row}</div>`).join("");
}

function updateCheatBadges(): void {
  const badges: string[] = [];
  if (godMode) badges.push("FURBALL");
  if (speedBoost) badges.push("ZOOMIES");
  if (hasMinigun) badges.push("MEOW");
  cheatBadgesEl.classList.toggle("hidden", badges.length === 0);
  cheatBadgesEl.innerHTML = badges.map((b) => `<span class=\"cheat-badge\">${b}</span>`).join("");
}

function updateHud(): void {
  const hp = Math.max(0, Math.floor(health));
  healthTextEl.textContent = `Health: ${hp}`;
  healthBarEl.style.width = `${Math.max(0, Math.min(100, (health / maxHealth) * 100))}%`;
  const staminaPct = Math.max(0, Math.min(100, (stamina / MAX_STAMINA) * 100));
  staminaTextEl.textContent = `Stamina: ${Math.round(staminaPct)}%`;
  staminaBarEl.style.width = `${staminaPct}%`;
  levelEl.textContent = multiplayerRespawnSeconds > 0
    ? `Respawn: ${multiplayerRespawnSeconds}s`
    : `Level: ${currentLevel + 1}/${LEVELS.length}`;
  manaTextEl.textContent = `Mana: ${Math.floor(mana)}/${MAX_MANA}`;
  manaBarEl.style.width = `${Math.max(0, Math.min(100, (mana / MAX_MANA) * 100))}%`;
  grenadesEl.textContent = `Grenades: ${grenades}/3`;
  smokeGrenadesEl.textContent = `Smoke: ${smokeGrenades}/2`;
  const weaponName = weaponMode === "flamethrower"
    ? `Flamethrower (${Math.max(0, Math.ceil(flameFuel))})`
    : `${weaponMode[0].toUpperCase()}${weaponMode.slice(1)}`;
  weaponEl.textContent = `Weapon: ${weaponName}`;

  const alive = enemies.filter((e) => e.health > 0).length;
  if (multiplayerSync) {
    if (multiplayerRespawnSeconds > 0) {
      enemyEl.textContent = `You died. Respawning in ${multiplayerRespawnSeconds}s`;
    } else {
      enemyEl.textContent = portalActive ? "Portal: Enter!" : `Server Cats: ${multiplayerSync.getServerCatCount()}`;
    }
  } else {
    enemyEl.textContent = portalActive ? "Portal: Enter!" : `Cat Fiends: ${alive}/${enemies.length}`;
  }

  const boss = enemies.find((e) => e.type === "boss" && e.health > 0);
  bossHudEl.classList.toggle("hidden", !boss);
  if (boss) {
    bossTextEl.textContent = `Boss HP: ${Math.ceil(boss.health)}/${Math.ceil(boss.maxHealth)}`;
    bossBarEl.style.width = `${Math.max(0, Math.min(100, (boss.health / boss.maxHealth) * 100))}%`;
  }

  updateCheatBadges();
}

function setGrenadeChargeHud(active: boolean, power01 = 0): void {
  grenadeChargeHudEl.classList.toggle("hidden", !active);
  grenadeChargeBarEl.style.width = `${Math.max(0, Math.min(100, power01 * 100))}%`;
}

function applyMinimapSize(): void {
  const size = MINIMAP_SIZES[minimapSizeIndex];
  minimapEl.width = size;
  minimapEl.height = size;
  minimapEl.style.width = `${size}px`;
  minimapEl.style.height = `${size}px`;
}

function drawMinimap(): void {
  const size = minimapEl.width;
  const cell = size / MAP_W;
  const toMiniY = (mapY: number): number => size - mapY * cell;

  minimapCtx.clearRect(0, 0, size, size);
  minimapCtx.fillStyle = "rgba(10, 14, 20, 0.9)";
  minimapCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (isWallAt(x, y)) {
        minimapCtx.fillStyle = "#5b6476";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
        continue;
      }
      const kind = cellKindForLevel(currentLevel, x, y);
      if (kind === "pit") {
        minimapCtx.fillStyle = "#131313";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      } else if (kind === "trampoline") {
        minimapCtx.fillStyle = "#29d4bd";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      } else if (kind === "stairs") {
        minimapCtx.fillStyle = "#9f8a62";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      } else if (kind === "platform") {
        minimapCtx.fillStyle = "#8a6543";
        minimapCtx.fillRect(x * cell, toMiniY(y + 1), cell, cell);
      }
    }
  }

  if (portalMesh && portalMesh.isVisible) {
    const mp = worldToMap(portalMesh.position);
    minimapCtx.fillStyle = "#22d4ff";
    minimapCtx.beginPath();
    minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(3, cell * 0.28), 0, Math.PI * 2);
    minimapCtx.fill();
  }

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const mp = worldToMap(enemy.mesh.position);
    minimapCtx.fillStyle = enemy.type === "boss" ? "#ff5a2f" : enemy.type === "kitten" ? "#ffd17a" : "#ff7a7a";
    minimapCtx.beginPath();
    minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(2.5, cell * 0.22), 0, Math.PI * 2);
    minimapCtx.fill();
  }

  if (multiplayerSync) {
    const catMarkers = multiplayerSync.getRemoteCatMinimapMarkers();
    for (const marker of catMarkers) {
      const mp = worldToMap(new Vector3(marker.x, 0, marker.z));
      minimapCtx.fillStyle = "#ffd17a";
      minimapCtx.beginPath();
      minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(2.8, cell * 0.24), 0, Math.PI * 2);
      minimapCtx.fill();
    }

    const remoteMarkers = multiplayerSync.getRemoteMinimapMarkers();
    for (const marker of remoteMarkers) {
      const mp = worldToMap(new Vector3(marker.x, 0, marker.z));
      minimapCtx.fillStyle = "#ff3b3b";
      minimapCtx.beginPath();
      minimapCtx.arc(mp.x * cell, toMiniY(mp.y), Math.max(2.8, cell * 0.24), 0, Math.PI * 2);
      minimapCtx.fill();
    }
  }

  const p = worldToMap(camera.position);
  minimapCtx.fillStyle = "#22a7ff";
  minimapCtx.beginPath();
  minimapCtx.arc(p.x * cell, toMiniY(p.y), Math.max(3, cell * 0.24), 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.strokeStyle = "#22a7ff";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(p.x * cell, toMiniY(p.y));
  minimapCtx.lineTo((p.x + Math.sin(yaw) * 0.9) * cell, toMiniY(p.y + Math.cos(yaw) * 0.9));
  minimapCtx.stroke();
}

function makeGunModel(): void {
  gunRoot = new TransformNode("gun-root", scene);
  gunRoot.parent = camera;
  gunRoot.position = new Vector3(0.34, -0.97, 1.1);

  const gunMat = new StandardMaterial("gun-mat", scene);
  gunMat.diffuseColor = new Color3(0.2, 0.2, 0.22);

  const body = MeshBuilder.CreateBox("gun-body", { width: 0.38, height: 0.2, depth: 0.9 }, scene);
  body.parent = gunRoot;
  body.material = gunMat;

  const barrel = MeshBuilder.CreateBox("gun-barrel", { width: 0.18, height: 0.14, depth: 0.6 }, scene);
  barrel.parent = gunRoot;
  barrel.position = new Vector3(0, 0.03, 0.7);
  barrel.material = gunMat;
  gunSlide = barrel;

  const rear = MeshBuilder.CreateBox("gun-rear", { width: 0.24, height: 0.12, depth: 0.18 }, scene);
  rear.parent = gunRoot;
  rear.position = new Vector3(0, 0.06, -0.34);
  rear.material = gunMat;
}

function stopFlameStream(): void {
  if (!flameStream) return;
  flameStream.core.stop();
  flameStream.smoke.stop();
  flameStream.embers.stop();
}

function disposeFlameStream(): void {
  if (!flameStream) return;
  flameStream.core.dispose();
  flameStream.smoke.dispose();
  flameStream.embers.dispose();
  flameStream.nozzle.dispose();
  flameStream = null;
}

function ensureFlameStream(): FlameStream {
  if (flameStream) return flameStream;
  const nozzle = MeshBuilder.CreateBox("flame-nozzle", { size: 0.02 }, scene);
  nozzle.parent = camera;
  nozzle.position = new Vector3(0.27, -0.16, 0.86);
  nozzle.isVisible = false;
  nozzle.isPickable = false;

  const core = new ParticleSystem("flamethrower-core", 1100, scene);
  core.particleTexture = fireParticleTex;
  core.emitter = nozzle;
  core.minEmitBox = new Vector3(-0.03, -0.03, -0.03);
  core.maxEmitBox = new Vector3(0.03, 0.03, 0.03);
  core.color1 = new Color4(1.0, 0.86, 0.45, 0.95);
  core.color2 = new Color4(1.0, 0.42, 0.12, 0.85);
  core.colorDead = new Color4(0.25, 0.1, 0.02, 0);
  core.minSize = 0.22;
  core.maxSize = 0.6;
  core.minLifeTime = 0.14;
  core.maxLifeTime = 0.32;
  core.emitRate = 0;
  core.isLocal = true;
  core.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  core.direction1 = new Vector3(-0.11, -0.06, 1.0);
  core.direction2 = new Vector3(0.11, 0.09, 1.0);
  core.gravity = new Vector3(0, -1.2, 0);
  core.minEmitPower = 5.8;
  core.maxEmitPower = 10.8;
  core.updateSpeed = 0.012;

  const embers = new ParticleSystem("flamethrower-embers", 850, scene);
  embers.particleTexture = fireParticleTex;
  embers.emitter = nozzle;
  embers.minEmitBox = new Vector3(-0.03, -0.03, -0.03);
  embers.maxEmitBox = new Vector3(0.03, 0.03, 0.03);
  embers.color1 = new Color4(1.0, 0.55, 0.18, 0.85);
  embers.color2 = new Color4(1.0, 0.3, 0.05, 0.72);
  embers.colorDead = new Color4(0.12, 0.04, 0.02, 0);
  embers.minSize = 0.06;
  embers.maxSize = 0.14;
  embers.minLifeTime = 0.18;
  embers.maxLifeTime = 0.46;
  embers.emitRate = 0;
  embers.isLocal = true;
  embers.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  embers.direction1 = new Vector3(-0.15, -0.08, 1.0);
  embers.direction2 = new Vector3(0.15, 0.12, 1.0);
  embers.gravity = new Vector3(0, -3.1, 0);
  embers.minEmitPower = 7.2;
  embers.maxEmitPower = 13.2;
  embers.updateSpeed = 0.012;

  const smoke = new ParticleSystem("flamethrower-smoke", 1000, scene);
  smoke.particleTexture = smokeParticleTex;
  smoke.emitter = nozzle;
  smoke.minEmitBox = new Vector3(-0.08, -0.06, -0.08);
  smoke.maxEmitBox = new Vector3(0.08, 0.06, 0.08);
  smoke.color1 = new Color4(0.36, 0.34, 0.33, 0.42);
  smoke.color2 = new Color4(0.14, 0.14, 0.14, 0.3);
  smoke.colorDead = new Color4(0.04, 0.04, 0.04, 0);
  smoke.minSize = 0.14;
  smoke.maxSize = 0.48;
  smoke.minLifeTime = 0.35;
  smoke.maxLifeTime = 0.95;
  smoke.emitRate = 0;
  smoke.isLocal = true;
  smoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  smoke.direction1 = new Vector3(-0.09, 0.02, 1.0);
  smoke.direction2 = new Vector3(0.09, 0.22, 1.0);
  smoke.gravity = new Vector3(0, 0.72, 0);
  smoke.minEmitPower = 3.2;
  smoke.maxEmitPower = 6.2;
  smoke.updateSpeed = 0.02;

  flameStream = { nozzle, core, smoke, embers };
  return flameStream;
}

function updateFlameStreamVisual(active: boolean): void {
  const stream = ensureFlameStream();
  stream.nozzle.position.set(0.27, -0.16, 0.86);

  if (!active) {
    stream.core.emitRate = 0;
    stream.embers.emitRate = 0;
    stream.smoke.emitRate = 0;
    stopFlameStream();
    return;
  }

  stream.core.emitRate = 760;
  stream.embers.emitRate = 430;
  stream.smoke.emitRate = 220;
  stream.core.start();
  stream.embers.start();
  stream.smoke.start();
}

function disposeLevel(): void {
  disposeFlameStream();
  for (const mesh of [...levelMeshes, ...wallMeshes]) mesh.dispose();
  levelMeshes = [];
  wallMeshes = [];

  for (const enemy of enemies) {
    enemy.runAnimation?.stop();
    enemy.runAnimation?.dispose();
    enemy.mesh.dispose();
  }
  enemies = [];

  for (const shot of enemyShots) shot.mesh.dispose();
  enemyShots = [];
  for (const grenade of grenadeProjectiles) grenade.mesh.dispose();
  grenadeProjectiles = [];
  for (const burst of grenadeBursts) {
    for (const sys of burst.systems) sys.dispose();
    burst.light.dispose();
    burst.mesh.dispose();
  }
  grenadeBursts = [];
  for (const cloud of smokeClouds) {
    for (const sys of cloud.systems) sys.dispose();
  }
  smokeClouds = [];

  for (const pickup of pickups) {
    disposePickupVisual(pickup.visual);
  }
  pickups = [];

  if (portalMesh) {
    portalMesh.dispose();
    portalMesh = null;
  }
}

function createWall(x: number, y: number): void {
  const cx = (x + 0.5 - MAP_W / 2) * TILE_SIZE;
  const cz = (y + 0.5 - MAP_H / 2) * TILE_SIZE;
  const py = WALL_HEIGHT / 2;
  const half = TILE_SIZE / 2;

  const makeFace = (name: string, px: number, pz: number, rotY: number): void => {
    const face = MeshBuilder.CreatePlane(
      name,
      { width: TILE_SIZE, height: WALL_HEIGHT },
      scene,
    );
    face.position = new Vector3(px, py, pz);
    face.rotation.y = rotY;
    face.material = wallMat;
    wallMeshes.push(face);
  };

  if (!isWallAt(x, y - 1)) makeFace(`wall-n-${x}-${y}`, cx, cz - half, Math.PI);
  if (!isWallAt(x, y + 1)) makeFace(`wall-s-${x}-${y}`, cx, cz + half, 0);
  if (!isWallAt(x - 1, y)) makeFace(`wall-w-${x}-${y}`, cx - half, cz, Math.PI / 2);
  if (!isWallAt(x + 1, y)) makeFace(`wall-e-${x}-${y}`, cx + half, cz, -Math.PI / 2);

  const top = MeshBuilder.CreateGround(`wall-top-${x}-${y}`, { width: TILE_SIZE, height: TILE_SIZE }, scene);
  top.position = new Vector3(cx, WALL_HEIGHT, cz);
  top.material = wallMat;
  wallMeshes.push(top);
}

function createFloorTile(x: number, y: number): void {
  const height = floorHeightAtMap(x + 0.5, y + 0.5);
  const kind = cellKindForLevel(currentLevel, x, y);
  if (height <= PIT_DEPTH + 0.01) {
    const bottom = MeshBuilder.CreateBox(`pit-${x}-${y}`, { width: TILE_SIZE, depth: TILE_SIZE, height: 0.3 }, scene);
    bottom.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height - 0.15));
    bottom.material = pitMat;
    levelMeshes.push(bottom);

    if (kind === "trampoline") {
      const disc = MeshBuilder.CreateCylinder(`trampoline-disc-${x}-${y}`, {
        height: 0.14,
        diameter: TRAMPOLINE_RADIUS * 2,
        tessellation: 32,
      }, scene);
      disc.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height + 0.07));
      disc.material = trampolineMat;
      levelMeshes.push(disc);

      const ring = MeshBuilder.CreateTorus(`trampoline-ring-${x}-${y}`, {
        diameter: TRAMPOLINE_RADIUS * 2.12,
        thickness: 0.08,
        tessellation: 32,
      }, scene);
      ring.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height + 0.16));
      ring.rotation.x = Math.PI / 2;
      ring.material = trampolineMat;
      levelMeshes.push(ring);
    }
    return;
  }

  const thickness = Math.max(0.3, height + 0.3);
  const block = MeshBuilder.CreateBox(`floor-${x}-${y}`, { width: TILE_SIZE, depth: TILE_SIZE, height: thickness }, scene);
  block.position.copyFrom(mapToWorld(x + 0.5, y + 0.5, height - thickness / 2));
  block.material = kind === "stairs" ? stairMat : kind === "platform" ? platformMat : floorMat;
  levelMeshes.push(block);
}

function buildLevelGeometry(): void {
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (isWallAt(x, y)) createWall(x, y);
      else createFloorTile(x, y);
    }
  }

  const portal = LEVELS[currentLevel].portal;
  portalMesh = MeshBuilder.CreateTorus("portal", { diameter: 1.9, thickness: 0.24, tessellation: 24 }, scene);
  portalMesh.position.copyFrom(mapToWorld(portal.x, portal.y, 1.5));
  portalMesh.material = portalMat;
  portalMesh.isVisible = false;
}

async function loadEnemyModelTemplate(): Promise<void> {
  if (enemyModelContainer) return;

  try {
    const container = await SceneLoader.LoadAssetContainerAsync("/models/", "lowpoly_cat_rig__run_animation.glb", scene);
    for (const group of container.animationGroups) group.stop();
    enemyModelContainer = container;

    const probe = container.instantiateModelsToScene((name) => `cat-probe-${name}`, false);
    const probeRoot = new TransformNode("cat-probe-root", scene);
    for (const root of probe.rootNodes) root.parent = probeRoot;
    probeRoot.computeWorldMatrix(true);
    const bounds = probeRoot.getHierarchyBoundingVectors(true);
    enemyModelHeight = Math.max(0.1, bounds.max.y - bounds.min.y);
    for (const group of probe.animationGroups) {
      group.stop();
      group.dispose();
    }
    probeRoot.dispose(false, true);
  } catch (err) {
    console.warn("Could not load animated cat model from /models; using procedural cat.", err);
    enemyModelContainer = null;
  }
}

function instantiateEnemyModel(type: EnemyType, pos: Vector3): { root: TransformNode; runAnimation: AnimationGroup | null } | null {
  if (!enemyModelContainer) return null;
  const id = enemyModelId++;
  const instance = enemyModelContainer.instantiateModelsToScene((name) => `cat-${id}-${name}`, false);

  const actorRoot = new TransformNode(`cat-actor-${type}-${id}`, scene);
  actorRoot.position.set(pos.x, 0, pos.z);

  for (const root of instance.rootNodes) root.parent = actorRoot;
  for (const root of instance.rootNodes) {
    if (root instanceof AbstractMesh) root.isPickable = true;
    for (const child of root.getChildMeshes(false)) child.isPickable = true;
  }

  const targetHeight = type === "boss" ? 2.52 : type === "kitten" ? 1.02 : 1.5;
  const scale = targetHeight / enemyModelHeight;
  actorRoot.scaling.set(scale, scale, scale);
  actorRoot.computeWorldMatrix(true);
  const bounds = actorRoot.getHierarchyBoundingVectors(true);
  actorRoot.position.y += -bounds.min.y + 0.02;
  actorRoot.rotation.y = Math.PI;
  const runAnimation = instance.animationGroups[0] ?? null;
  if (runAnimation) runAnimation.stop();
  for (let i = 1; i < instance.animationGroups.length; i += 1) instance.animationGroups[i].stop();
  return { root: actorRoot, runAnimation };
}

function createEnemy(type: EnemyType, mx: number, my: number): EnemyEntity {
  const pos = mapToWorld(mx, my, floorHeightAtMap(mx, my));
  const importedMesh = instantiateEnemyModel(type, pos);
  if (importedMesh) {
    const mesh = importedMesh.root;
    if (type === "boss") {
      return {
        mesh,
        type,
        health: 42,
        maxHealth: 42,
        speed: 1.3,
        meleeDamage: 22,
        meleeCooldown: 0.8,
        shootCooldown: 0.5,
        shootDelay: 0.85,
        bulletSpeed: 13.5,
        rangedDamage: 20,
        spawnCooldown: 3.8,
        aiMode: "push",
        aiTimer: 0.4 + Math.random() * 0.8,
        aiTarget: null,
        lastSeenPlayer: null,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        runAnimation: importedMesh.runAnimation,
        wasMoving: false,
      };
    }

    if (type === "kitten") {
      return {
        mesh,
        type,
        health: 1,
        maxHealth: 1,
        speed: 5.3,
        meleeDamage: 8,
        meleeCooldown: 0.3,
        shootCooldown: 999,
        shootDelay: 999,
        bulletSpeed: 0,
        rangedDamage: 0,
        spawnCooldown: 999,
        aiMode: "push",
        aiTimer: 0.4,
        aiTarget: null,
        lastSeenPlayer: null,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        runAnimation: importedMesh.runAnimation,
        wasMoving: false,
      };
    }

    const levelScale = currentLevel + 1;
    return {
      mesh,
      type,
      health: 2 + levelScale,
      maxHealth: 2 + levelScale,
      speed: 1.8 + Math.min(1.2, currentLevel * 0.14),
      meleeDamage: 8 + currentLevel * 2,
      meleeCooldown: 0.2,
      shootCooldown: 0.8,
      shootDelay: Math.max(0.42, 1.05 - currentLevel * 0.08),
      bulletSpeed: Math.max(8.5, 11.6 - (currentLevel === 3 ? 1.6 : 0)),
      rangedDamage: 8 + currentLevel * 2,
      spawnCooldown: 999,
      aiMode: "push",
      aiTimer: 0.45 + Math.random() * 0.9,
      aiTarget: null,
      lastSeenPlayer: null,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      runAnimation: importedMesh.runAnimation,
      wasMoving: false,
    };
  }

  const size = (type === "boss" ? 1.38 : type === "kitten" ? 0.62 : 1.0) * 0.7;
  const body = MeshBuilder.CreateSphere(`cat-body-${type}`, {
    diameterX: 1.05 * size,
    diameterY: 0.72 * size,
    diameterZ: 1.55 * size,
    segments: 12,
  }, scene);
  body.position.y = 0.52 * size;

  const head = MeshBuilder.CreateSphere(`cat-head-${type}`, {
    diameterX: 0.64 * size,
    diameterY: 0.58 * size,
    diameterZ: 0.58 * size,
    segments: 12,
  }, scene);
  head.position.y = 0.84 * size;
  head.position.z = 0.62 * size;

  const earL = MeshBuilder.CreateCylinder(`cat-earl-${type}`, {
    height: 0.3 * size,
    diameterTop: 0.01 * size,
    diameterBottom: 0.2 * size,
    tessellation: 3,
  }, scene);
  earL.position = new Vector3(-0.15 * size, 1.14 * size, 0.73 * size);
  earL.rotation.z = 0.08;
  earL.rotation.x = -0.1;

  const earR = earL.clone(`cat-earr-${type}`)!;
  earR.position.x = 0.15 * size;
  earR.rotation.z = -0.08;

  const tail = MeshBuilder.CreateCylinder(`cat-tail-${type}`, {
    height: 0.68 * size,
    diameterTop: 0.1 * size,
    diameterBottom: 0.14 * size,
    tessellation: 8,
  }, scene);
  tail.position = new Vector3(0, 0.68 * size, -0.82 * size);
  tail.rotation.x = Math.PI / 2.6;

  const pawA = MeshBuilder.CreateBox(`cat-paw-a-${type}`, {
    width: 0.2 * size,
    height: 0.16 * size,
    depth: 0.2 * size,
  }, scene);
  pawA.position = new Vector3(-0.22 * size, 0.15 * size, 0.35 * size);
  const pawB = pawA.clone(`cat-paw-b-${type}`)!;
  pawB.position.x = 0.22 * size;
  const pawC = pawA.clone(`cat-paw-c-${type}`)!;
  pawC.position.z = -0.35 * size;
  const pawD = pawB.clone(`cat-paw-d-${type}`)!;
  pawD.position.z = -0.35 * size;

  const parts: Mesh[] = [body, head, earL, earR, tail, pawA, pawB, pawC, pawD];
  if (type !== "kitten") {
    const gun = MeshBuilder.CreateBox(`cat-gun-${type}`, {
      width: 0.2 * size,
      height: 0.16 * size,
      depth: 0.58 * size,
    }, scene);
    gun.position = new Vector3(0.34 * size, 0.54 * size, 0.52 * size);
    gun.rotation.y = 0.08;
    parts.push(gun);
  }

  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  const mesh = merged ?? body;

  const mat = new StandardMaterial(`enemy-${type}-mat`, scene);
  if (type === "boss") mat.diffuseColor = new Color3(0.55, 0.45, 0.3);
  else if (type === "kitten") mat.diffuseColor = new Color3(0.9, 0.86, 0.8);
  else mat.diffuseColor = new Color3(0.78, 0.62, 0.49);
  mesh.material = mat;
  mesh.position = new Vector3(pos.x, type === "boss" ? 1.0 : type === "kitten" ? 0.56 : 0.72, pos.z);

  if (type === "boss") {
    return {
      mesh,
      type,
      health: 42,
      maxHealth: 42,
      speed: 1.3,
      meleeDamage: 22,
      meleeCooldown: 0.8,
      shootCooldown: 0.5,
      shootDelay: 0.85,
      bulletSpeed: 13.5,
      rangedDamage: 20,
      spawnCooldown: 3.8,
      aiMode: "push",
      aiTimer: 0.4 + Math.random() * 0.8,
      aiTarget: null,
      lastSeenPlayer: null,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      runAnimation: null,
      wasMoving: false,
    };
  }

  if (type === "kitten") {
    return {
      mesh,
      type,
      health: 1,
      maxHealth: 1,
      speed: 5.3,
      meleeDamage: 8,
      meleeCooldown: 0.3,
      shootCooldown: 999,
      shootDelay: 999,
      bulletSpeed: 0,
      rangedDamage: 0,
      spawnCooldown: 999,
      aiMode: "push",
      aiTimer: 0.4,
      aiTarget: null,
      lastSeenPlayer: null,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      runAnimation: null,
      wasMoving: false,
    };
  }

  const levelScale = currentLevel + 1;
  return {
    mesh,
    type,
    health: 2 + levelScale,
    maxHealth: 2 + levelScale,
    speed: 1.8 + Math.min(1.2, currentLevel * 0.14),
    meleeDamage: 8 + currentLevel * 2,
    meleeCooldown: 0.2,
    shootCooldown: 0.8,
    shootDelay: Math.max(0.42, 1.05 - currentLevel * 0.08),
    bulletSpeed: Math.max(8.5, 11.6 - (currentLevel === 3 ? 1.6 : 0)),
    rangedDamage: 8 + currentLevel * 2,
    spawnCooldown: 999,
    aiMode: "push",
    aiTimer: 0.45 + Math.random() * 0.9,
    aiTarget: null,
    lastSeenPlayer: null,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    runAnimation: null,
    wasMoving: false,
  };
}

function spawnEnemiesForLevel(): void {
  if (SERVER_AUTHORITATIVE_ONLY || multiplayerSync) return;

  const config = LEVELS[currentLevel];
  const levelSpawn = LEVELS[currentLevel].playerSpawn;
  const playerSpawnWorld = mapToWorld(levelSpawn.x, levelSpawn.y);
  const minSpawnDistance = 6.2;
  if (config.bossFight) {
    const boss = createEnemy("boss", 11.5, 8.0);
    resolveEnemySpawnPosition(boss, 11.5, 8.0, playerSpawnWorld, minSpawnDistance);
    enemies.push(boss);
    return;
  }

  const count = enemyCountForLevel(currentLevel);
  let created = 0;
  for (let attempt = 0; attempt < SPAWN_POINTS.length * 5 && created < count; attempt += 1) {
    const pick = SPAWN_POINTS[(attempt + currentLevel * 3) % SPAWN_POINTS.length];
    if (isWallAt(pick.x, pick.y)) continue;
    if (!isSafeGroundAt(pick.x, pick.y)) continue;
    if (Vector3.Distance(mapToWorld(pick.x, pick.y), playerSpawnWorld) < minSpawnDistance) continue;
    const enemy = createEnemy("normal", pick.x, pick.y);
    resolveEnemySpawnPosition(enemy, pick.x, pick.y, playerSpawnWorld, minSpawnDistance);
    if (Vector3.Distance(enemy.mesh.position, playerSpawnWorld) < minSpawnDistance) {
      enemy.mesh.dispose();
      continue;
    }
    if (!isSafeGroundAt(worldToMap(enemy.mesh.position).x, worldToMap(enemy.mesh.position).y)) {
      enemy.mesh.dispose();
      continue;
    }
    enemies.push(enemy);
    created += 1;
  }
}

function createPickupModel(kind: PickupKind, id: number, mx: number, my: number, amount: number): Pickup {
  const floor = floorHeightAtMap(mx, my);
  const position = mapToWorld(mx, my, floor + 0.4);
  const visual = createPickupVisual(scene, `${kind}-${id}`, kind as PickupVisualKind, position);
  return {
    kind,
    amount,
    visual,
  };
}

function spawnPickupsForLevel(): void {
  if (SERVER_AUTHORITATIVE_ONLY || multiplayerSync) return;

  const healthCount = Math.max(2, 3 + Math.floor(currentLevel / 2) + (currentLevel === 3 ? 2 : 0));
  const manaCount = 4;
  const grenadeCount = 1 + Math.floor(currentLevel / 3);
  const flameCount = currentLevel >= 1 ? 1 + Math.floor(currentLevel / 4) : 0;
  const pickPoint = (index: number): { x: number; y: number } => {
    for (let tries = 0; tries < PICKUP_POINTS.length; tries += 1) {
      const p = PICKUP_POINTS[(index + tries) % PICKUP_POINTS.length];
      if (isWallAt(p.x, p.y)) continue;
      if (!isSafeGroundAt(p.x, p.y)) continue;
      return p;
    }
    return PICKUP_POINTS[index % PICKUP_POINTS.length];
  };

  for (let i = 0; i < healthCount; i += 1) {
    const p = pickPoint(i + currentLevel);
    pickups.push(createPickupModel("health", i, p.x, p.y, 22));
  }

  for (let i = 0; i < manaCount; i += 1) {
    const p = pickPoint(i + currentLevel * 2 + 3);
    pickups.push(createPickupModel("mana", i, p.x, p.y, 50));
  }

  for (let i = 0; i < grenadeCount; i += 1) {
    const p = pickPoint(i + currentLevel * 3 + 5);
    pickups.push(createPickupModel("grenade", i, p.x, p.y, 1));
  }

  for (let i = 0; i < flameCount; i += 1) {
    const p = pickPoint(i + currentLevel * 5 + 7);
    pickups.push(createPickupModel("flame", i, p.x, p.y, 120));
  }
}

function resetPlayerAtSpawn(mx: number, my: number): void {
  let sx = mx;
  let sy = my;

  if (!canOccupyMap(sx, sy, PLAYER_RADIUS) || !isSafeGroundAt(sx, sy)) {
    let found = false;
    for (let radius = 0.35; radius <= 4.2 && !found; radius += 0.3) {
      const steps = Math.max(12, Math.floor(12 + radius * 10));
      for (let i = 0; i < steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        const cx = mx + Math.sin(a) * radius;
        const cy = my + Math.cos(a) * radius;
        if (!canOccupyMap(cx, cy, PLAYER_RADIUS)) continue;
        if (!isSafeGroundAt(cx, cy)) continue;
        sx = cx;
        sy = cy;
        found = true;
        break;
      }
    }
  }

  const world = mapToWorld(sx, sy);
  const floor = floorHeightAtMap(sx, sy);
  camera.position = new Vector3(world.x, floor + EYE_HEIGHT, world.z);
  verticalVelocity = 0;
  isGrounded = true;
  trampolineLock = false;
  safeSpawn = { x: sx, y: sy };
}

function startLevel(levelIndex: number, freshRun = false): void {
  currentLevel = levelIndex;
  portalActive = false;
  gameOver = false;
  victory = false;

  disposeLevel();
  buildLevelGeometry();
  spawnEnemiesForLevel();
  spawnPickupsForLevel();

  const spawn = LEVELS[currentLevel].playerSpawn;
  resetPlayerAtSpawn(spawn.x, spawn.y);

  if (!freshRun) {
    health = Math.min(maxHealth, health + 18);
    mana = Math.min(MAX_MANA, mana + 16);
  }

  if (portalMesh) portalMesh.isVisible = false;
  setCheatStatus(`Level ${currentLevel + 1}`);
  updateHud();
}

function resetRun(): void {
  health = maxHealth;
  mana = 60;
  grenades = 1;
  smokeGrenades = 2;
  stamina = MAX_STAMINA;
  sprintExhausted = false;
  hasCannon = false;
  hasMinigun = false;
  weaponMode = "gun";
  speedBoost = false;
  godMode = false;
  startLevel(0, true);
}

function damagePlayer(amount: number): void {
  if (godMode || gameOver) return;
  health -= amount;
  if (health <= 0) {
    health = 0;
    gameOver = true;
    playPlayerDeathSound();
    setCheatStatus("You got shredded. Press R to restart.");
  }
  updateHud();
}

function setPortalActive(active: boolean): void {
  if (portalActive === active) {
    if (portalMesh) portalMesh.isVisible = active;
    return;
  }
  portalActive = active;
  if (portalMesh) portalMesh.isVisible = active;
  if (active) playPortalSound();
  updateHud();
}

function killEnemy(enemy: EnemyEntity): void {
  enemy.health = 0;
  enemy.runAnimation?.stop();
  enemy.runAnimation?.dispose();
  enemy.runAnimation = null;
  enemy.mesh.dispose();
  playEnemyDeathSound();

  if (enemy.type === "boss") {
    hasCannon = true;
    weaponMode = "cannon";
    mana = Math.min(MAX_MANA, mana + 35);
  }
}

function damageEnemy(enemy: EnemyEntity, amount: number): void {
  if (enemy.health <= 0) return;
  enemy.health -= amount;
  if (enemy.health <= 0) {
    killEnemy(enemy);
    if (!portalActive && enemies.filter((e) => e.health > 0).length === 0) setPortalActive(true);
  }
  updateHud();
}

function findEnemyByMesh(mesh: AbstractMesh): EnemyEntity | undefined {
  let cursor: Node | null = mesh;
  while (cursor) {
    const found = enemies.find((e) => e.mesh === cursor && e.health > 0);
    if (found) return found;
    cursor = cursor.parent;
  }
  return undefined;
}

function applyFlamethrowerDamage(): void {
  const from = camera.position.add(new Vector3(0, -0.18, 0));
  const forward = camera.getDirection(new Vector3(0, 0.02, 1)).normalize();
  const maxDistance = 6.2;
  const coneCos = Math.cos(0.46);

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const toEnemy = enemy.mesh.position.add(new Vector3(0, 0.42, 0)).subtract(from);
    const dist = toEnemy.length();
    if (dist > maxDistance || dist < 0.001) continue;
    const dir = toEnemy.scale(1 / dist);
    const facing = Vector3.Dot(forward, dir);
    if (facing < coneCos) continue;
    if (!lineOfSight(from, enemy.mesh.position.add(new Vector3(0, 0.42, 0)))) continue;
    const dmg = 0.45 + (1 - dist / maxDistance) * 0.9;
    damageEnemy(enemy, dmg);
  }
}

function fireWeapon(): void {
  if (gameOver || victory) return;

  if (SERVER_AUTHORITATIVE_ONLY || multiplayerSync) {
    if (!multiplayerSync) return;
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.22;
    recoil = 0.1;
    playGunSound();
    const aimDir = camera.getDirection(new Vector3(0, 0, 1)).normalize();
    multiplayerSync.sendShoot({
      dirX: aimDir.x,
      dirY: aimDir.y,
      dirZ: aimDir.z,
    });
    updateHud();
    return;
  }

  let damage = 1;
  let splash = 0;

  if (weaponMode === "flamethrower") {
    if (flameFuel <= 0) {
      weaponMode = hasCannon ? "cannon" : hasMinigun ? "minigun" : "gun";
      updateHud();
      stopFlameStream();
      return;
    }
    flameFuel = Math.max(0, flameFuel - 2.1);
    fireCooldown = 0.04;
    recoil = 0.02;
    playFlamethrowerSound();
    applyFlamethrowerDamage();
    updateFlameStreamVisual(true);
    if (flameFuel <= 0.001) {
      flameFuel = 0;
      weaponMode = hasCannon ? "cannon" : hasMinigun ? "minigun" : "gun";
      updateFlameStreamVisual(false);
    }
    updateHud();
    return;
  } else if (weaponMode === "cannon") {
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.58;
    damage = 4;
    splash = 2.2;
    recoil = 0.17;
    playCannonSound();
  } else if (weaponMode === "minigun") {
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.055;
    damage = 1;
    recoil = 0.04;
    playGunSound();
  } else {
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.18;
    damage = 1;
    recoil = 0.09;
    playGunSound();
  }

  const ray = camera.getForwardRay(60);
  const pick = scene.pickWithRay(ray, (mesh) => Boolean(mesh && findEnemyByMesh(mesh)));
  if (pick?.hit && pick.pickedMesh) {
    const enemy = findEnemyByMesh(pick.pickedMesh);
    if (enemy) {
      damageEnemy(enemy, damage);
      if (splash > 0) {
        for (const other of enemies) {
          if (other.health <= 0 || other === enemy) continue;
          const dist = Vector3.Distance(other.mesh.position, enemy.mesh.position);
          if (dist <= splash) damageEnemy(other, Math.max(1, damage - 1));
        }
      }
    }
  }

  updateHud();
}

function explodeGrenade(at: Vector3): void {
  playGrenadeExplodeSound();

  const burstMesh = MeshBuilder.CreateSphere("grenade-burst", { diameter: 0.8, segments: 16 }, scene);
  const burstMat = new StandardMaterial("grenade-burst-mat", scene);
  burstMat.emissiveColor = new Color3(1.0, 0.66, 0.2);
  burstMat.alpha = 0.45;
  burstMesh.material = burstMat;
  burstMesh.position.copyFrom(at);

  const burstLight = new PointLight("grenade-burst-light", at.clone(), scene);
  burstLight.diffuse = new Color3(1.0, 0.55, 0.2);
  burstLight.intensity = 4.2;
  burstLight.range = 10;

  const radius = 3.2;
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const dist = Vector3.Distance(enemy.mesh.position, at);
    if (dist > radius) continue;
    const dmg = Math.max(2, 8 - dist * 1.8);
    damageEnemy(enemy, dmg);
  }

  const distToPlayer = Vector3.Distance(camera.position, at);
  if (distToPlayer < radius) {
    damagePlayer(Math.max(0, 22 - distToPlayer * 6));
  }

  const flameBurst = new ParticleSystem("grenade-flame-burst", 420, scene);
  flameBurst.particleTexture = fireParticleTex;
  flameBurst.emitter = at.clone();
  flameBurst.minEmitBox = new Vector3(-0.1, -0.05, -0.1);
  flameBurst.maxEmitBox = new Vector3(0.1, 0.12, 0.1);
  flameBurst.color1 = new Color4(1, 0.8, 0.35, 1);
  flameBurst.color2 = new Color4(1, 0.38, 0.08, 0.85);
  flameBurst.colorDead = new Color4(0.2, 0.05, 0.01, 0);
  flameBurst.minSize = 0.24;
  flameBurst.maxSize = 0.72;
  flameBurst.minLifeTime = 0.22;
  flameBurst.maxLifeTime = 0.55;
  flameBurst.emitRate = 1200;
  flameBurst.manualEmitCount = 250;
  flameBurst.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  flameBurst.gravity = new Vector3(0, -2.4, 0);
  flameBurst.direction1 = new Vector3(-2.8, 1.4, -2.8);
  flameBurst.direction2 = new Vector3(2.8, 2.7, 2.8);
  flameBurst.minEmitPower = 1.2;
  flameBurst.maxEmitPower = 4.4;
  flameBurst.updateSpeed = 0.015;
  flameBurst.start();

  const emberBurst = new ParticleSystem("grenade-ember-burst", 360, scene);
  emberBurst.particleTexture = fireParticleTex;
  emberBurst.emitter = at.clone();
  emberBurst.minEmitBox = new Vector3(-0.15, 0.02, -0.15);
  emberBurst.maxEmitBox = new Vector3(0.15, 0.2, 0.15);
  emberBurst.color1 = new Color4(1, 0.62, 0.15, 0.9);
  emberBurst.color2 = new Color4(1, 0.45, 0.08, 0.8);
  emberBurst.colorDead = new Color4(0.18, 0.08, 0.03, 0);
  emberBurst.minSize = 0.08;
  emberBurst.maxSize = 0.2;
  emberBurst.minLifeTime = 0.35;
  emberBurst.maxLifeTime = 1.05;
  emberBurst.emitRate = 1000;
  emberBurst.manualEmitCount = 180;
  emberBurst.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  emberBurst.gravity = new Vector3(0, -3.2, 0);
  emberBurst.direction1 = new Vector3(-3.4, 0.8, -3.4);
  emberBurst.direction2 = new Vector3(3.4, 2.1, 3.4);
  emberBurst.minEmitPower = 1.8;
  emberBurst.maxEmitPower = 5.0;
  emberBurst.updateSpeed = 0.015;
  emberBurst.start();

  grenadeBursts.push({
    mesh: burstMesh,
    light: burstLight,
    life: 0.34,
    flashLife: 0.34,
    radius,
    systems: [flameBurst, emberBurst],
    cleanupAt: -1.1,
    stopped: false,
  });
}

function explodeSmokeGrenade(at: Vector3): void {
  const core = new ParticleSystem("smoke-core", 1300, scene);
  core.particleTexture = smokeParticleTex;
  core.emitter = at.clone();
  core.minEmitBox = new Vector3(-0.25, 0.05, -0.25);
  core.maxEmitBox = new Vector3(0.25, 0.35, 0.25);
  core.color1 = new Color4(0.15, 0.15, 0.15, 0.72);
  core.color2 = new Color4(0.27, 0.27, 0.27, 0.62);
  core.colorDead = new Color4(0.1, 0.1, 0.1, 0);
  core.minSize = 0.85;
  core.maxSize = 2.2;
  core.minLifeTime = 1.8;
  core.maxLifeTime = 3.8;
  core.emitRate = 420;
  core.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  core.gravity = new Vector3(0, 0.36, 0);
  core.direction1 = new Vector3(-0.65, 0.5, -0.65);
  core.direction2 = new Vector3(0.65, 1.0, 0.65);
  core.minAngularSpeed = -0.6;
  core.maxAngularSpeed = 0.6;
  core.minEmitPower = 0.08;
  core.maxEmitPower = 0.52;
  core.updateSpeed = 0.015;
  core.start();

  const wisps = new ParticleSystem("smoke-wisps", 900, scene);
  wisps.particleTexture = smokeParticleTex;
  wisps.emitter = at.clone();
  wisps.minEmitBox = new Vector3(-0.6, 0.1, -0.6);
  wisps.maxEmitBox = new Vector3(0.6, 0.5, 0.6);
  wisps.color1 = new Color4(0.35, 0.35, 0.35, 0.46);
  wisps.color2 = new Color4(0.2, 0.2, 0.2, 0.36);
  wisps.colorDead = new Color4(0.08, 0.08, 0.08, 0);
  wisps.minSize = 1.4;
  wisps.maxSize = 3.6;
  wisps.minLifeTime = 2.3;
  wisps.maxLifeTime = 5.2;
  wisps.emitRate = 260;
  wisps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  wisps.gravity = new Vector3(0, 0.28, 0);
  wisps.direction1 = new Vector3(-0.8, 0.35, -0.8);
  wisps.direction2 = new Vector3(0.8, 0.9, 0.8);
  wisps.minAngularSpeed = -0.35;
  wisps.maxAngularSpeed = 0.35;
  wisps.minEmitPower = 0.04;
  wisps.maxEmitPower = 0.34;
  wisps.updateSpeed = 0.017;
  wisps.start();

  smokeClouds.push({
    systems: [core, wisps],
    life: 3.2,
    cleanupAt: -3.2,
    stopped: false,
  });
}

function throwGrenade(chargeSeconds = 0): void {
  throwTypedGrenade("explosive", chargeSeconds);
}

function throwSmokeGrenade(): void {
  throwTypedGrenade("smoke", 0.5);
}

function throwTypedGrenade(kind: "explosive" | "smoke", chargeSeconds = 0): void {
  if (grenadeCooldown > 0 || gameOver || victory) return;
  if (kind === "explosive") {
    if (grenades <= 0) {
      setCheatStatus("No explosive grenades");
      return;
    }
    grenades -= 1;
  } else {
    if (smokeGrenades <= 0) {
      setCheatStatus("No smoke grenades");
      return;
    }
    smokeGrenades -= 1;
  }
  grenadeCooldown = 0.45;
  updateHud();

  const mesh = MeshBuilder.CreateSphere("grenade", { diameter: 0.22, segments: 10 }, scene);
  const mat = new StandardMaterial("grenade-mat", scene);
  mat.diffuseColor = kind === "explosive" ? new Color3(0.28, 0.45, 0.18) : new Color3(0.46, 0.46, 0.5);
  mesh.material = mat;
  mesh.position = camera.position.add(camera.getDirection(new Vector3(0, -0.03, 1)).normalize().scale(0.85));

  const charge01 = Math.max(0, Math.min(1, chargeSeconds / 1.25));
  const throwSpeed = 8.2 + charge01 * 13.8;
  const throwDir = camera.getDirection(new Vector3(0, 0.12, 1)).normalize();
  grenadeProjectiles.push({
    mesh,
    velocity: throwDir.scale(throwSpeed),
    life: 1.1 + charge01 * 1.1,
    bouncesRemaining: 5,
    kind,
  });
}

function spawnEnemyShot(enemy: EnemyEntity): void {
  const from = enemy.mesh.position.add(new Vector3(0, 0.8, 0));
  const to = camera.position.add(new Vector3(0, -0.4, 0));
  const dir = to.subtract(from).normalize();

  const mesh = MeshBuilder.CreateSphere("enemy-shot", { diameter: 0.2 }, scene);
  const mat = new StandardMaterial("enemy-shot-mat", scene);
  mat.emissiveColor = enemy.type === "boss" ? new Color3(1, 0.45, 0.1) : new Color3(1, 0.7, 0.2);
  mesh.material = mat;
  mesh.position.copyFrom(from);

  enemyShots.push({
    mesh,
    velocity: dir.scale(enemy.bulletSpeed),
    life: 2.2,
    damage: enemy.rangedDamage,
  });
  playCatMeowSound();
}

function lineOfSight(from: Vector3, to: Vector3): boolean {
  const dir = to.subtract(from);
  const len = dir.length();
  if (len <= 0.001) return true;

  const ray = new Ray(from, dir.normalize(), len);
  const hit = scene.pickWithRay(ray, (mesh) => wallMeshes.includes(mesh));
  return !(hit?.hit && (hit.distance ?? len) < len - 0.15);
}

function spawnKittenNearBoss(boss: EnemyEntity): void {
  const livingKittens = enemies.filter((e) => e.type === "kitten" && e.health > 0).length;
  if (livingKittens >= 6) return;

  const offsets = [
    new Vector3(0.8, 0, 0),
    new Vector3(-0.8, 0, 0),
    new Vector3(0, 0, 0.8),
    new Vector3(0, 0, -0.8),
  ];

  for (const off of offsets) {
    const world = boss.mesh.position.add(off);
    if (Vector3.Distance(world, camera.position) < 2.8) continue;
    const m = worldToMap(world);
    if (!canOccupyMap(m.x, m.y, 0.2)) continue;
    if (!isSafeGroundAt(m.x, m.y)) continue;
    enemies.push(createEnemy("kitten", m.x, m.y));
    playCatMeowSound();
    return;
  }
}

function enemyRadius(enemy: EnemyEntity): number {
  if (enemy.type === "boss") return 0.52;
  if (enemy.type === "kitten") return 0.2;
  return 0.22;
}

function resolveEnemySpawnPosition(
  enemy: EnemyEntity,
  mx: number,
  my: number,
  avoidPos?: Vector3,
  minDistanceFromAvoid = 0,
): void {
  const r = enemyRadius(enemy);
  const isFarEnough = (x: number, y: number): boolean => {
    if (!avoidPos || minDistanceFromAvoid <= 0) return true;
    const w = mapToWorld(x, y);
    return Vector3.Distance(w, avoidPos) >= minDistanceFromAvoid;
  };
  const isValidEnemyTile = (x: number, y: number): boolean => floorHeightAtMap(x, y) > PIT_DEPTH + 0.2;
  if (canOccupyMap(mx, my, r) && isFarEnough(mx, my) && isValidEnemyTile(mx, my)) {
    const w = mapToWorld(mx, my);
    enemy.mesh.position.x = w.x;
    enemy.mesh.position.y = floorHeightAtMap(mx, my);
    enemy.mesh.position.z = w.z;
    return;
  }

  for (let radius = 0.45; radius <= 4.2; radius += 0.35) {
    const steps = Math.max(10, Math.floor(10 + radius * 8));
    for (let i = 0; i < steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      const cx = mx + Math.sin(a) * radius;
      const cy = my + Math.cos(a) * radius;
      if (!canOccupyMap(cx, cy, r)) continue;
      if (!isValidEnemyTile(cx, cy)) continue;
      if (!isFarEnough(cx, cy)) continue;
      const w = mapToWorld(cx, cy);
      enemy.mesh.position.x = w.x;
      enemy.mesh.position.y = floorHeightAtMap(cx, cy);
      enemy.mesh.position.z = w.z;
      return;
    }
  }
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function rotateEnemyToward(enemy: EnemyEntity, dir: Vector3, dt: number, speed = 6.4): void {
  if (dir.lengthSquared() < 0.0001) return;
  const desired = Math.atan2(dir.x, dir.z);
  const delta = normalizeAngle(desired - enemy.mesh.rotation.y);
  enemy.mesh.rotation.y += Math.max(-speed * dt, Math.min(speed * dt, delta));
}

function setEnemyRunAnimationState(enemy: EnemyEntity, running: boolean): void {
  if (!enemy.runAnimation) return;
  if (enemy.wasMoving === running) return;
  enemy.wasMoving = running;
  if (running) {
    enemy.runAnimation.start(true);
  } else {
    enemy.runAnimation.stop();
  }
}

function tryMoveEnemy(enemy: EnemyEntity, moveDir: Vector3, amount: number): boolean {
  if (moveDir.lengthSquared() < 0.0001 || amount <= 0) return false;
  const dir = moveDir.normalize();
  const prev = enemy.mesh.position.clone();
  const currentFloor = floorHeightAtWorld(prev);
  let moved = false;

  const candX = prev.add(new Vector3(dir.x * amount, 0, 0));
  const mapX = worldToMap(candX);
  if (canOccupyMap(mapX.x, mapX.y, enemyRadius(enemy))) {
    const floorX = floorHeightAtMap(mapX.x, mapX.y);
    if (floorX > PIT_DEPTH + 0.2 && floorX - currentFloor <= 0.66) {
      enemy.mesh.position.x = candX.x;
      moved = true;
    }
  }

  const candZ = prev.add(new Vector3(0, 0, dir.z * amount));
  const mapZ = worldToMap(candZ);
  if (canOccupyMap(mapZ.x, mapZ.y, enemyRadius(enemy))) {
    const floorZ = floorHeightAtMap(mapZ.x, mapZ.y);
    if (floorZ > PIT_DEPTH + 0.2 && floorZ - currentFloor <= 0.66) {
      enemy.mesh.position.z = candZ.z;
      moved = true;
    }
  }
  enemy.mesh.position.y = floorHeightAtWorld(enemy.mesh.position);

  return moved;
}

function mapCellCenterWorld(cx: number, cy: number, y = 0): Vector3 {
  return mapToWorld(cx + 0.5, cy + 0.5, y);
}

function mapKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseMapKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map((v) => Number(v));
  return { x, y };
}

function isEnemyWalkableCell(x: number, y: number, r: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  if (!canOccupyMap(x + 0.5, y + 0.5, r)) return false;
  return floorHeightAtMap(x + 0.5, y + 0.5) > PIT_DEPTH + 0.2;
}

function findEnemyPathWaypoint(enemy: EnemyEntity, targetWorld: Vector3): Vector3 | null {
  const r = enemyRadius(enemy);
  const startMap = worldToMap(enemy.mesh.position);
  const goalMap = worldToMap(targetWorld);
  const sx = Math.max(0, Math.min(MAP_W - 1, Math.floor(startMap.x)));
  const sy = Math.max(0, Math.min(MAP_H - 1, Math.floor(startMap.y)));
  const gx = Math.max(0, Math.min(MAP_W - 1, Math.floor(goalMap.x)));
  const gy = Math.max(0, Math.min(MAP_H - 1, Math.floor(goalMap.y)));

  if (!isEnemyWalkableCell(sx, sy, r)) return null;
  if (!isEnemyWalkableCell(gx, gy, r)) return null;

  const start = mapKey(sx, sy);
  const goal = mapKey(gx, gy);
  if (start === goal) return mapCellCenterWorld(gx, gy, enemy.mesh.position.y);

  const queue: string[] = [start];
  const came = new Map<string, string | null>();
  came.set(start, null);
  const visited = new Set<string>([start]);

  let bestKey = start;
  let bestDist = Math.hypot(gx - sx, gy - sy);
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === goal) {
      bestKey = goal;
      break;
    }

    const c = parseMapKey(cur);
    for (const d of dirs) {
      const nx = c.x + d.x;
      const ny = c.y + d.y;
      const nk = mapKey(nx, ny);
      if (visited.has(nk)) continue;
      if (!isEnemyWalkableCell(nx, ny, r)) continue;
      const curFloor = floorHeightAtMap(c.x + 0.5, c.y + 0.5);
      const nextFloor = floorHeightAtMap(nx + 0.5, ny + 0.5);
      if (nextFloor - curFloor > 0.66) continue;
      if (Math.abs(d.x) + Math.abs(d.y) === 2) {
        if (!isEnemyWalkableCell(c.x + d.x, c.y, r) || !isEnemyWalkableCell(c.x, c.y + d.y, r)) continue;
      }

      visited.add(nk);
      came.set(nk, cur);
      queue.push(nk);

      const dist = Math.hypot(gx - nx, gy - ny);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = nk;
      }
    }
  }

  if (!came.has(bestKey)) return null;
  const revPath: string[] = [];
  let cur: string | null = bestKey;
  while (cur) {
    revPath.push(cur);
    cur = came.get(cur) ?? null;
  }
  const path = revPath.reverse();
  const nextKey = path[Math.min(1, path.length - 1)];
  const next = parseMapKey(nextKey);
  return mapCellCenterWorld(next.x, next.y, enemy.mesh.position.y);
}

function rotateY(dir: Vector3, angle: number): Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Vector3(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c);
}

function computeEnemySteerDirection(enemy: EnemyEntity, desiredTarget: Vector3): Vector3 {
  const raw = desiredTarget.subtract(enemy.mesh.position);
  raw.y = 0;
  if (raw.lengthSquared() < 0.0001) return Vector3.Zero();
  const desired = raw.normalize();
  const r = enemyRadius(enemy);
  const ahead = enemy.mesh.position.add(desired.scale(1.0));
  const aheadMap = worldToMap(ahead);
  if (canOccupyMap(aheadMap.x, aheadMap.y, r)) return desired;

  const samples = [0, -0.25, 0.25, -0.45, 0.45, -0.7, 0.7, -1.0, 1.0, -1.25, 1.25, Math.PI];
  let bestDir: Vector3 | null = null;
  let bestScore = -99999;
  for (const a of samples) {
    const cand = rotateY(desired, a);
    const p = enemy.mesh.position.add(cand.scale(0.95));
    const m = worldToMap(p);
    if (!canOccupyMap(m.x, m.y, r)) continue;

    let clearance = 0;
    const step = r * 1.9;
    for (const ox of [-step, 0, step]) {
      for (const oy of [-step, 0, step]) {
        if (!isWallAt(m.x + ox, m.y + oy)) clearance += 1;
      }
    }
    const progress = cand.dot(desired);
    const targetDist = Vector3.Distance(p, desiredTarget);
    const score = progress * 2.8 + clearance * 0.22 - targetDist * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestDir = cand;
    }
  }

  return bestDir ?? desired;
}

function computeNavigatedMoveDir(enemy: EnemyEntity, desiredTarget: Vector3): Vector3 {
  const from = enemy.mesh.position.add(new Vector3(0, 0.7, 0));
  const to = new Vector3(desiredTarget.x, enemy.mesh.position.y + 0.7, desiredTarget.z);
  if (lineOfSight(from, to)) return computeEnemySteerDirection(enemy, desiredTarget);

  const waypoint = findEnemyPathWaypoint(enemy, desiredTarget);
  if (waypoint) return computeEnemySteerDirection(enemy, waypoint);
  return computeEnemySteerDirection(enemy, desiredTarget);
}

function pickRoamTarget(enemy: EnemyEntity): Vector3 | null {
  const base = enemy.mesh.position;
  for (let i = 0; i < 12; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.8 + Math.random() * 4.6;
    const p = new Vector3(base.x + Math.sin(a) * r, 0, base.z + Math.cos(a) * r);
    const m = worldToMap(p);
    if (canOccupyMap(m.x, m.y, enemyRadius(enemy))) return mapToWorld(m.x, m.y, base.y);
  }
  return null;
}

function pickCoverTarget(enemy: EnemyEntity, playerPos: Vector3): Vector3 | null {
  const base = enemy.mesh.position;
  for (let i = 0; i < 20; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.2 + Math.random() * 5.2;
    const p = new Vector3(base.x + Math.sin(a) * r, 0, base.z + Math.cos(a) * r);
    const m = worldToMap(p);
    if (!canOccupyMap(m.x, m.y, enemyRadius(enemy))) continue;
    const w = mapToWorld(m.x, m.y, base.y);
    const hidden = !lineOfSight(w.add(new Vector3(0, 0.8, 0)), playerPos.add(new Vector3(0, -0.2, 0)));
    if (hidden) return w;
  }
  return null;
}

function pickFlankTarget(enemy: EnemyEntity, playerPos: Vector3): Vector3 | null {
  const fromPlayer = enemy.mesh.position.subtract(playerPos);
  fromPlayer.y = 0;
  if (fromPlayer.lengthSquared() < 0.0001) fromPlayer.set(1, 0, 0);
  fromPlayer.normalize();
  const side = new Vector3(fromPlayer.z, 0, -fromPlayer.x).scale(enemy.strafeDir);
  for (let i = 0; i < 6; i += 1) {
    const dist = 3.2 + i * 0.75;
    const cand = playerPos.add(side.scale(dist)).add(fromPlayer.scale(1.2 + i * 0.25));
    const m = worldToMap(cand);
    if (!canOccupyMap(m.x, m.y, enemyRadius(enemy))) continue;
    return mapToWorld(m.x, m.y, enemy.mesh.position.y);
  }
  return null;
}

function retargetEnemyAi(enemy: EnemyEntity, playerPos: Vector3, canSee: boolean, dist: number): void {
  if (enemy.type === "kitten") {
    enemy.aiMode = dist < 1.6 ? "strafe" : "push";
    enemy.aiTimer = 0.35 + Math.random() * 0.35;
    enemy.aiTarget = null;
    if (enemy.aiMode === "strafe") enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
    return;
  }

  if (canSee) enemy.lastSeenPlayer = playerPos.clone();

  const lowHealth = enemy.health <= Math.max(2, enemy.maxHealth * 0.35);
  if (lowHealth && Math.random() < 0.75) {
    enemy.aiMode = "retreat";
    enemy.aiTimer = 0.9 + Math.random() * 1.1;
    enemy.aiTarget = null;
    return;
  }

  if (canSee) {
    if (dist < 2.2) {
      enemy.aiMode = "retreat";
      enemy.aiTimer = 0.6 + Math.random() * 0.8;
      enemy.aiTarget = null;
      return;
    }

    const roll = Math.random();
    if (roll < 0.38) {
      enemy.aiMode = "strafe";
      enemy.aiTimer = 0.8 + Math.random() * 1.15;
      enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
      enemy.aiTarget = null;
      return;
    }

    if (roll < 0.68) {
      enemy.aiMode = "flank";
      enemy.aiTimer = 1.1 + Math.random() * 1.2;
      enemy.aiTarget = pickFlankTarget(enemy, playerPos) ?? pickRoamTarget(enemy);
      return;
    }

    enemy.aiMode = "hide";
    enemy.aiTimer = 1.2 + Math.random() * 1.6;
    enemy.aiTarget = pickCoverTarget(enemy, playerPos) ?? pickFlankTarget(enemy, playerPos) ?? pickRoamTarget(enemy);
    return;
  }

  if (enemy.lastSeenPlayer) {
    enemy.aiMode = Math.random() < 0.55 ? "flank" : "hide";
    enemy.aiTimer = 1.0 + Math.random() * 1.2;
    enemy.aiTarget =
      (enemy.aiMode === "hide" ? pickCoverTarget(enemy, enemy.lastSeenPlayer) : pickFlankTarget(enemy, enemy.lastSeenPlayer)) ??
      pickRoamTarget(enemy);
    return;
  }

  enemy.aiMode = "roam";
  enemy.aiTimer = 1.1 + Math.random() * 1.8;
  enemy.aiTarget = pickRoamTarget(enemy);
}

function updateEnemies(dt: number): void {
  const playerPos = camera.position.clone();

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    const toPlayer = playerPos.subtract(enemy.mesh.position);
    toPlayer.y = 0;
    const dist = Math.max(0.0001, toPlayer.length());
    const dirToPlayer = toPlayer.scale(1 / dist);
    const canSee = lineOfSight(enemy.mesh.position.add(new Vector3(0, 0.8, 0)), playerPos.add(new Vector3(0, -0.2, 0)));

    enemy.aiTimer -= dt;
    if (enemy.aiTimer <= 0 || (enemy.aiTarget && Vector3.Distance(enemy.mesh.position, enemy.aiTarget) < 0.65)) {
      retargetEnemyAi(enemy, playerPos, canSee, dist);
    }

    let desiredTarget: Vector3 | null = null;
    const desiredMinDist = enemy.type === "boss" ? 2.3 : enemy.type === "kitten" ? 0.8 : 2.0;
    const desiredMaxDist = enemy.type === "boss" ? 8.5 : enemy.type === "kitten" ? 1.6 : 10.0;

    if (enemy.aiMode === "push") {
      if (dist > desiredMinDist) desiredTarget = playerPos;
    } else if (enemy.aiMode === "retreat") {
      if (dist < desiredMaxDist) desiredTarget = enemy.mesh.position.add(dirToPlayer.scale(-4.8));
    } else if (enemy.aiMode === "strafe") {
      const side = new Vector3(dirToPlayer.z, 0, -dirToPlayer.x).scale(enemy.strafeDir);
      let keep = new Vector3(0, 0, 0);
      if (dist > desiredMaxDist) keep = dirToPlayer.scale(0.45);
      else if (dist < desiredMinDist) keep = dirToPlayer.scale(-0.45);
      desiredTarget = enemy.mesh.position.add(side.scale(3.2)).add(keep.scale(2.0));
    } else {
      const target = enemy.aiTarget;
      if (target) {
        desiredTarget = target;
      }
    }

    let moveDir = new Vector3(0, 0, 0);
    if (desiredTarget) {
      moveDir = computeNavigatedMoveDir(enemy, desiredTarget);
    }

    const moveScale =
      enemy.aiMode === "retreat" ? 1.15 :
      enemy.aiMode === "flank" ? 1.08 :
      enemy.aiMode === "hide" ? 0.9 :
      enemy.aiMode === "roam" ? 0.75 : 1.0;
    const moved = tryMoveEnemy(enemy, moveDir, enemy.speed * moveScale * dt);
    setEnemyRunAnimationState(enemy, moved);

    if (!moved && enemy.aiMode !== "push" && enemy.type !== "kitten") enemy.aiTimer = 0;

    enemy.meleeCooldown -= dt;
    const meleeRange = enemy.type === "boss" ? 1.6 : enemy.type === "kitten" ? 1.0 : 1.2;
    if (dist <= meleeRange && enemy.meleeCooldown <= 0) {
      damagePlayer(enemy.meleeDamage);
      enemy.meleeCooldown = enemy.type === "kitten" ? 0.45 : 0.85;
    }

    enemy.shootCooldown -= dt;
    if (enemy.bulletSpeed > 0 && dist < 22 && enemy.shootCooldown <= 0) {
      if (canSee) {
        rotateEnemyToward(enemy, dirToPlayer, dt, 18);
        spawnEnemyShot(enemy);
        const sneakBonus = enemy.aiMode === "hide" ? 0.82 : enemy.aiMode === "flank" ? 0.9 : 1;
        enemy.shootCooldown = enemy.shootDelay * sneakBonus * (0.92 + Math.random() * 0.18);
      }
    }

    if (canSee && enemy.aiMode !== "hide" && enemy.aiMode !== "roam") {
      rotateEnemyToward(enemy, dirToPlayer, dt, 4.8);
    } else if (moveDir.lengthSquared() > 0.0008) {
      rotateEnemyToward(enemy, moveDir, dt, 5.8);
    }

    if (enemy.type === "boss") {
      enemy.spawnCooldown -= dt;
      if (enemy.spawnCooldown <= 0) {
        spawnKittenNearBoss(enemy);
        enemy.spawnCooldown = 3.8;
      }
    }
  }
}

function updateEnemyShots(dt: number): void {
  for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
    const shot = enemyShots[i];
    shot.mesh.position.addInPlace(shot.velocity.scale(dt));
    shot.life -= dt;

    const map = worldToMap(shot.mesh.position);
    const out = shot.life <= 0 || isWallAt(map.x, map.y);
    if (out) {
      shot.mesh.dispose();
      enemyShots.splice(i, 1);
      continue;
    }

    const dist = Vector3.Distance(shot.mesh.position, camera.position);
    if (dist <= 0.6) {
      damagePlayer(shot.damage);
      shot.mesh.dispose();
      enemyShots.splice(i, 1);
    }
  }
}

function updateGrenades(dt: number): void {
  for (let i = grenadeProjectiles.length - 1; i >= 0; i -= 1) {
    const grenade = grenadeProjectiles[i];
    const prev = grenade.mesh.position.clone();
    grenade.velocity.y -= GRAVITY * 0.72 * dt;
    grenade.mesh.position.addInPlace(grenade.velocity.scale(dt));
    grenade.mesh.rotation.x += dt * 7;
    grenade.mesh.rotation.z += dt * 5;
    grenade.life -= dt;

    let bounced = false;

    const mapX = worldToMap(new Vector3(grenade.mesh.position.x, prev.y, prev.z));
    if (isWallAt(mapX.x, mapX.y)) {
      grenade.mesh.position.x = prev.x;
      grenade.velocity.x = -grenade.velocity.x * 0.72;
      bounced = true;
    }

    const mapZ = worldToMap(new Vector3(prev.x, prev.y, grenade.mesh.position.z));
    if (isWallAt(mapZ.x, mapZ.y)) {
      grenade.mesh.position.z = prev.z;
      grenade.velocity.z = -grenade.velocity.z * 0.72;
      bounced = true;
    }

    const m = worldToMap(grenade.mesh.position);
    const floor = floorHeightAtMap(m.x, m.y);
    if (grenade.mesh.position.y <= floor + 0.12) {
      grenade.mesh.position.y = floor + 0.12;
      grenade.velocity.y = Math.abs(grenade.velocity.y) * 0.56;
      grenade.velocity.x *= 0.82;
      grenade.velocity.z *= 0.82;
      bounced = true;
    }

    if (bounced) {
      grenade.velocity.y *= 0.92;
      grenade.bouncesRemaining -= 1;
      const impactSpeed = Math.sqrt(
        grenade.velocity.x * grenade.velocity.x +
        grenade.velocity.y * grenade.velocity.y +
        grenade.velocity.z * grenade.velocity.z,
      );
      if (impactSpeed > 1.35) playGrenadeBounceSound();
    }

    const tooSlowAfterBounce =
      grenade.bouncesRemaining <= 0 ||
      (Math.abs(grenade.velocity.y) < 0.8 && Math.hypot(grenade.velocity.x, grenade.velocity.z) < 1.2);

    if (grenade.life <= 0 || tooSlowAfterBounce) {
      const at = grenade.mesh.position.clone();
      const kind = grenade.kind;
      grenade.mesh.dispose();
      grenadeProjectiles.splice(i, 1);
      if (kind === "explosive") explodeGrenade(at);
      else explodeSmokeGrenade(at);
    }
  }

  for (let i = grenadeBursts.length - 1; i >= 0; i -= 1) {
    const burst = grenadeBursts[i];
    burst.life -= dt;
    const t = Math.max(0, burst.life / burst.flashLife);
    const s = 1 + (1 - t) * 5.2;
    burst.mesh.scaling.setAll(s);
    burst.light.intensity = 4.2 * t;
    const mat = burst.mesh.material as StandardMaterial;
    if (mat) mat.alpha = 0.48 * t;

    if (!burst.stopped && burst.life <= 0) {
      for (const sys of burst.systems) sys.stop();
      burst.stopped = true;
    }

    if (burst.life <= burst.cleanupAt) {
      for (const sys of burst.systems) sys.dispose();
      burst.light.dispose();
      burst.mesh.dispose();
      grenadeBursts.splice(i, 1);
    }
  }
}

function updateSmokeClouds(dt: number): void {
  for (let i = smokeClouds.length - 1; i >= 0; i -= 1) {
    const cloud = smokeClouds[i];
    cloud.life -= dt;
    if (!cloud.stopped) {
      const t = Math.max(0, Math.min(1, cloud.life / 3.2));
      for (const sys of cloud.systems) {
        sys.emitRate *= 0.985 + t * 0.01;
      }
      if (cloud.life <= 0) {
        for (const sys of cloud.systems) sys.stop();
        cloud.stopped = true;
      }
    }

    if (cloud.life <= cloud.cleanupAt) {
      for (const sys of cloud.systems) sys.dispose();
      smokeClouds.splice(i, 1);
    }
  }
}

function updatePickups(_dt: number): void {
  const t = performance.now() * 0.001;
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const p = pickups[i];
    animatePickupVisual(p.visual, t);

    const dx = p.visual.mesh.position.x - camera.position.x;
    const dz = p.visual.mesh.position.z - camera.position.z;
    const dist2D = Math.hypot(dx, dz);
    if (dist2D > 0.95) continue;

    if (p.kind === "health") {
      if (health >= maxHealth) continue;
      health = Math.min(maxHealth, health + p.amount);
    } else if (p.kind === "mana") {
      mana = Math.min(MAX_MANA, mana + p.amount);
    } else if (p.kind === "grenade") {
      grenades = Math.min(3, grenades + p.amount);
    } else {
      hasFlamethrower = true;
      flameFuel = Math.min(FLAMETHROWER_MAX_FUEL, flameFuel + p.amount);
      if (weaponMode !== "flamethrower") weaponMode = "flamethrower";
    }

    playPickupSound();
    disposePickupVisual(p.visual);
    pickups.splice(i, 1);
    updateHud();
  }
}

function updatePlayer(dt: number): void {
  const turnDir = (input.ArrowRight ? 1 : 0) - (input.ArrowLeft ? 1 : 0);
  if (turnDir !== 0) yaw += turnDir * dt * 2.2;

  const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

  const moveAxisZ = (input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0);
  const moveAxisX = (input.KeyD ? 1 : 0) - (input.KeyA ? 1 : 0);

  const wanted = fwd.scale(moveAxisZ).add(right.scale(moveAxisX));
  if (wanted.lengthSquared() > 0.001) {
    wanted.normalize();
    const sprintHeld = input.ShiftLeft || input.ShiftRight;
    const canSprint = sprintHeld && !sprintExhausted && stamina > 0;
    const sprinting = canSprint;
    let speedPerSec = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (speedBoost) speedPerSec *= SPEED_BOOST_MULT;
    const speed = speedPerSec * dt;

    if (sprinting) {
      stamina = Math.max(0, stamina - STAMINA_DRAIN_PER_SEC * dt);
      if (stamina <= 0.001) {
        stamina = 0;
        sprintExhausted = true;
      }
    } else {
      stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVER_PER_SEC * dt);
      if (sprintExhausted && stamina >= STAMINA_RECOVER_UNLOCK) sprintExhausted = false;
    }

    const currentFloor = floorHeightAtWorld(camera.position);

    const tryX = camera.position.add(new Vector3(wanted.x * speed, 0, 0));
    const mapX = worldToMap(tryX);
    if (canOccupyMap(mapX.x, mapX.y)) {
      const floorX = floorHeightAtMap(mapX.x, mapX.y);
      if (floorX - currentFloor <= 0.65 || !isGrounded) camera.position.x = tryX.x;
    }

    const tryZ = camera.position.add(new Vector3(0, 0, wanted.z * speed));
    const mapZ = worldToMap(tryZ);
    if (canOccupyMap(mapZ.x, mapZ.y)) {
      const floorZ = floorHeightAtMap(mapZ.x, mapZ.y);
      if (floorZ - currentFloor <= 0.65 || !isGrounded) camera.position.z = tryZ.z;
    }

    gunBobTime += dt * 8;
  } else {
    stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVER_PER_SEC * dt);
    if (sprintExhausted && stamina >= STAMINA_RECOVER_UNLOCK) sprintExhausted = false;
  }

  if (jumpQueued && isGrounded && !gameOver && !victory) {
    verticalVelocity = JUMP_VELOCITY;
    isGrounded = false;
  }
  jumpQueued = false;

  verticalVelocity -= GRAVITY * dt;
  camera.position.y += verticalVelocity * dt;

  const floor = floorHeightAtWorld(camera.position) + EYE_HEIGHT;
  if (camera.position.y <= floor) {
    camera.position.y = floor;
    const onTrampoline = isOnTrampolinePad(camera.position);
    if (onTrampoline && !trampolineLock && !gameOver && !victory) {
      verticalVelocity = JUMP_VELOCITY * 1.45;
      isGrounded = false;
      trampolineLock = true;
    } else {
      verticalVelocity = 0;
      isGrounded = true;
      if (!onTrampoline) trampolineLock = false;
    }
  } else {
    isGrounded = false;
    trampolineLock = false;
  }

  if (isGrounded && floorHeightAtWorld(camera.position) >= 0) {
    const map = worldToMap(camera.position);
    safeSpawn = { x: map.x, y: map.y };
  }

  if (camera.position.y < PIT_DEPTH + EYE_HEIGHT - 0.2) {
    damagePlayer(14);
    resetPlayerAtSpawn(safeSpawn.x, safeSpawn.y);
  }

  camera.rotation = new Vector3(pitch, yaw, 0);

  if (fireCooldown > 0) fireCooldown -= dt;
  if (grenadeCooldown > 0) grenadeCooldown -= dt;
  if (!SERVER_AUTHORITATIVE_ONLY && !multiplayerSync && !gameOver && !victory) {
    mana = Math.min(MAX_MANA, mana + MANA_RECOVER_PER_SEC * dt);
  }
  const flameActive = weaponMode === "flamethrower" && input.MouseLeft && !cheatOpen && flameFuel > 0;
  updateFlameStreamVisual(flameActive);
  if (input.MouseLeft && !cheatOpen && fireCooldown <= 0) fireWeapon();

  recoil = Math.max(0, recoil - dt * 0.75);
  if (gunRoot) {
    const bob = wanted.lengthSquared() > 0.001 ? Math.sin(gunBobTime) * 0.015 : 0;
    gunRoot.position.y = -0.97 + bob - recoil * 0.65;
    if (gunSlide) gunSlide.position.z = 0.7 - recoil * 0.45;
  }
}

function updatePortal(dt: number): void {
  if (!portalMesh) return;
  if (portalActive) {
    portalMesh.rotation.y += dt * 1.6;
    portalMesh.rotation.x = Math.sin(performance.now() * 0.0015) * 0.12;

    const dist = Vector3.Distance(portalMesh.position, camera.position);
    if (dist < 1.4) {
      if (SERVER_AUTHORITATIVE_ONLY || multiplayerSync) {
        if (!multiplayerSync) return;
        multiplayerSync.requestPortalEnter();
        return;
      }
      if (currentLevel < LEVELS.length - 1) startLevel(currentLevel + 1, false);
      else {
        victory = true;
        portalActive = false;
        portalMesh.isVisible = false;
        setCheatStatus("You won. Cat hell is clear.");
      }
    }
  }
}

function toggleWeapon(): void {
  const modes: WeaponMode[] = ["gun"];
  if (hasCannon) modes.push("cannon");
  if (hasMinigun) modes.push("minigun");
  if (hasFlamethrower && flameFuel > 0) modes.push("flamethrower");
  const index = modes.indexOf(weaponMode);
  weaponMode = modes[(index + 1) % modes.length];
  if (weaponMode !== "flamethrower") stopFlameStream();
  updateHud();
}

function clearEnemiesCheat(): void {
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    enemy.health = 0;
    enemy.runAnimation?.stop();
    enemy.runAnimation?.dispose();
    enemy.runAnimation = null;
    enemy.mesh.dispose();
  }
  setPortalActive(true);
}

function runCheat(raw: string): void {
  const cheat = raw.trim().toLowerCase();
  if (!cheat) {
    setCheatStatus("Enter a cheat code");
    return;
  }

  if (cheat === "help" || cheat === "/help") {
    setCheatStatus("meow | burn | furball | catnip | zoomies | hiss | nap# | resetcheats");
    addCheatHistory("/help", "listed cheats");
    return;
  }

  if (cheat === "meow") {
    hasMinigun = true;
    weaponMode = "minigun";
    mana = Math.min(MAX_MANA, mana + 100);
    setCheatStatus("Minigun unlocked");
    addCheatHistory("meow", "minigun");
    updateHud();
    return;
  }

  if (cheat === "burn") {
    hasFlamethrower = true;
    flameFuel = FLAMETHROWER_MAX_FUEL;
    weaponMode = "flamethrower";
    setCheatStatus("Flamethrower unlocked");
    addCheatHistory("burn", "flamethrower");
    updateHud();
    return;
  }

  if (cheat === "furball") {
    godMode = !godMode;
    setCheatStatus(`Infinite health ${godMode ? "ON" : "OFF"}`);
    addCheatHistory("furball", godMode ? "on" : "off");
    updateHud();
    return;
  }

  if (cheat === "catnip") {
    health = maxHealth;
    mana = MAX_MANA;
    grenades = 3;
    smokeGrenades = 2;
    stamina = MAX_STAMINA;
    sprintExhausted = false;
    setCheatStatus("Health and mana maxed");
    addCheatHistory("catnip", "restored");
    updateHud();
    return;
  }

  if (cheat === "zoomies") {
    speedBoost = !speedBoost;
    setCheatStatus(`Speed boost ${speedBoost ? "ON" : "OFF"}`);
    addCheatHistory("zoomies", speedBoost ? "on" : "off");
    updateHud();
    return;
  }

  if (cheat === "hiss") {
    clearEnemiesCheat();
    setCheatStatus("Level cleared");
    addCheatHistory("hiss", "cleared");
    updateHud();
    return;
  }

  if (cheat === "resetcheats") {
    speedBoost = false;
    godMode = false;
    hasMinigun = false;
    if (weaponMode === "minigun") weaponMode = hasCannon ? "cannon" : "gun";
    setCheatStatus("Cheats reset");
    addCheatHistory("resetcheats", "off");
    updateHud();
    return;
  }

  const napLevel = parseNapCheat(cheat, LEVELS.length);
  if (napLevel !== null) {
    startLevel(napLevel, false);
    setCheatStatus(`Jumped to level ${napLevel + 1}`);
    addCheatHistory(cheat, `level ${napLevel + 1}`);
    return;
  }

  setCheatStatus("Unknown cheat");
  addCheatHistory(cheat, "unknown");
}

function toggleCheatConsole(): void {
  cheatOpen = !cheatOpen;
  cheatConsoleEl.classList.toggle("hidden", !cheatOpen);
  if (cheatOpen) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    pointerLocked = false;
    setGrenadeChargeHud(false, 0);
    Object.keys(input).forEach((k) => {
      input[k as keyof InputState] = false;
    });
    cheatInputEl.value = "";
    cheatInputEl.focus();
    setCheatStatus("Type a cheat and press Enter");
  } else {
    cheatInputEl.blur();
  }
}

function handleInputBindings(): void {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      toggleCheatConsole();
      return;
    }

    const fnCheatMap: Record<string, string> = {
      F1: "meow",
      F2: "catnip",
      F3: "zoomies",
      F4: "furball",
      F5: "hiss",
      F6: "resetcheats",
      F12: "burn",
    };
    const cheatFromFn = fnCheatMap[e.code];
    if (cheatFromFn) {
      e.preventDefault();
      runCheat(cheatFromFn);
      return;
    }

    if (cheatOpen) return;

    if (e.code in input) {
      input[e.code as keyof InputState] = true;
      if (e.code === "Space") jumpQueued = true;
      return;
    }

    if (e.code === "KeyE") {
      toggleWeapon();
      return;
    }

    if (e.code === "KeyM") {
      toggleMusic();
      return;
    }

    if (e.code === "KeyN") {
      minimapSizeIndex = (minimapSizeIndex + 1) % MINIMAP_SIZES.length;
      applyMinimapSize();
      return;
    }

    if (e.code === "KeyR") {
      resetRun();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code in input) input[e.code as keyof InputState] = false;
  });

  window.addEventListener("mousedown", (e) => {
    if (cheatOpen) return;
    initAudio();
    tryAcquirePointerLock();

    if (e.button === 0) {
      input.MouseLeft = true;
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      input.MouseRight = true;
      grenadeChargeStart = performance.now();
    }

    if (e.button === 1) {
      e.preventDefault();
      throwSmokeGrenade();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.MouseLeft = false;
    if (e.button === 2 && input.MouseRight) {
      e.preventDefault();
      input.MouseRight = false;
      const heldSeconds = Math.max(0, (performance.now() - grenadeChargeStart) / 1000);
      setGrenadeChargeHud(false, 0);
      throwGrenade(heldSeconds);
    }
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (cheatOpen) return;
    const dragTurning = (e.buttons & 1) === 1;
    if (!pointerLocked && !dragTurning) return;
    yaw += e.movementX * 0.0026;
    pitch += e.movementY * 0.0022;
    pitch = Math.max(-1.28, Math.min(1.28, pitch));
  });

  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener("pointerlockerror", () => {
    pointerLocked = false;
    setCheatStatus("Pointer lock blocked. Hold left mouse and drag to turn.");
  });

  canvas.addEventListener("click", () => {
    initAudio();
    tryAcquirePointerLock();
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
}

function syncMultiplayerPose(now: number): void {
  if (!multiplayerSync) return;

  try {
    multiplayerSync.tick({
      x: camera.position.x,
      y: camera.position.y - EYE_HEIGHT + 1,
      z: camera.position.z,
      rotY: yaw,
      hp: Math.max(0, Math.floor(health)),
      mana: Math.max(0, Math.floor(mana)),
    });
  } catch (error) {
    console.error("Multiplayer pose sync failed", error);
  }
}

function syncMultiplayerVitals(): void {
  if (!multiplayerSync) return;
  const vitals = multiplayerSync.getSelfVitals();
  const transform = multiplayerSync.getSelfTransform();
  health = Math.max(0, Math.min(maxHealth, vitals.hp));
  mana = Math.max(0, Math.min(MAX_MANA, Math.floor(vitals.mana)));
  multiplayerRespawnSeconds = Math.max(0, Math.ceil(vitals.respawnIn));
  if (multiplayerRespawnSeconds > 0) {
    gameOver = true;
    multiplayerWasDowned = true;
    setCheatStatus(`You are down. Respawning in ${multiplayerRespawnSeconds}s...`);
  } else if (gameOver) {
    if (multiplayerWasDowned) {
      camera.position.x = transform.x;
      camera.position.y = transform.y + EYE_HEIGHT - 1;
      camera.position.z = transform.z;
      yaw = transform.rotY;
      pitch = 0;
      verticalVelocity = 0;
      isGrounded = true;
      trampolineLock = false;
    }
    multiplayerWasDowned = false;
    gameOver = false;
    setCheatStatus("Respawned");
  }
}

function syncMultiplayerWorldState(): void {
  if (!multiplayerSync) return;
  const world = multiplayerSync.getServerWorldState();
  const serverLevel = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(world.level)));
  if (serverLevel !== currentLevel) {
    startLevel(serverLevel, true);
    const transform = multiplayerSync.getSelfTransform();
    camera.position.x = transform.x;
    camera.position.y = transform.y + EYE_HEIGHT - 1;
    camera.position.z = transform.z;
    yaw = transform.rotY;
    pitch = 0;
    verticalVelocity = 0;
    isGrounded = true;
    trampolineLock = false;
    safeSpawn = worldToMap(camera.position);
    setCheatStatus(`Level ${serverLevel + 1}`);
  }
  setPortalActive(world.portalActive);
}

function updateServerDebugPanel(): void {
  if (!multiplayerSync) {
    serverDebugStateEl.textContent = "State: Disabled";
    serverDebugAuthEl.textContent = "Auth: No session";
    serverDebugLobbyEl.textContent = "Lobby: n/a";
    serverDebugRoomEl.textContent = "Room: n/a";
    serverDebugPlayersEl.textContent = "Players: 0";
    serverDebugUrlEl.textContent = "URL: n/a";
    return;
  }

  try {
    const info = multiplayerSync.getDebugInfo();
    serverDebugStateEl.textContent = `State: ${info.state}`;
    serverDebugAuthEl.textContent = `Auth: ${info.auth}`;
    serverDebugLobbyEl.textContent = `Lobby: ${info.lobby}`;
    serverDebugRoomEl.textContent = `Room: ${info.room}`;
    serverDebugPlayersEl.textContent = `Players: ${info.players}`;
    serverDebugUrlEl.textContent = `URL: ${info.url}`;
  } catch (error) {
    serverDebugStateEl.textContent = "State: Debug error";
    console.error("Server debug panel update failed", error);
  }
}

function gameLoop(now: number): void {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (input.MouseRight && !cheatOpen) {
    const heldSeconds = Math.max(0, (performance.now() - grenadeChargeStart) / 1000);
    setGrenadeChargeHud(true, Math.min(1, heldSeconds / 1.25));
  } else {
    setGrenadeChargeHud(false, 0);
  }

  if (!cheatOpen) {
    updatePlayer(dt);
  }

  syncMultiplayerWorldState();

  if (!gameOver && !victory) {
    if (!SERVER_AUTHORITATIVE_ONLY && !multiplayerSync) {
      updateEnemies(dt);
      updateEnemyShots(dt);
      updatePickups(dt);
    }
    updateGrenades(dt);
    updateSmokeClouds(dt);
    updatePortal(dt);

    if (!SERVER_AUTHORITATIVE_ONLY && !multiplayerSync && !portalActive && enemies.filter((e) => e.health > 0).length === 0) {
      setPortalActive(true);
    }
  }

  syncMultiplayerVitals();
  syncMultiplayerPose(now);
  updateHud();
  drawMinimap();
  updateServerDebugPanel();
  scene.render();
}

async function init(): Promise<void> {
  applyMinimapSize();
  makeGunModel();
  handleInputBindings();
  await loadEnemyModelTemplate();
  if (SERVER_AUTHORITATIVE_ONLY) {
    multiplayerSync = new LegacyMultiplayerSync(scene, (status) => {
      setCheatStatus(status);
    });
    void multiplayerSync.connect();
  }
  startLevel(0, true);
  engine.runRenderLoop(() => gameLoop(performance.now()));
  window.addEventListener("resize", () => engine.resize());
}

init().catch((err) => {
  console.error("Game init failed", err);
});
