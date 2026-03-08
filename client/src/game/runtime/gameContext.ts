/**
 * GameContext — single mutable object holding all game state.
 *
 * Every extracted module receives `ctx: GameContext` and reads/writes
 * fields directly.  Cross-domain callbacks (damagePlayer, updateHud, …)
 * are set as function fields during init() so extracted modules never
 * import main.ts.
 */
import type {
  AbstractMesh,
  Mesh,
  Scene,
  TransformNode,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import type {
  CastProjectile,
  EffectCloud,
  EnemyEntity,
  EnemyShot,
  EnemyType,
  ImpactBurst,
  InfernoStream,
  InputState,
  Pickup,
  PoisonCloudVisual,
  PotionKind,
  PotionProjectile,
  RuneMode,
} from "./types";
import type { LevelMaterials, ParticleTextures } from "../scene/materials";
import type { LegacyMultiplayerSync } from "../../multiplayer/legacySync";

// ---------------------------------------------------------------------------
// GameContext type
// ---------------------------------------------------------------------------
export type GameContext = {
  // ── Babylon core objects ───────────────────────────────────────────────
  scene: Scene;
  camera: UniversalCamera;

  // ── Materials / textures ───────────────────────────────────────────────
  levelMaterials: LevelMaterials;
  particleTextures: ParticleTextures;

  // ── Level geometry ─────────────────────────────────────────────────────
  levelMeshes: AbstractMesh[];
  wallMeshes: AbstractMesh[];
  portalMesh: Mesh | null;

  // ── Entity arrays (mutated in-place) ───────────────────────────────────
  enemies: EnemyEntity[];
  enemyShots: EnemyShot[];
  pickups: Pickup[];
  potionProjectiles: PotionProjectile[];
  castProjectiles: CastProjectile[];
  impactBursts: ImpactBurst[];
  effectClouds: EffectCloud[];
  poisonCloudVisuals: Map<string, PoisonCloudVisual>;
  infernoStream: InfernoStream | null;

  // ── Hands / weapons ────────────────────────────────────────────────────
  handsRoot: TransformNode | null;
  leftHandWaveNode: TransformNode | null;
  rightHandWaveNode: TransformNode | null;
  gunBobTime: number;
  recoil: number;
  rightHandWaveTime: number;
  handsDebugOpen: boolean;
  handRigDebug: {
    posX: number;
    posY: number;
    posZ: number;
    rotX: number;
    rotY: number;
    rotZ: number;
  };
  LEFT_HAND_ANCHOR_POS: Vector3;
  RIGHT_HAND_ANCHOR_POS: Vector3;

  // ── Player state ───────────────────────────────────────────────────────
  input: InputState;
  currentLevel: number;
  health: number;
  maxHealth: number;
  mana: number;
  portalActive: boolean;
  gameOver: boolean;
  victory: boolean;
  speedBoost: boolean;
  godMode: boolean;
  cheatOpen: boolean;
  hasLightningBolt: boolean;
  hasIceShard: boolean;
  hasInferno: boolean;
  infernoFuel: number;
  runeMode: RuneMode;
  jumpQueued: boolean;
  isGrounded: boolean;
  verticalVelocity: number;
  trampolineLock: boolean;
  yaw: number;
  pitch: number;
  fireCooldown: number;
  potionCooldown: number;
  pointerLocked: boolean;
  safeSpawn: { x: number; y: number };
  lastTime: number;
  minimapSizeIndex: number;
  stamina: number;
  sprintExhausted: boolean;

  // ── Cheats ─────────────────────────────────────────────────────────────
  cheatHistory: string[];

  // ── Multiplayer ────────────────────────────────────────────────────────
  multiplayerSync: LegacyMultiplayerSync | null;
  multiplayerRespawnSeconds: number;
  multiplayerWasDowned: boolean;

  // ── Potions / status effects ───────────────────────────────────────────
  potionInventory: Record<PotionKind, number>;
  selectedPotionIndex: number;
  isPlayerPoisoned: boolean;
  isPlayerSpeedBoosted: boolean;
  isPlayerFrozen: boolean;
  speedBoostStartedAt: number;
  freezeStartedAt: number;

  // ── Map-query helpers (set by main.ts during init) ─────────────────────
  mapToWorld: (mx: number, my: number, y?: number) => Vector3;
  worldToMap: (pos: Vector3) => { x: number; y: number };
  isWallAt: (mx: number, my: number) => boolean;
  floorHeightAtMap: (mx: number, my: number) => number;
  floorHeightAtWorld: (pos: Vector3) => number;
  isOnTrampolinePad: (pos: Vector3) => boolean;
  canOccupyMap: (mx: number, my: number, radius?: number) => boolean;
  isSafeGroundAt: (mx: number, my: number) => boolean;

  // ── Cross-domain callbacks (set by main.ts during init) ────────────────
  damagePlayer: (amount: number) => void;
  updateHud: () => void;
  setPortalActive: (active: boolean) => void;
  damageEnemy: (enemy: EnemyEntity, damage: number) => void;
  killEnemy: (enemy: EnemyEntity) => void;
  fireRune: () => void;
  resetPlayerAtSpawn: () => void;
  updateInfernoStreamVisual: (active: boolean) => void;
  applyHandsRigTransform: () => void;
  getActiveCastHandNode: () => TransformNode | null;
  fireballImpact: (position: Vector3) => void;
  freezePotionImpact: (position: Vector3) => void;
  poisonPotionImpact: (position: Vector3) => void;
  createPoisonCloudVisual: (id: string, position: Vector3) => void;
  disposePoisonCloudVisual: (id: string) => void;
  throwPotionProjectile: (kind: "freeze" | "poison") => void;
  spawnEnemyShot: (origin: Vector3, direction: Vector3, speed: number, damage: number) => void;
  createEnemy: (type: EnemyType, mx: number, my: number) => EnemyEntity;
  lineOfSight: (from: Vector3, to: Vector3) => boolean;
  toggleRune: () => void;
  resetRun: () => void;
  startLevel: (level: number, freshRun?: boolean) => void;
  useSelectedPotion: () => void;
  toggleCheatConsole: () => void;
  toggleHandsDebugPanel: () => void;
  runCheat: (cmd: string) => void;
  applyMinimapSize: () => void;
  clearEnemiesCheat: () => void;
  setCheatStatus: (text: string) => void;
  addCheatHistory: (cmd: string, result: string) => void;
  tryAcquirePointerLock: () => void;
};
