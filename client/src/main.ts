import {
  AbstractMesh,
  AnimationGroup,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
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
  canvas,
} from "./dom";
import {
  playPickupSound,
} from "./audio";
import {
  cellKindForLevel,
  LEVELS,
  enemyCountForLevel,
  floorHeightForLevel,
  isWallForLevel,
  isTrampolineForLevel,
} from "./game/state";
import { SERVER_AUTHORITATIVE_ONLY } from "./game/featureFlags";
import { animatePickupVisual, createPickupVisual, disposePickupVisual, type PickupVisualKind } from "./game/pickupVisuals";
import { LegacyMultiplayerSync } from "./multiplayer/legacySync";
import { computeDeltaSeconds } from "./app/loop";
import { buildEnemyStats } from "./game/runtime/enemyStats";
import { canOccupyMap as canOccupyMapPure, isSafeGroundAt as isSafeGroundAtPure } from "./game/runtime/mapQuery";
import type { GameContext } from "./game/runtime/gameContext";
import {
  applyHandsRigTransform as applyHandsRigTransformModule,
  getActiveCastHandNode as getActiveCastHandNodeModule,
  getCastMuzzlePosition as getCastMuzzlePositionModule,
  makeHandModels as makeHandModelsModule,
  setupHandsDebugUi as setupHandsDebugUiModule,
  toggleHandsDebugPanel as toggleHandsDebugPanelModule,
} from "./game/scene/hands";
import {
  syncMultiplayerPose as syncMultiplayerPoseModule,
  syncMultiplayerVitals as syncMultiplayerVitalsModule,
  syncMultiplayerWorldState as syncMultiplayerWorldStateModule,
  syncPoisonCloudVisuals as syncPoisonCloudVisualsModule,
  updateServerDebugPanel as updateServerDebugPanelModule,
} from "./game/scene/multiplayerUpdates";
import { setupInputBindings } from "./game/input";
import {
  lineOfSight as lineOfSightModule,
  resolveEnemySpawnPosition as resolveEnemySpawnPositionModule,
  updateEnemies as updateEnemiesModule,
  updateEnemyShots as updateEnemyShotsModule,
} from "./game/scene/enemyAi";
import {
  throwPotionProjectile as throwPotionProjectileModule,
  updateProjectiles as updateProjectilesModule,
  updateEffectClouds as updateEffectCloudsModule,
  fireballImpact as fireballImpactModule,
  freezePotionImpact as freezePotionImpactModule,
  poisonPotionImpact as poisonPotionImpactModule,
  stopInfernoStream as stopInfernoStreamExtracted,
  disposeInfernoStream as disposeInfernoStreamExtracted,
  updateInfernoStreamVisual as updateInfernoStreamVisualModule,
} from "./game/scene/projectiles";
import { updatePlayer as updatePlayerModule } from "./game/scene/playerMovement";
import {
  updateHud as updateHudModule,
  drawMinimap as drawMinimapModule,
  applyMinimapSize as applyMinimapSizeModule,
  setCheatStatus as setCheatStatusModule,
  addCheatHistory as addCheatHistoryModule,
} from "./game/scene/hud";
import {
  damagePlayer as damagePlayerModule,
  damageEnemy as damageEnemyModule,
  killEnemy as killEnemyModule,
  setPortalActive as setPortalActiveModule,
  fireRune as fireRuneModule,
  clearEnemiesCheat as clearEnemiesCheatModule,
} from "./game/scene/combatActions";
import {
  runCheat as runCheatModule,
  toggleCheatConsole as toggleCheatConsoleModule,
} from "./game/scene/cheatsUi";
import { createLevelMaterials, createParticleTextures } from "./game/scene/materials";
import { buildLevelGeometry as buildLevelGeometryFromModule } from "./game/scene/levelBuilder";
import {
  createPoisonCloudVisual as createPoisonCloudVisualModule,
  disposePoisonCloudVisual as disposePoisonCloudVisualModule,
} from "./game/scene/effects";
import {
  loadEnemyModelTemplate as loadEnemyModelTemplateModule,
  instantiateEnemyModel as instantiateEnemyModelModule,
  createProceduralEnemyMesh,
} from "./game/scene/enemyFactory";
import {
  loadFreezePotionTemplate as loadFreezePotionTemplateModule,
  loadPoisonPotionTemplate as loadPoisonPotionTemplateModule,
} from "./game/scene/potionModels";
import {
  EYE_HEIGHT,
  INFERNO_MAX_FUEL,
  MAP_H,
  MAP_W,
  MAX_MANA,
  MAX_STAMINA,
  PICKUP_POINTS,
  PIT_DEPTH,
  PLAYER_RADIUS,
  SPAWN_POINTS,
  TILE_SIZE,
  TRAMPOLINE_RADIUS,
} from "./game/runtime/constants";
import { nextRuneMode } from "./game/runtime/runes";
import {
  mapToWorld as mapToWorldBase,
  worldToMap as worldToMapBase,
} from "./game/runtime/spatial";
import {
  createDefaultInputState,
  POTION_KINDS,
  type CastProjectile,
  type EffectCloud,
  type EnemyEntity,
  type EnemyShot,
  type EnemyType,
  type ImpactBurst,
  type InfernoStream,
  type InputState,
  type Pickup,
  type PickupKind,
  type PoisonCloudVisual,
  type PotionKind,
  type PotionProjectile,
  type RuneMode,
} from "./game/runtime/types";

const input: InputState = createDefaultInputState();

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

const levelMaterials = createLevelMaterials(scene);
const { wallMat, floorMat, pitMat, platformMat, stairMat, trampolineMat, portalMat } = levelMaterials;
const particleTextures = createParticleTextures(scene);



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
let portalMesh: Mesh | null = null;
let handsRoot: TransformNode | null = null;
let leftHandWaveNode: TransformNode | null = null;
let rightHandWaveNode: TransformNode | null = null;
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
const LEFT_HAND_ANCHOR_POS = new Vector3(-0.3, -0.06, 0.08);
const RIGHT_HAND_ANCHOR_POS = new Vector3(0.3, -0.06, 0.08);

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
const potionInventory: Record<PotionKind, number> = { health: 0, mana: 0, poison: 0, speed: 0, freeze: 0 };
let selectedPotionIndex = 0;
let isPlayerPoisoned = false;
let isPlayerSpeedBoosted = false;
let isPlayerFrozen = false;
let speedBoostStartedAt = 0;          // performance.now() timestamp when speed boost began
let freezeStartedAt = 0;
const poisonCloudVisuals = new Map<string, PoisonCloudVisual>();

// ── GameContext accessor — bridges module-level vars to extracted modules ──
const ctx = {
  // Babylon core (const, never reassigned)
  scene, camera, levelMaterials, particleTextures,
  // Const reference types (content mutated, reference stable)
  input, handRigDebug, LEFT_HAND_ANCHOR_POS, RIGHT_HAND_ANCHOR_POS,
  cheatHistory, potionInventory, poisonCloudVisuals,
  // Let variables — get/set accessors
  get levelMeshes() { return levelMeshes; }, set levelMeshes(v) { levelMeshes = v; },
  get wallMeshes() { return wallMeshes; }, set wallMeshes(v) { wallMeshes = v; },
  get enemies() { return enemies; }, set enemies(v) { enemies = v; },
  get enemyShots() { return enemyShots; }, set enemyShots(v) { enemyShots = v; },
  get pickups() { return pickups; }, set pickups(v) { pickups = v; },
  get potionProjectiles() { return potionProjectiles; }, set potionProjectiles(v) { potionProjectiles = v; },
  get castProjectiles() { return castProjectiles; }, set castProjectiles(v) { castProjectiles = v; },
  get impactBursts() { return impactBursts; }, set impactBursts(v) { impactBursts = v; },
  get effectClouds() { return effectClouds; }, set effectClouds(v) { effectClouds = v; },
  get infernoStream() { return infernoStream; }, set infernoStream(v) { infernoStream = v; },
  get portalMesh() { return portalMesh; }, set portalMesh(v) { portalMesh = v; },
  get handsRoot() { return handsRoot; }, set handsRoot(v) { handsRoot = v; },
  get leftHandWaveNode() { return leftHandWaveNode; }, set leftHandWaveNode(v) { leftHandWaveNode = v; },
  get rightHandWaveNode() { return rightHandWaveNode; }, set rightHandWaveNode(v) { rightHandWaveNode = v; },
  get gunBobTime() { return gunBobTime; }, set gunBobTime(v) { gunBobTime = v; },
  get recoil() { return recoil; }, set recoil(v) { recoil = v; },
  get rightHandWaveTime() { return rightHandWaveTime; }, set rightHandWaveTime(v) { rightHandWaveTime = v; },
  get handsDebugOpen() { return handsDebugOpen; }, set handsDebugOpen(v) { handsDebugOpen = v; },
  get currentLevel() { return currentLevel; }, set currentLevel(v) { currentLevel = v; },
  get health() { return health; }, set health(v) { health = v; },
  get maxHealth() { return maxHealth; }, set maxHealth(v) { maxHealth = v; },
  get mana() { return mana; }, set mana(v) { mana = v; },
  get portalActive() { return portalActive; }, set portalActive(v) { portalActive = v; },
  get gameOver() { return gameOver; }, set gameOver(v) { gameOver = v; },
  get victory() { return victory; }, set victory(v) { victory = v; },
  get speedBoost() { return speedBoost; }, set speedBoost(v) { speedBoost = v; },
  get godMode() { return godMode; }, set godMode(v) { godMode = v; },
  get cheatOpen() { return cheatOpen; }, set cheatOpen(v) { cheatOpen = v; },
  get hasLightningBolt() { return hasLightningBolt; }, set hasLightningBolt(v) { hasLightningBolt = v; },
  get hasIceShard() { return hasIceShard; }, set hasIceShard(v) { hasIceShard = v; },
  get hasInferno() { return hasInferno; }, set hasInferno(v) { hasInferno = v; },
  get infernoFuel() { return infernoFuel; }, set infernoFuel(v) { infernoFuel = v; },
  get runeMode() { return runeMode; }, set runeMode(v) { runeMode = v; },
  get jumpQueued() { return jumpQueued; }, set jumpQueued(v) { jumpQueued = v; },
  get isGrounded() { return isGrounded; }, set isGrounded(v) { isGrounded = v; },
  get verticalVelocity() { return verticalVelocity; }, set verticalVelocity(v) { verticalVelocity = v; },
  get trampolineLock() { return trampolineLock; }, set trampolineLock(v) { trampolineLock = v; },
  get yaw() { return yaw; }, set yaw(v) { yaw = v; },
  get pitch() { return pitch; }, set pitch(v) { pitch = v; },
  get fireCooldown() { return fireCooldown; }, set fireCooldown(v) { fireCooldown = v; },
  get potionCooldown() { return potionCooldown; }, set potionCooldown(v) { potionCooldown = v; },
  get pointerLocked() { return pointerLocked; }, set pointerLocked(v) { pointerLocked = v; },
  get safeSpawn() { return safeSpawn; }, set safeSpawn(v) { safeSpawn = v; },
  get lastTime() { return lastTime; }, set lastTime(v) { lastTime = v; },
  get minimapSizeIndex() { return minimapSizeIndex; }, set minimapSizeIndex(v) { minimapSizeIndex = v; },
  get stamina() { return stamina; }, set stamina(v) { stamina = v; },
  get sprintExhausted() { return sprintExhausted; }, set sprintExhausted(v) { sprintExhausted = v; },
  get multiplayerSync() { return multiplayerSync; }, set multiplayerSync(v) { multiplayerSync = v; },
  get multiplayerRespawnSeconds() { return multiplayerRespawnSeconds; }, set multiplayerRespawnSeconds(v) { multiplayerRespawnSeconds = v; },
  get multiplayerWasDowned() { return multiplayerWasDowned; }, set multiplayerWasDowned(v) { multiplayerWasDowned = v; },
  get selectedPotionIndex() { return selectedPotionIndex; }, set selectedPotionIndex(v) { selectedPotionIndex = v; },
  get isPlayerPoisoned() { return isPlayerPoisoned; }, set isPlayerPoisoned(v) { isPlayerPoisoned = v; },
  get isPlayerSpeedBoosted() { return isPlayerSpeedBoosted; }, set isPlayerSpeedBoosted(v) { isPlayerSpeedBoosted = v; },
  get isPlayerFrozen() { return isPlayerFrozen; }, set isPlayerFrozen(v) { isPlayerFrozen = v; },
  get speedBoostStartedAt() { return speedBoostStartedAt; }, set speedBoostStartedAt(v) { speedBoostStartedAt = v; },
  get freezeStartedAt() { return freezeStartedAt; }, set freezeStartedAt(v) { freezeStartedAt = v; },
  // Map-query helpers
  mapToWorld: (mx, my, y?) => mapToWorld(mx, my, y),
  worldToMap: (pos) => worldToMap(pos),
  isWallAt: (mx, my) => isWallAt(mx, my),
  floorHeightAtMap: (mx, my) => floorHeightAtMap(mx, my),
  floorHeightAtWorld: (pos) => floorHeightAtWorld(pos),
  isOnTrampolinePad: (pos) => isOnTrampolinePad(pos),
  canOccupyMap: (mx, my, r) => canOccupyMap(mx, my, r),
  isSafeGroundAt: (mx, my) => isSafeGroundAt(mx, my),
} as GameContext;
// Cross-domain callbacks — assigned here; function declarations are hoisted
ctx.setCheatStatus = (text) => setCheatStatusModule(text);
ctx.setPortalActive = (active) => setPortalActiveModule(ctx, active);
ctx.startLevel = (level, freshRun?) => startLevel(level, freshRun);
ctx.useSelectedPotion = () => useSelectedPotion();
ctx.toggleCheatConsole = () => toggleCheatConsoleModule(ctx);
ctx.toggleHandsDebugPanel = () => toggleHandsDebugPanelModule(ctx);
ctx.runCheat = (cmd) => runCheatModule(ctx, cmd);
ctx.toggleRune = () => toggleRune();
ctx.resetRun = () => resetRun();
ctx.applyMinimapSize = () => applyMinimapSizeModule(ctx);
ctx.updateHud = () => updateHudModule(ctx);
ctx.tryAcquirePointerLock = () => tryAcquirePointerLock();
ctx.damagePlayer = (amount) => damagePlayerModule(ctx, amount);
ctx.damageEnemy = (enemy, amount) => damageEnemyModule(ctx, enemy, amount);
ctx.killEnemy = (enemy) => killEnemyModule(ctx, enemy);
ctx.fireRune = () => fireRuneModule(ctx);
ctx.resetPlayerAtSpawn = () => resetPlayerAtSpawn(safeSpawn.x, safeSpawn.y);
ctx.fireballImpact = (pos) => fireballImpactModule(ctx, pos);
ctx.freezePotionImpact = (pos) => freezePotionImpactModule(ctx, pos);
ctx.poisonPotionImpact = (pos) => poisonPotionImpactModule(ctx, pos);
ctx.createEnemy = (type, mx, my) => createEnemy(type, mx, my);
ctx.lineOfSight = (from, to) => lineOfSightModule(ctx, from, to);
ctx.clearEnemiesCheat = () => clearEnemiesCheatModule(ctx);
ctx.addCheatHistory = (cmd, result) => addCheatHistoryModule(ctx, cmd, result);
ctx.throwPotionProjectile = (kind) => { throwPotionProjectile(kind, 0.5); };
ctx.updateInfernoStreamVisual = (active) => updateInfernoStreamVisualModule(ctx, active);
ctx.applyHandsRigTransform = () => applyHandsRigTransformModule(ctx);
ctx.getActiveCastHandNode = () => getActiveCastHandNodeModule(ctx);
ctx.spawnEnemyShot = (origin, dir, speed, dmg) => { /* handled by enemyAi module directly */ };
ctx.createPoisonCloudVisual = (id, pos) => { /* handled by multiplayerUpdates module directly */ };
ctx.disposePoisonCloudVisual = (id) => { /* handled by multiplayerUpdates module directly */ };

function tryAcquirePointerLock(): void {
  if (cheatOpen) return;
  if (document.pointerLockElement === canvas) return;
  const req = canvas.requestPointerLock();
  if (req && typeof req.catch === "function") {
    req.catch(() => { });
  }
}

function mapToWorld(mx: number, my: number, y = 0): Vector3 {
  return mapToWorldBase(mx, my, MAP_W, MAP_H, TILE_SIZE, y);
}

function worldToMap(pos: Vector3): { x: number; y: number } {
  return worldToMapBase(pos, MAP_W, MAP_H, TILE_SIZE);
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
  return canOccupyMapPure(mx, my, radius, isWallAt);
}

function isSafeGroundAt(mx: number, my: number): boolean {
  return isSafeGroundAtPure(mx, my, PIT_DEPTH, floorHeightAtMap);
}

function setCheatStatus(text: string): void { setCheatStatusModule(text); }
function updateHud(): void { updateHudModule(ctx); }
function applyMinimapSize(): void { applyMinimapSizeModule(ctx); }
function drawMinimap(): void { drawMinimapModule(ctx); }

function getCastMuzzlePosition(): Vector3 | null {
  return getCastMuzzlePositionModule(ctx);
}

function disposeInfernoStream(): void {
  disposeInfernoStreamExtracted(ctx);
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
    disposePoisonCloudVisualModule(visual);
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

function buildLevelGeometry(): void {
  const result = buildLevelGeometryFromModule(
    scene,
    levelMaterials,
    currentLevel,
    LEVELS,
    isWallAt,
    floorHeightAtMap,
    cellKindForLevel,
    mapToWorld,
  );
  levelMeshes = result.levelMeshes;
  wallMeshes = result.wallMeshes;
  portalMesh = result.portalMesh;
  if (portalMesh) portalMesh.isVisible = false;
}

function createEnemy(type: EnemyType, mx: number, my: number): EnemyEntity {
  const pos = mapToWorld(mx, my, floorHeightAtMap(mx, my));
  const stats = buildEnemyStats(type, currentLevel);
  const importedMesh = instantiateEnemyModelModule(type, pos, scene);
  if (importedMesh) {
    return {
      mesh: importedMesh.root,
      type,
      ...stats,
      aiTarget: null,
      lastSeenPlayer: null,
      runAnimation: importedMesh.runAnimation,
      wasMoving: false,
    };
  }

  const mesh = createProceduralEnemyMesh(type, pos, scene);
  return {
    mesh,
    type,
    ...stats,
    aiTarget: null,
    lastSeenPlayer: null,
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

function syncPoisonCloudVisuals(): void {
  syncPoisonCloudVisualsModule(ctx);
}

function throwPotionProjectile(kind: "freeze" | "poison", chargeSeconds = 0): boolean {
  return throwPotionProjectileModule(ctx, kind, chargeSeconds);
}

function resolveEnemySpawnPosition(
  enemy: EnemyEntity,
  mx: number,
  my: number,
  avoidPos?: Vector3,
  minDistanceFromAvoid = 0,
): void {
  resolveEnemySpawnPositionModule(ctx, enemy, mx, my, avoidPos, minDistanceFromAvoid);
}

function updateEnemies(dt: number): void {
  updateEnemiesModule(ctx, dt);
}

function updateEnemyShots(dt: number): void {
  updateEnemyShotsModule(ctx, dt);
}

function updateProjectiles(dt: number): void {
  updateProjectilesModule(ctx, dt);
}

function updateEffectClouds(dt: number): void {
  updateEffectCloudsModule(ctx, dt);
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
  updatePlayerModule(ctx, dt);
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
  runeMode = nextRuneMode(runeMode, {
    hasLightningBolt,
    hasIceShard,
    hasInferno,
    infernoFuel,
  });
  if (runeMode !== "inferno") stopInfernoStreamExtracted(ctx);
  updateHud();
}

function useSelectedPotion(): void {
  if (!multiplayerSync) return;
  const kind = POTION_KINDS[selectedPotionIndex];
  if (potionInventory[kind] <= 0) return;
  if (kind === "poison") {
    const thrown = throwPotionProjectile(kind, 0.5);
    if (!thrown) return;
    potionInventory.poison = Math.max(0, potionInventory.poison - 1);
    updateHud();
    return;
  }

  if (kind === "freeze") {
    // Compute target position for thrown potions
    const THROW_DIST = 8;
    const lookDir = camera.getDirection(new Vector3(0, 0, 1)).normalize();
    const targetX = camera.position.x + lookDir.x * THROW_DIST;
    const targetZ = camera.position.z + lookDir.z * THROW_DIST;
    multiplayerSync.sendUsePotion(kind, targetX, targetZ);
    // Freeze remains server-timed but uses local throw visuals.
    void throwPotionProjectile(kind, 0.5);
  } else {
    multiplayerSync.sendUsePotion(kind);
  }
}

function handleInputBindings(): void {
  setupInputBindings(ctx);
}

function syncMultiplayerPose(now: number): void {
  syncMultiplayerPoseModule(ctx, now);
}

function syncMultiplayerVitals(): void {
  syncMultiplayerVitalsModule(ctx);
}

function syncMultiplayerWorldState(): void {
  syncMultiplayerWorldStateModule(ctx);
}

function updateServerDebugPanel(): void {
  updateServerDebugPanelModule(ctx);
}

function gameLoop(now: number): void {
  const dt = computeDeltaSeconds(now, lastTime);
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
      setPortalActiveModule(ctx, true);
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
  setupHandsDebugUiModule(ctx);
  await makeHandModelsModule(ctx);
  await loadFreezePotionTemplateModule(scene);
  await loadPoisonPotionTemplateModule(scene);
  handleInputBindings();
  await loadEnemyModelTemplateModule(scene);
  if (SERVER_AUTHORITATIVE_ONLY) {
    multiplayerSync = new LegacyMultiplayerSync(
      scene,
      (status) => {
        setCheatStatus(status);
      },
      () => getCastMuzzlePosition(),
    );
    multiplayerSync.onProjectileRemoved = (pos) => fireballImpactModule(ctx, pos);
    void multiplayerSync.connect();
  }
  startLevel(0, true);
  engine.runRenderLoop(() => gameLoop(performance.now()));
  window.addEventListener("resize", () => engine.resize());
}

init().catch((err) => {
  console.error("Game init failed", err);
});
