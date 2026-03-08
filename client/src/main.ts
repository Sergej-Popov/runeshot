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
  healthBarEl,
  healthTextEl,
  handsDebugPanelEl,
  handPosXEl,
  handPosXValEl,
  handPosYEl,
  handPosYValEl,
  handPosZEl,
  handPosZValEl,
  handRotXEl,
  handRotXValEl,
  handRotYEl,
  handRotYValEl,
  handRotZEl,
  handRotZValEl,
  levelEl,
  manaBarEl,
  manaTextEl,
  minimapCtx,
  minimapEl,
  runeEl,
  serverDebugAuthEl,
  serverDebugLobbyEl,
  serverDebugPlayersEl,
  serverDebugRoomEl,
  serverDebugStateEl,
  serverDebugUrlEl,
  staminaBarEl,
  staminaTextEl,
  potionSlotEls,
  potionCountEls,
  speedCooldownEl,
} from "./dom";
import {
  initAudio,
  playCatMeowSound,
  playEnemyDeathSound,
  playFireballSound,
  playImpactSound,
  playInfernoSound,
  playLightningBoltSound,
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

type RuneMode = "fireball" | "lightning-bolt" | "ice-shard" | "inferno";
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

type PickupKind = "health" | "mana" | "flame";
type Pickup = {
  kind: PickupKind;
  amount: number;
  visual: PickupVisual;
};

type PotionProjectile = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  bouncesRemaining: number;
  kind: "freeze";
};

type CastProjectile = {
  mesh: Mesh;
  light: PointLight;
  velocity: Vector3;
  life: number;
};

type ImpactBurst = {
  mesh: Mesh;
  light: PointLight;
  life: number;
  flashLife: number;
  radius: number;
  systems: ParticleSystem[];
  cleanupAt: number;
  stopped: boolean;
};

type EffectCloud = {
  systems: ParticleSystem[];
  life: number;
  cleanupAt: number;
  stopped: boolean;
};

type PoisonCloudVisual = {
  systems: ParticleSystem[];
  light: PointLight;
};

type InfernoStream = {
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
const INFERNO_MAX_FUEL = 220;
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
engine.disableUniformBuffers = true; // Bypass WebGL2 UBO limit (~12) — avoids shader failures when many PointLights exist
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
let potionProjectiles: PotionProjectile[] = [];
let castProjectiles: CastProjectile[] = [];
let impactBursts: ImpactBurst[] = [];
let effectClouds: EffectCloud[] = [];
let infernoStream: InfernoStream | null = null;
let enemyModelContainer: AssetContainer | null = null;
let enemyModelHeight = 1;
let enemyModelId = 0;
let portalMesh: Mesh | null = null;
let handsRoot: TransformNode | null = null;
let rightHandWaveNode: TransformNode | null = null;
let rightHandMuzzle: TransformNode | null = null;
let gunBobTime = 0;
let recoil = 0;
let rightHandWaveTime = 0;
let handsDebugOpen = false;
const handRigDebug = {
  posX: 0,
  posY: -0.58,
  posZ: 1.5,
  rotX: 1.12,
  rotY: 0,
  rotZ: 3.16,
};

let currentLevel = 0;
let health = 100;
let maxHealth = 100;
let mana = 60;
let portalActive = false;
let gameOver = false;
let victory = false;
let speedBoost = false;
let godMode = false;
let cheatOpen = false;
let hasLightningBolt = false;
let hasIceShard = false;
let hasInferno = false;
let infernoFuel = 0;
let runeMode: RuneMode = "fireball";
let jumpQueued = false;
let isGrounded = true;
let verticalVelocity = 0;
let trampolineLock = false;
let yaw = 0;
let pitch = 0;
let fireCooldown = 0;
let potionCooldown = 0;
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

// Potion inventory state
const POTION_KINDS = ["health", "mana", "poison", "speed", "freeze"] as const;
type PotionKind = (typeof POTION_KINDS)[number];
const potionInventory: Record<PotionKind, number> = { health: 0, mana: 0, poison: 0, speed: 0, freeze: 0 };
let selectedPotionIndex = 0;
let isPlayerPoisoned = false;
let isPlayerSpeedBoosted = false;
let isPlayerFrozen = false;
let speedBoostStartedAt = 0;          // performance.now() timestamp when speed boost began
const SPEED_BOOST_DURATION = 60_000;  // 60 seconds in ms (matches server)
const poisonCloudVisuals = new Map<string, PoisonCloudVisual>();

function tryAcquirePointerLock(): void {
  if (cheatOpen) return;
  if (document.pointerLockElement === canvas) return;
  const req = canvas.requestPointerLock();
  if (req && typeof req.catch === "function") {
    req.catch(() => { });
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
  if (hasIceShard) badges.push("MEOW");
  cheatBadgesEl.classList.toggle("hidden", badges.length === 0);
  cheatBadgesEl.innerHTML = badges.map((b) => `<span class=\"cheat-badge\">${b}</span>`).join("");
}

function updateHud(): void {
  const hp = Math.max(0, Math.floor(health));
  healthTextEl.textContent = `Health: ${hp}`;
  healthBarEl.style.width = `${Math.max(0, Math.min(100, (health / maxHealth) * 100))}%`;
  healthBarEl.classList.toggle("poisoned", isPlayerPoisoned);
  const staminaPct = Math.max(0, Math.min(100, (stamina / MAX_STAMINA) * 100));
  staminaTextEl.textContent = `Stamina: ${Math.round(staminaPct)}%`;
  staminaBarEl.style.width = `${staminaPct}%`;
  staminaBarEl.classList.toggle("speed-boosted", isPlayerSpeedBoosted);
  staminaBarEl.classList.toggle("frozen", isPlayerFrozen);
  levelEl.textContent = multiplayerRespawnSeconds > 0
    ? `Respawn: ${multiplayerRespawnSeconds}s`
    : `Level: ${currentLevel + 1}/${LEVELS.length}`;
  manaTextEl.textContent = `Mana: ${Math.floor(mana)}/${MAX_MANA}`;
  manaBarEl.style.width = `${Math.max(0, Math.min(100, (mana / MAX_MANA) * 100))}%`;
  const RUNE_DISPLAY_NAMES: Record<RuneMode, string> = {
    "fireball": "Fireball",
    "lightning-bolt": "Lightning Bolt",
    "ice-shard": "Ice Shard",
    "inferno": `Inferno (${Math.max(0, Math.ceil(infernoFuel))})`,
  };
  runeEl.textContent = `Rune: ${RUNE_DISPLAY_NAMES[runeMode]}`;

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

  // Update potion belt
  for (let i = 0; i < POTION_KINDS.length; i += 1) {
    const kind = POTION_KINDS[i];
    const count = potionInventory[kind];
    potionCountEls[i].textContent = `x${count}`;
    potionSlotEls[i].classList.toggle("selected", i === selectedPotionIndex);
    potionSlotEls[i].classList.toggle("empty", count <= 0);
  }

  // Speed boost radial cooldown indicator
  if (isPlayerSpeedBoosted && speedBoostStartedAt > 0) {
    const elapsed = performance.now() - speedBoostStartedAt;
    const fraction = Math.min(1, elapsed / SPEED_BOOST_DURATION);
    const deg = Math.round(fraction * 360);
    speedCooldownEl.style.background =
      `conic-gradient(transparent ${deg}deg, rgba(0,0,0,0.55) ${deg}deg)`;
    speedCooldownEl.style.display = "block";
  } else {
    speedCooldownEl.style.display = "none";
  }
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

function updateHandsDebugValueLabels(): void {
  handPosXValEl.textContent = handRigDebug.posX.toFixed(2);
  handPosYValEl.textContent = handRigDebug.posY.toFixed(2);
  handPosZValEl.textContent = handRigDebug.posZ.toFixed(2);
  handRotXValEl.textContent = handRigDebug.rotX.toFixed(2);
  handRotYValEl.textContent = handRigDebug.rotY.toFixed(2);
  handRotZValEl.textContent = handRigDebug.rotZ.toFixed(2);
}

function syncHandsDebugControlsFromState(): void {
  handPosXEl.value = handRigDebug.posX.toString();
  handPosYEl.value = handRigDebug.posY.toString();
  handPosZEl.value = handRigDebug.posZ.toString();
  handRotXEl.value = handRigDebug.rotX.toString();
  handRotYEl.value = handRigDebug.rotY.toString();
  handRotZEl.value = handRigDebug.rotZ.toString();
  updateHandsDebugValueLabels();
}

function setupHandsDebugUi(): void {
  const bindRange = (inputEl: HTMLInputElement, assign: (value: number) => void): void => {
    inputEl.addEventListener("input", () => {
      const value = Number.parseFloat(inputEl.value);
      if (!Number.isFinite(value)) return;
      assign(value);
      updateHandsDebugValueLabels();
      applyHandsRigTransform(0, recoil * 0.35);
    });
  };

  bindRange(handPosXEl, (value) => { handRigDebug.posX = value; });
  bindRange(handPosYEl, (value) => { handRigDebug.posY = value; });
  bindRange(handPosZEl, (value) => { handRigDebug.posZ = value; });
  bindRange(handRotXEl, (value) => { handRigDebug.rotX = value; });
  bindRange(handRotYEl, (value) => { handRigDebug.rotY = value; });
  bindRange(handRotZEl, (value) => { handRigDebug.rotZ = value; });

  const swallow = (e: Event): void => e.stopPropagation();
  handsDebugPanelEl.addEventListener("mousedown", swallow);
  handsDebugPanelEl.addEventListener("mouseup", swallow);
  handsDebugPanelEl.addEventListener("click", swallow);
  handsDebugPanelEl.addEventListener("wheel", swallow);

  syncHandsDebugControlsFromState();
}

function toggleHandsDebugPanel(): void {
  handsDebugOpen = !handsDebugOpen;
  handsDebugPanelEl.classList.toggle("hidden", !handsDebugOpen);
}

function applyHandsRigTransform(bobOffset = 0, recoilOffset = 0): void {
  if (!handsRoot) return;
  handsRoot.position.set(
    handRigDebug.posX,
    handRigDebug.posY + bobOffset - recoilOffset,
    handRigDebug.posZ,
  );
  handsRoot.rotation.set(handRigDebug.rotX, handRigDebug.rotY, handRigDebug.rotZ);
}

async function makeHandModels(): Promise<void> {
  if (handsRoot) handsRoot.dispose(false, true);

  handsRoot = new TransformNode("hands-root", scene);
  handsRoot.parent = camera;
  applyHandsRigTransform();

  const leftAnchor = new TransformNode("left-hand-anchor", scene);
  leftAnchor.parent = handsRoot;
  leftAnchor.position = new Vector3(-0.3, -0.06, 0.08);

  rightHandWaveNode = new TransformNode("right-hand-wave", scene);
  rightHandWaveNode.parent = handsRoot;
  rightHandWaveNode.position = new Vector3(0.3, -0.06, 0.08);

  rightHandMuzzle = new TransformNode("right-hand-muzzle", scene);
  rightHandMuzzle.parent = rightHandWaveNode;
  rightHandMuzzle.position = new Vector3(0.02, 0.03, 0.58);

  const handModelUrl = new URL("./models/hand_low_poly.glb", import.meta.url).toString();
  try {
    const loadHand = async (name: string, parent: TransformNode, mirrored: boolean): Promise<void> => {
      const imported = await SceneLoader.ImportMeshAsync("", "", handModelUrl, scene);
      const root = new TransformNode(`${name}-root`, scene);
      root.parent = parent;
      const visibleHandMat = new StandardMaterial(`${name}-mat`, scene);
      visibleHandMat.diffuseColor = new Color3(0.92, 0.74, 0.58);
      visibleHandMat.emissiveColor = new Color3(0.1, 0.06, 0.03);
      visibleHandMat.specularColor = new Color3(0.12, 0.08, 0.05);
      visibleHandMat.backFaceCulling = false;
      visibleHandMat.alpha = 1;

      const allNodes: Node[] = [...imported.transformNodes, ...imported.meshes];
      for (const node of allNodes) {
        if (!node.parent || !allNodes.includes(node.parent)) node.parent = root;
      }

      const meshes = root.getChildMeshes(false);
      if (meshes.length === 0) {
        throw new Error("No meshes found in hand_low_poly.glb");
      }

      for (const mesh of meshes) {
        mesh.isPickable = false;
        mesh.isVisible = true;
        mesh.setEnabled(true);
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.renderingGroupId = 1;
        mesh.material = visibleHandMat;
      }

      root.computeWorldMatrix(true);
      let bounds = root.getHierarchyBoundingVectors(true);
      const height = Math.max(0.0001, bounds.max.y - bounds.min.y);
      const targetHeight = 0.55;
      const baseScale = targetHeight / height;
      root.scaling.setAll(baseScale);
      if (mirrored) root.scaling.x *= -1;

      root.rotation = new Vector3(0.22, mirrored ? Math.PI * 1.12 : Math.PI * 0.88, mirrored ? -0.08 : 0.08);

      root.computeWorldMatrix(true);
      bounds = root.getHierarchyBoundingVectors(true);
      const centerWorld = bounds.min.add(bounds.max).scale(0.5);
      const centerInParent = Vector3.TransformCoordinates(centerWorld, parent.getWorldMatrix().clone().invert());
      root.position = new Vector3(-centerInParent.x, -centerInParent.y, -centerInParent.z).add(new Vector3(0, -0.08, 0.42));
    };

    await loadHand("fp-left-hand", leftAnchor, false);
    await loadHand("fp-right-hand", rightHandWaveNode, true);
  } catch (err) {
    console.warn("Could not load hand model; first-person hands disabled.", err);
  }
}

function spawnCastFireball(speed = 24, life = 0.55): void {
  const origin = rightHandMuzzle
    ? rightHandMuzzle.getAbsolutePosition().clone()
    : camera.position.add(camera.getDirection(new Vector3(0, -0.05, 1)).normalize().scale(0.9));
  const direction = camera.getDirection(new Vector3(0, 0, 1)).normalize();

  const mesh = MeshBuilder.CreateSphere("cast-fireball", { diameter: 0.24, segments: 12 }, scene);
  const mat = new StandardMaterial("cast-fireball-mat", scene);
  mat.emissiveColor = new Color3(1.0, 0.58, 0.14);
  mat.diffuseColor = new Color3(0.22, 0.08, 0.02);
  mesh.material = mat;
  mesh.position.copyFrom(origin);
  mesh.isPickable = false;

  const light = new PointLight("cast-fireball-light", origin.clone(), scene);
  light.diffuse = new Color3(1.0, 0.56, 0.2);
  light.intensity = 2.2;
  light.range = 5.5;

  castProjectiles.push({
    mesh,
    light,
    velocity: direction.scale(speed),
    life,
  });
}

function stopInfernoStream(): void {
  if (!infernoStream) return;
  infernoStream.core.stop();
  infernoStream.smoke.stop();
  infernoStream.embers.stop();
}

function disposeInfernoStream(): void {
  if (!infernoStream) return;
  infernoStream.core.dispose(false);
  infernoStream.smoke.dispose(false);
  infernoStream.embers.dispose(false);
  infernoStream.nozzle.dispose();
  infernoStream = null;
}

function ensureInfernoStream(): InfernoStream {
  if (infernoStream) return infernoStream;
  const nozzle = MeshBuilder.CreateBox("flame-nozzle", { size: 0.02 }, scene);
  nozzle.parent = camera;
  nozzle.position = new Vector3(0.27, -0.16, 0.86);
  nozzle.isVisible = false;
  nozzle.isPickable = false;

  const core = new ParticleSystem("inferno-core", 1100, scene);
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

  const embers = new ParticleSystem("inferno-embers", 850, scene);
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

  const smoke = new ParticleSystem("inferno-smoke", 1000, scene);
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

  infernoStream = { nozzle, core, smoke, embers };
  return infernoStream;
}

function updateInfernoStreamVisual(active: boolean): void {
  const stream = ensureInfernoStream();
  stream.nozzle.position.set(0.27, -0.16, 0.86);

  if (!active) {
    stream.core.emitRate = 0;
    stream.embers.emitRate = 0;
    stream.smoke.emitRate = 0;
    stopInfernoStream();
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
  disposeInfernoStream();
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
  for (const proj of potionProjectiles) proj.mesh.dispose();
  potionProjectiles = [];
  for (const proj of castProjectiles) {
    proj.light.dispose();
    proj.mesh.dispose();
  }
  castProjectiles = [];
  for (const burst of impactBursts) {
    for (const sys of burst.systems) sys.dispose(false);
    burst.light.dispose();
    burst.mesh.dispose();
  }
  impactBursts = [];
  for (const cloud of effectClouds) {
    for (const sys of cloud.systems) sys.dispose(false);
  }
  effectClouds = [];

  for (const [, visual] of poisonCloudVisuals) {
    disposePoisonCloudVisual(visual);
  }
  poisonCloudVisuals.clear();

  for (const pickup of pickups) {
    disposePickupVisual(pickup.visual);
  }
  pickups = [];

  if (portalMesh) {
    portalMesh.dispose();
    portalMesh = null;
  }

  // Safety reset
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
  stamina = MAX_STAMINA;
  sprintExhausted = false;
  hasLightningBolt = false;
  hasIceShard = false;
  runeMode = "fireball";
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
    hasLightningBolt = true;
    runeMode = "lightning-bolt";
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

function applyInfernoDamage(): void {
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

function fireRune(): void {
  if (gameOver || victory) return;

  if (SERVER_AUTHORITATIVE_ONLY || multiplayerSync) {
    if (!multiplayerSync) return;
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.22;
    recoil = 0.1;
    rightHandWaveTime = 0.22;
    playFireballSound();
    spawnCastFireball(27, 0.35);
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

  if (runeMode === "inferno") {
    if (infernoFuel <= 0) {
      runeMode = hasLightningBolt ? "lightning-bolt" : hasIceShard ? "ice-shard" : "fireball";
      updateHud();
      stopInfernoStream();
      return;
    }
    infernoFuel = Math.max(0, infernoFuel - 2.1);
    fireCooldown = 0.04;
    recoil = 0.02;
    playInfernoSound();
    applyInfernoDamage();
    updateInfernoStreamVisual(true);
    if (infernoFuel <= 0.001) {
      infernoFuel = 0;
      runeMode = hasLightningBolt ? "lightning-bolt" : hasIceShard ? "ice-shard" : "fireball";
      updateInfernoStreamVisual(false);
    }
    updateHud();
    return;
  } else if (runeMode === "lightning-bolt") {
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.58;
    damage = 4;
    splash = 2.2;
    recoil = 0.17;
    rightHandWaveTime = 0.22;
    playLightningBoltSound();
  } else if (runeMode === "ice-shard") {
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.055;
    damage = 1;
    recoil = 0.04;
    rightHandWaveTime = 0.18;
    playFireballSound();
  } else {
    if (mana < 2) return;
    mana -= 2;
    fireCooldown = 0.18;
    damage = 1;
    recoil = 0.09;
    rightHandWaveTime = 0.22;
    playFireballSound();
    spawnCastFireball();
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

function fireballImpact(at: Vector3): void {
  // Cap simultaneous impact bursts to avoid exceeding WebGL uniform block limit
  const MAX_IMPACT_BURSTS = 4;
  while (impactBursts.length >= MAX_IMPACT_BURSTS) {
    const oldest = impactBursts.shift()!;
    for (const sys of oldest.systems) { sys.stop(); sys.dispose(false); }
    oldest.light.dispose();
    oldest.mesh.dispose();
  }

  playImpactSound();

  const burstMesh = MeshBuilder.CreateSphere("impact-burst", { diameter: 0.8, segments: 16 }, scene);
  const burstMat = new StandardMaterial("impact-burst-mat", scene);
  burstMat.emissiveColor = new Color3(1.0, 0.66, 0.2);
  burstMat.alpha = 0.45;
  burstMesh.material = burstMat;
  burstMesh.position.copyFrom(at);

  const burstLight = new PointLight("impact-burst-light", at.clone(), scene);
  burstLight.diffuse = new Color3(1.0, 0.55, 0.2);
  burstLight.intensity = 4.2;
  burstLight.range = 10;

  const flameBurst = new ParticleSystem("impact-flame-burst", 420, scene);
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

  const emberBurst = new ParticleSystem("impact-ember-burst", 360, scene);
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

  impactBursts.push({
    mesh: burstMesh,
    light: burstLight,
    life: 0.34,
    flashLife: 0.34,
    radius: 3.2,
    systems: [flameBurst, emberBurst],
    cleanupAt: -1.1,
    stopped: false,
  });
}

function freezePotionImpact(at: Vector3): void {
  // Ice crystal burst — bright blue/white particles that expand rapidly then fade
  const burst = new ParticleSystem("freeze-burst", 1200, scene);
  burst.particleTexture = smokeParticleTex;
  burst.emitter = at.clone();
  burst.minEmitBox = new Vector3(-0.2, 0.05, -0.2);
  burst.maxEmitBox = new Vector3(0.2, 0.3, 0.2);
  burst.color1 = new Color4(0.6, 0.85, 1.0, 0.85);
  burst.color2 = new Color4(0.4, 0.65, 0.95, 0.75);
  burst.colorDead = new Color4(0.3, 0.5, 0.8, 0);
  burst.minSize = 0.6;
  burst.maxSize = 1.8;
  burst.minLifeTime = 0.6;
  burst.maxLifeTime = 1.6;
  burst.emitRate = 800;
  burst.blendMode = ParticleSystem.BLENDMODE_ADD;
  burst.gravity = new Vector3(0, -1.5, 0);
  burst.direction1 = new Vector3(-2.5, 1.5, -2.5);
  burst.direction2 = new Vector3(2.5, 4.0, 2.5);
  burst.minAngularSpeed = -1.0;
  burst.maxAngularSpeed = 1.0;
  burst.minEmitPower = 2.0;
  burst.maxEmitPower = 5.0;
  burst.updateSpeed = 0.012;
  burst.targetStopDuration = 0.15;
  burst.start();

  // Snow/ice mist that lingers briefly
  const mist = new ParticleSystem("freeze-mist", 600, scene);
  mist.particleTexture = smokeParticleTex;
  mist.emitter = at.clone();
  mist.minEmitBox = new Vector3(-1.5, 0.0, -1.5);
  mist.maxEmitBox = new Vector3(1.5, 0.5, 1.5);
  mist.color1 = new Color4(0.7, 0.9, 1.0, 0.5);
  mist.color2 = new Color4(0.85, 0.95, 1.0, 0.4);
  mist.colorDead = new Color4(0.5, 0.7, 0.9, 0);
  mist.minSize = 1.0;
  mist.maxSize = 2.5;
  mist.minLifeTime = 1.0;
  mist.maxLifeTime = 2.5;
  mist.emitRate = 350;
  mist.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  mist.gravity = new Vector3(0, 0.3, 0);
  mist.direction1 = new Vector3(-1.0, 0.2, -1.0);
  mist.direction2 = new Vector3(1.0, 0.8, 1.0);
  mist.minAngularSpeed = -0.5;
  mist.maxAngularSpeed = 0.5;
  mist.minEmitPower = 0.1;
  mist.maxEmitPower = 0.6;
  mist.updateSpeed = 0.015;
  mist.targetStopDuration = 0.3;
  mist.start();

  // Bright flash light
  const light = new PointLight("freeze-flash", at.clone(), scene);
  light.diffuse = new Color3(0.5, 0.75, 1.0);
  light.intensity = 5.0;
  light.range = 8;

  // Track in effectClouds for automatic cleanup (reuse existing pattern)
  effectClouds.push({
    systems: [burst, mist],
    life: 2.0,
    cleanupAt: -3.0,
    stopped: false,
  });

  // Fade out the flash light
  const fadeStart = performance.now();
  const fadeDuration = 600;
  const fadeTick = (): void => {
    const elapsed = performance.now() - fadeStart;
    const t = Math.max(0, 1 - elapsed / fadeDuration);
    light.intensity = 5.0 * t;
    if (t > 0) requestAnimationFrame(fadeTick);
    else light.dispose();
  };
  requestAnimationFrame(fadeTick);
}

function createPoisonCloudVisual(at: Vector3): PoisonCloudVisual {
  const core = new ParticleSystem("poison-core", 900, scene);
  core.particleTexture = smokeParticleTex;
  core.emitter = at.clone();
  core.minEmitBox = new Vector3(-1.2, 0.05, -1.2);
  core.maxEmitBox = new Vector3(1.2, 0.6, 1.2);
  core.color1 = new Color4(0.12, 0.55, 0.1, 0.6);
  core.color2 = new Color4(0.2, 0.7, 0.15, 0.5);
  core.colorDead = new Color4(0.08, 0.35, 0.05, 0);
  core.minSize = 1.2;
  core.maxSize = 2.8;
  core.minLifeTime = 2.0;
  core.maxLifeTime = 4.5;
  core.emitRate = 80;
  core.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  core.gravity = new Vector3(0, 0.15, 0);
  core.direction1 = new Vector3(-0.4, 0.2, -0.4);
  core.direction2 = new Vector3(0.4, 0.7, 0.4);
  core.minAngularSpeed = -0.4;
  core.maxAngularSpeed = 0.4;
  core.minEmitPower = 0.04;
  core.maxEmitPower = 0.3;
  core.updateSpeed = 0.015;
  core.start();

  const wisps = new ParticleSystem("poison-wisps", 500, scene);
  wisps.particleTexture = smokeParticleTex;
  wisps.emitter = at.clone();
  wisps.minEmitBox = new Vector3(-2.0, 0.1, -2.0);
  wisps.maxEmitBox = new Vector3(2.0, 0.4, 2.0);
  wisps.color1 = new Color4(0.25, 0.8, 0.15, 0.35);
  wisps.color2 = new Color4(0.15, 0.55, 0.1, 0.25);
  wisps.colorDead = new Color4(0.05, 0.25, 0.03, 0);
  wisps.minSize = 1.8;
  wisps.maxSize = 4.0;
  wisps.minLifeTime = 3.0;
  wisps.maxLifeTime = 6.0;
  wisps.emitRate = 40;
  wisps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  wisps.gravity = new Vector3(0, 0.1, 0);
  wisps.direction1 = new Vector3(-0.6, 0.15, -0.6);
  wisps.direction2 = new Vector3(0.6, 0.5, 0.6);
  wisps.minAngularSpeed = -0.25;
  wisps.maxAngularSpeed = 0.25;
  wisps.minEmitPower = 0.02;
  wisps.maxEmitPower = 0.2;
  wisps.updateSpeed = 0.017;
  wisps.start();

  const light = new PointLight("poison-cloud-light", at.clone(), scene);
  light.diffuse = new Color3(0.2, 0.8, 0.15);
  light.intensity = 1.2;
  light.range = 6;

  return { systems: [core, wisps], light };
}

function disposePoisonCloudVisual(visual: PoisonCloudVisual): void {
  for (const sys of visual.systems) {
    sys.stop();
    sys.dispose(false);
  }
  visual.light.dispose();
}

function syncPoisonCloudVisuals(): void {
  if (!multiplayerSync) return;
  const serverClouds = multiplayerSync.getPoisonCloudPositions();

  // Remove visuals for clouds no longer on the server
  for (const [id, visual] of poisonCloudVisuals) {
    if (!serverClouds.has(id)) {
      disposePoisonCloudVisual(visual);
      poisonCloudVisuals.delete(id);
    }
  }

  // Create visuals for new server clouds
  for (const [id, cloud] of serverClouds) {
    if (!poisonCloudVisuals.has(id)) {
      const pos = new Vector3(cloud.x, cloud.y, cloud.z);
      poisonCloudVisuals.set(id, createPoisonCloudVisual(pos));
    }
  }
}

function throwPotionProjectile(kind: "freeze", chargeSeconds = 0): void {
  if (potionCooldown > 0 || gameOver || victory) return;
  potionCooldown = 0.45;
  updateHud();

  const mesh = MeshBuilder.CreateSphere("potion-proj", { diameter: 0.22, segments: 10 }, scene);
  const mat = new StandardMaterial("potion-proj-mat", scene);
  mat.diffuseColor = new Color3(0.55, 0.8, 0.95);
  mat.emissiveColor = new Color3(0.15, 0.3, 0.5);
  mesh.material = mat;
  mesh.position = camera.position.add(camera.getDirection(new Vector3(0, -0.03, 1)).normalize().scale(0.85));

  const charge01 = Math.max(0, Math.min(1, chargeSeconds / 1.25));
  const throwSpeed = 8.2 + charge01 * 13.8;
  const throwDir = camera.getDirection(new Vector3(0, 0.12, 1)).normalize();
  potionProjectiles.push({
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

function updateProjectiles(dt: number): void {
  for (let i = potionProjectiles.length - 1; i >= 0; i -= 1) {
    const proj = potionProjectiles[i];
    const prev = proj.mesh.position.clone();
    proj.velocity.y -= GRAVITY * 0.72 * dt;
    proj.mesh.position.addInPlace(proj.velocity.scale(dt));
    proj.mesh.rotation.x += dt * 7;
    proj.mesh.rotation.z += dt * 5;
    proj.life -= dt;

    let bounced = false;

    const mapX = worldToMap(new Vector3(proj.mesh.position.x, prev.y, prev.z));
    if (isWallAt(mapX.x, mapX.y)) {
      proj.mesh.position.x = prev.x;
      proj.velocity.x = -proj.velocity.x * 0.72;
      bounced = true;
    }

    const mapZ = worldToMap(new Vector3(prev.x, prev.y, proj.mesh.position.z));
    if (isWallAt(mapZ.x, mapZ.y)) {
      proj.mesh.position.z = prev.z;
      proj.velocity.z = -proj.velocity.z * 0.72;
      bounced = true;
    }

    const m = worldToMap(proj.mesh.position);
    const floor = floorHeightAtMap(m.x, m.y);
    if (proj.mesh.position.y <= floor + 0.12) {
      proj.mesh.position.y = floor + 0.12;
      proj.velocity.y = Math.abs(proj.velocity.y) * 0.56;
      proj.velocity.x *= 0.82;
      proj.velocity.z *= 0.82;
      bounced = true;
    }

    if (bounced) {
      proj.velocity.y *= 0.92;
      proj.bouncesRemaining -= 1;
    }

    const tooSlowAfterBounce =
      proj.bouncesRemaining <= 0 ||
      (Math.abs(proj.velocity.y) < 0.8 && Math.hypot(proj.velocity.x, proj.velocity.z) < 1.2);

    if (proj.life <= 0 || tooSlowAfterBounce) {
      const at = proj.mesh.position.clone();
      proj.mesh.dispose();
      potionProjectiles.splice(i, 1);
      if (proj.kind === "freeze") freezePotionImpact(at);
    }
  }

  for (let i = castProjectiles.length - 1; i >= 0; i -= 1) {
    const proj = castProjectiles[i];
    proj.mesh.position.addInPlace(proj.velocity.scale(dt));
    proj.mesh.rotation.y += dt * 4.5;
    proj.life -= dt;
    proj.light.position.copyFrom(proj.mesh.position);

    const map = worldToMap(proj.mesh.position);
    const floor = floorHeightAtMap(map.x, map.y);
    const hitWall = isWallAt(map.x, map.y);
    const hitFloor = proj.mesh.position.y <= floor + 0.08;
    if (proj.life <= 0 || hitWall || hitFloor) {
      if (!multiplayerSync) fireballImpact(proj.mesh.position.clone());
      proj.light.dispose();
      proj.mesh.dispose();
      castProjectiles.splice(i, 1);
    }
  }

  for (let i = impactBursts.length - 1; i >= 0; i -= 1) {
    const burst = impactBursts[i];
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
      for (const sys of burst.systems) sys.dispose(false);
      burst.light.dispose();
      burst.mesh.dispose();
      impactBursts.splice(i, 1);
    }
  }
}

function updateEffectClouds(dt: number): void {
  for (let i = effectClouds.length - 1; i >= 0; i -= 1) {
    const cloud = effectClouds[i];
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
      for (const sys of cloud.systems) sys.dispose(false);
      effectClouds.splice(i, 1);
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
    } else {
      hasInferno = true;
      infernoFuel = Math.min(INFERNO_MAX_FUEL, infernoFuel + p.amount);
      if (runeMode !== "inferno") runeMode = "inferno";
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
    const canSprint = sprintHeld && !sprintExhausted && stamina > 0 && !isPlayerFrozen;
    const sprinting = canSprint;
    let speedPerSec = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (speedBoost) speedPerSec *= SPEED_BOOST_MULT;
    if (isPlayerFrozen) speedPerSec *= 0.4;
    const speed = speedPerSec * dt;

    if (sprinting) {
      if (!isPlayerSpeedBoosted) {
        stamina = Math.max(0, stamina - STAMINA_DRAIN_PER_SEC * dt);
        if (stamina <= 0.001) {
          stamina = 0;
          sprintExhausted = true;
        }
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
  if (potionCooldown > 0) potionCooldown -= dt;
  if (!SERVER_AUTHORITATIVE_ONLY && !multiplayerSync && !gameOver && !victory) {
    mana = Math.min(MAX_MANA, mana + MANA_RECOVER_PER_SEC * dt);
  }
  const flameActive = runeMode === "inferno" && input.MouseLeft && !cheatOpen && infernoFuel > 0;
  updateInfernoStreamVisual(flameActive);
  if (input.MouseLeft && !cheatOpen && fireCooldown <= 0) fireRune();

  recoil = Math.max(0, recoil - dt * 0.75);
  if (rightHandWaveTime > 0) rightHandWaveTime = Math.max(0, rightHandWaveTime - dt);
  if (handsRoot) {
    const bob = wanted.lengthSquared() > 0.001 ? Math.sin(gunBobTime) * 0.015 : 0;
    applyHandsRigTransform(bob, recoil * 0.35);
  }
  if (rightHandWaveNode) {
    const waveNorm = Math.max(0, Math.min(1, rightHandWaveTime / 0.22));
    const wave = Math.sin((1 - waveNorm) * Math.PI);
    rightHandWaveNode.position.z = 0.05 + wave * 0.22 + recoil * 0.08;
    rightHandWaveNode.rotation.x = -wave * 0.26;
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

function toggleRune(): void {
  const modes: RuneMode[] = ["fireball"];
  if (hasLightningBolt) modes.push("lightning-bolt");
  if (hasIceShard) modes.push("ice-shard");
  if (hasInferno && infernoFuel > 0) modes.push("inferno");
  const index = modes.indexOf(runeMode);
  runeMode = modes[(index + 1) % modes.length];
  if (runeMode !== "inferno") stopInfernoStream();
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
    hasIceShard = true;
    runeMode = "ice-shard";
    mana = Math.min(MAX_MANA, mana + 100);
    setCheatStatus("Ice Shard unlocked");
    addCheatHistory("meow", "ice-shard");
    updateHud();
    return;
  }

  if (cheat === "burn") {
    hasInferno = true;
    infernoFuel = INFERNO_MAX_FUEL;
    runeMode = "inferno";
    setCheatStatus("Inferno unlocked");
    addCheatHistory("burn", "inferno");
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
    hasIceShard = false;
    if (runeMode === "ice-shard") runeMode = hasLightningBolt ? "lightning-bolt" : "fireball";
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

function useSelectedPotion(): void {
  if (!multiplayerSync) return;
  const kind = POTION_KINDS[selectedPotionIndex];
  if (potionInventory[kind] <= 0) return;
  if (kind === "poison" || kind === "freeze") {
    // Compute target position for thrown potions
    const THROW_DIST = 8;
    const lookDir = camera.getDirection(new Vector3(0, 0, 1)).normalize();
    const targetX = camera.position.x + lookDir.x * THROW_DIST;
    const targetZ = camera.position.z + lookDir.z * THROW_DIST;
    multiplayerSync.sendUsePotion(kind, targetX, targetZ);
    // Launch cosmetic projectile for freeze only (poison uses server-synced cloud)
    if (kind === "freeze") throwPotionProjectile(kind, 0.5);
  } else {
    multiplayerSync.sendUsePotion(kind);
  }
}

function handleInputBindings(): void {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      useSelectedPotion();
      return;
    }

    if (e.code === "Backquote") {
      e.preventDefault();
      toggleCheatConsole();
      return;
    }

    if (e.code === "F9") {
      e.preventDefault();
      toggleHandsDebugPanel();
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
      toggleRune();
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
    }

    if (e.button === 1) {
      e.preventDefault();
      useSelectedPotion();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.MouseLeft = false;
    if (e.button === 2) {
      e.preventDefault();
    }
  });

  window.addEventListener("wheel", (e) => {
    if (cheatOpen) return;
    if (e.deltaY > 0) {
      selectedPotionIndex = (selectedPotionIndex + 1) % POTION_KINDS.length;
    } else if (e.deltaY < 0) {
      selectedPotionIndex =
        (selectedPotionIndex - 1 + POTION_KINDS.length) % POTION_KINDS.length;
    }
    updateHud();
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

    if (e.code === "Escape" || e.code === "Backquote") {
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

  // Sync potion inventory
  const potions = multiplayerSync.getPotionInventory();
  potionInventory.health = potions.health;
  potionInventory.mana = potions.mana;
  potionInventory.poison = potions.poison;
  potionInventory.speed = potions.speed;
  potionInventory.freeze = potions.freeze;

  isPlayerPoisoned = multiplayerSync.isSelfPoisoned();
  const wasBoosted = isPlayerSpeedBoosted;
  isPlayerSpeedBoosted = multiplayerSync.isSelfSpeedBoosted();
  if (isPlayerSpeedBoosted && !wasBoosted) {
    speedBoostStartedAt = performance.now();
  } else if (!isPlayerSpeedBoosted) {
    speedBoostStartedAt = 0;
  }
  isPlayerFrozen = multiplayerSync.isSelfFrozen();

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
    updateProjectiles(dt);
    updateEffectClouds(dt);
    syncPoisonCloudVisuals();
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
  setupHandsDebugUi();
  await makeHandModels();
  handleInputBindings();
  await loadEnemyModelTemplate();
  if (SERVER_AUTHORITATIVE_ONLY) {
    multiplayerSync = new LegacyMultiplayerSync(scene, (status) => {
      setCheatStatus(status);
    });
    multiplayerSync.onProjectileRemoved = (pos) => fireballImpact(pos);
    void multiplayerSync.connect();
  }
  startLevel(0, true);
  engine.runRenderLoop(() => gameLoop(performance.now()));
  window.addEventListener("resize", () => engine.resize());
}

init().catch((err) => {
  console.error("Game init failed", err);
});
