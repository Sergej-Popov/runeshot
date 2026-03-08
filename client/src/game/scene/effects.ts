import {
  Color3,
  Color4,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  StandardMaterial,
  Vector3,
  type Camera,
  type Scene,
} from "@babylonjs/core";
import type {
  EffectCloud,
  ImpactBurst,
  InfernoStream,
  PoisonCloudVisual,
} from "../runtime/types";
import type { ParticleTextures } from "./materials";

// ──────────────────────────────────────────────
// Inferno stream
// ──────────────────────────────────────────────

export function createInfernoStream(
  scene: Scene,
  camera: Camera,
  textures: ParticleTextures,
): InfernoStream {
  const nozzle = MeshBuilder.CreateBox("flame-nozzle", { size: 0.02 }, scene);
  nozzle.parent = camera;
  nozzle.position = new Vector3(0.27, -0.16, 0.86);
  nozzle.isVisible = false;
  nozzle.isPickable = false;

  const core = new ParticleSystem("inferno-core", 1100, scene);
  core.particleTexture = textures.fireParticleTex;
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
  embers.particleTexture = textures.fireParticleTex;
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
  smoke.particleTexture = textures.smokeParticleTex;
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

  return { nozzle, core, smoke, embers };
}

export function stopInfernoStream(stream: InfernoStream): void {
  stream.core.stop();
  stream.smoke.stop();
  stream.embers.stop();
}

export function disposeInfernoStream(stream: InfernoStream): void {
  stream.core.dispose(false);
  stream.smoke.dispose(false);
  stream.embers.dispose(false);
  stream.nozzle.dispose();
}

export function setInfernoStreamActive(stream: InfernoStream, active: boolean): void {
  stream.nozzle.position.set(0.27, -0.16, 0.86);

  if (!active) {
    stream.core.emitRate = 0;
    stream.embers.emitRate = 0;
    stream.smoke.emitRate = 0;
    stopInfernoStream(stream);
    return;
  }

  stream.core.emitRate = 760;
  stream.embers.emitRate = 430;
  stream.smoke.emitRate = 220;
  stream.core.start();
  stream.embers.start();
  stream.smoke.start();
}

// ──────────────────────────────────────────────
// Fireball impact
// ──────────────────────────────────────────────

const MAX_IMPACT_BURSTS = 4;

/**
 * Create a fireball impact burst at the given position.
 * Returns the new ImpactBurst object. Caller is responsible for
 * managing the `impactBursts` array (including evicting old ones).
 */
export function createFireballImpact(
  at: Vector3,
  scene: Scene,
  textures: ParticleTextures,
): ImpactBurst {
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
  flameBurst.particleTexture = textures.fireParticleTex;
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
  emberBurst.particleTexture = textures.fireParticleTex;
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

  return {
    mesh: burstMesh,
    light: burstLight,
    life: 0.34,
    flashLife: 0.34,
    radius: 3.2,
    systems: [flameBurst, emberBurst],
    cleanupAt: -1.1,
    stopped: false,
  };
}

/**
 * Evict old impact bursts if count exceeds the limit.
 * Returns any evicted bursts (caller should dispose them).
 */
export function evictOldImpactBursts(bursts: ImpactBurst[]): ImpactBurst[] {
  const evicted: ImpactBurst[] = [];
  while (bursts.length >= MAX_IMPACT_BURSTS) {
    evicted.push(bursts.shift()!);
  }
  return evicted;
}

export function disposeImpactBurst(burst: ImpactBurst): void {
  for (const sys of burst.systems) {
    sys.stop();
    sys.dispose(false);
  }
  burst.light.dispose();
  burst.mesh.dispose();
}

// ──────────────────────────────────────────────
// Freeze potion impact
// ──────────────────────────────────────────────

export function createFreezePotionImpact(
  at: Vector3,
  scene: Scene,
  textures: ParticleTextures,
): EffectCloud {
  const burst = new ParticleSystem("freeze-burst", 1200, scene);
  burst.particleTexture = textures.smokeParticleTex;
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

  const mist = new ParticleSystem("freeze-mist", 600, scene);
  mist.particleTexture = textures.smokeParticleTex;
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

  const light = new PointLight("freeze-flash", at.clone(), scene);
  light.diffuse = new Color3(0.5, 0.75, 1.0);
  light.intensity = 5.0;
  light.range = 8;

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

  return {
    systems: [burst, mist],
    life: 2.0,
    cleanupAt: -3.0,
    stopped: false,
  };
}

// ──────────────────────────────────────────────
// Poison potion impact
// ──────────────────────────────────────────────

export function createPoisonPotionImpact(
  at: Vector3,
  scene: Scene,
  textures: ParticleTextures,
): EffectCloud {
  const burst = new ParticleSystem("poison-burst", 900, scene);
  burst.particleTexture = textures.smokeParticleTex;
  burst.emitter = at.clone();
  burst.minEmitBox = new Vector3(-0.2, 0.02, -0.2);
  burst.maxEmitBox = new Vector3(0.2, 0.28, 0.2);
  burst.color1 = new Color4(0.25, 0.85, 0.2, 0.7);
  burst.color2 = new Color4(0.15, 0.65, 0.14, 0.6);
  burst.colorDead = new Color4(0.08, 0.3, 0.08, 0);
  burst.minSize = 0.5;
  burst.maxSize = 1.6;
  burst.minLifeTime = 0.55;
  burst.maxLifeTime = 1.4;
  burst.emitRate = 850;
  burst.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  burst.gravity = new Vector3(0, 0.2, 0);
  burst.direction1 = new Vector3(-1.6, 0.2, -1.6);
  burst.direction2 = new Vector3(1.6, 1.3, 1.6);
  burst.minEmitPower = 0.7;
  burst.maxEmitPower = 2.2;
  burst.updateSpeed = 0.014;
  burst.targetStopDuration = 0.12;
  burst.start();

  const haze = new ParticleSystem("poison-haze", 560, scene);
  haze.particleTexture = textures.smokeParticleTex;
  haze.emitter = at.clone();
  haze.minEmitBox = new Vector3(-1.3, 0.0, -1.3);
  haze.maxEmitBox = new Vector3(1.3, 0.45, 1.3);
  haze.color1 = new Color4(0.22, 0.75, 0.16, 0.35);
  haze.color2 = new Color4(0.12, 0.5, 0.1, 0.3);
  haze.colorDead = new Color4(0.08, 0.28, 0.08, 0);
  haze.minSize = 1.0;
  haze.maxSize = 2.4;
  haze.minLifeTime = 0.9;
  haze.maxLifeTime = 2.0;
  haze.emitRate = 320;
  haze.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  haze.gravity = new Vector3(0, 0.22, 0);
  haze.direction1 = new Vector3(-0.7, 0.08, -0.7);
  haze.direction2 = new Vector3(0.7, 0.55, 0.7);
  haze.minEmitPower = 0.08;
  haze.maxEmitPower = 0.45;
  haze.updateSpeed = 0.015;
  haze.targetStopDuration = 0.18;
  haze.start();

  const light = new PointLight("poison-flash", at.clone(), scene);
  light.diffuse = new Color3(0.3, 0.95, 0.2);
  light.intensity = 3.2;
  light.range = 7;

  const fadeStart = performance.now();
  const fadeDuration = 520;
  const fadeTick = (): void => {
    const elapsed = performance.now() - fadeStart;
    const t = Math.max(0, 1 - elapsed / fadeDuration);
    light.intensity = 3.2 * t;
    if (t > 0) requestAnimationFrame(fadeTick);
    else light.dispose();
  };
  requestAnimationFrame(fadeTick);

  return {
    systems: [burst, haze],
    life: 1.8,
    cleanupAt: -2.6,
    stopped: false,
  };
}

// ──────────────────────────────────────────────
// Poison cloud (persistent area effect)
// ──────────────────────────────────────────────

export function createPoisonCloudVisual(
  at: Vector3,
  scene: Scene,
  textures: ParticleTextures,
): PoisonCloudVisual {
  const core = new ParticleSystem("poison-core", 900, scene);
  core.particleTexture = textures.smokeParticleTex;
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
  wisps.particleTexture = textures.smokeParticleTex;
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

export function disposePoisonCloudVisual(visual: PoisonCloudVisual): void {
  for (const sys of visual.systems) {
    sys.stop();
    sys.dispose(false);
  }
  visual.light.dispose();
}
