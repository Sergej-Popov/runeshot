import type {
  AnimationGroup,
  Mesh,
  ParticleSystem,
  PointLight,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { PickupVisual } from "../pickupVisuals";

export type RuneMode = "fireball" | "lightning-bolt" | "ice-shard" | "inferno";
export type EnemyType = "normal" | "boss" | "kitten";

export type EnemyEntity = {
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

export type EnemyShot = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  damage: number;
};

export type PickupKind = "health" | "mana" | "flame";
export type Pickup = {
  kind: PickupKind;
  amount: number;
  visual: PickupVisual;
};

export type PotionProjectile = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  bouncesRemaining: number;
  kind: "freeze" | "poison";
};

export type CastProjectile = {
  mesh: Mesh;
  light: PointLight;
  velocity: Vector3;
  life: number;
};

export type ImpactBurst = {
  mesh: Mesh;
  light: PointLight;
  life: number;
  flashLife: number;
  radius: number;
  systems: ParticleSystem[];
  cleanupAt: number;
  stopped: boolean;
};

export type EffectCloud = {
  systems: ParticleSystem[];
  life: number;
  cleanupAt: number;
  stopped: boolean;
};

export type PoisonCloudVisual = {
  systems: ParticleSystem[];
  light: PointLight;
};

export type InfernoStream = {
  nozzle: Mesh;
  core: ParticleSystem;
  smoke: ParticleSystem;
  embers: ParticleSystem;
};

export type InputState = {
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

export function createDefaultInputState(): InputState {
  return {
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
}

export const POTION_KINDS = ["health", "mana", "poison", "speed", "freeze"] as const;
export type PotionKind = (typeof POTION_KINDS)[number];
