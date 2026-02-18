import {
  Color3,
  Color4,
  DynamicTexture,
  Material,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { POTION_SPRITE_TEXTURE_URLS } from "./potionSprites";

export type PickupVisualKind = "health" | "mana" | "grenade" | "flame";
type PickupSpriteKind = "health" | "mana" | "smoke" | "fire";

export type PickupVisual = {
  mesh: Mesh;
  haloA: Mesh;
  haloB: Mesh;
  glow: Mesh;
  light: PointLight;
  systems: ParticleSystem[];
  baseY: number;
  phase: number;
};

type PickupVisualResources = {
  potionMats: Record<PickupSpriteKind, StandardMaterial>;
  auraHealthMat: StandardMaterial;
  auraManaMat: StandardMaterial;
  auraFlameMat: StandardMaterial;
  smokeParticleTex: DynamicTexture;
  fireParticleTex: DynamicTexture;
};

const resourceCache = new WeakMap<Scene, PickupVisualResources>();

function pickupSpriteForKind(kind: PickupVisualKind): PickupSpriteKind {
  if (kind === "health") return "health";
  if (kind === "mana") return "mana";
  if (kind === "grenade") return "smoke";
  return "fire";
}

function createPotionMaterial(scene: Scene, sprite: PickupSpriteKind): StandardMaterial {
  const tex = new Texture(POTION_SPRITE_TEXTURE_URLS[sprite], scene, true, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.hasAlpha = true;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;

  const mat = new StandardMaterial(`pickup-potion-${sprite}`, scene);
  mat.diffuseTexture = tex;
  mat.opacityTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
  mat.alphaCutOff = 0.28;
  mat.emissiveColor = new Color3(0.95, 0.95, 0.95);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  return mat;
}

function createSmokeParticleTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("pickup-smoke-particle-tex", { width: 128, height: 128 }, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.35, "rgba(210,210,210,0.72)");
  grad.addColorStop(0.75, "rgba(120,120,120,0.32)");
  grad.addColorStop(1, "rgba(30,30,30,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 120; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 128, Math.random() * 128, Math.random() * 2.8 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.update(false);
  return tex;
}

function createFireParticleTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("pickup-fire-particle-tex", { width: 128, height: 128 }, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,230,1)");
  grad.addColorStop(0.22, "rgba(255,190,80,0.95)");
  grad.addColorStop(0.55, "rgba(255,95,25,0.7)");
  grad.addColorStop(1, "rgba(40,10,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  tex.update(false);
  return tex;
}

function getResources(scene: Scene): PickupVisualResources {
  const cached = resourceCache.get(scene);
  if (cached) return cached;

  const auraHealthMat = new StandardMaterial("pickup-aura-health", scene);
  auraHealthMat.emissiveColor = new Color3(0.5, 1.0, 0.65);
  auraHealthMat.diffuseColor = new Color3(0.18, 0.35, 0.22);
  auraHealthMat.alpha = 0.24;

  const auraManaMat = new StandardMaterial("pickup-aura-mana", scene);
  auraManaMat.emissiveColor = new Color3(0.45, 0.86, 1.0);
  auraManaMat.diffuseColor = new Color3(0.12, 0.25, 0.35);
  auraManaMat.alpha = 0.24;

  const auraFlameMat = new StandardMaterial("pickup-aura-flame", scene);
  auraFlameMat.emissiveColor = new Color3(1.0, 0.42, 0.14);
  auraFlameMat.diffuseColor = new Color3(0.35, 0.12, 0.07);
  auraFlameMat.alpha = 0.28;

  const resources: PickupVisualResources = {
    potionMats: {
      health: createPotionMaterial(scene, "health"),
      mana: createPotionMaterial(scene, "mana"),
      smoke: createPotionMaterial(scene, "smoke"),
      fire: createPotionMaterial(scene, "fire"),
    },
    auraHealthMat,
    auraManaMat,
    auraFlameMat,
    smokeParticleTex: createSmokeParticleTexture(scene),
    fireParticleTex: createFireParticleTexture(scene),
  };
  resourceCache.set(scene, resources);
  return resources;
}

export function normalizePickupVisualKind(kind: string): PickupVisualKind {
  if (kind === "health" || kind === "mana" || kind === "grenade" || kind === "flame") return kind;
  return "mana";
}

export function createPickupVisual(
  scene: Scene,
  id: string,
  kind: PickupVisualKind,
  at: Vector3,
): PickupVisual {
  const resources = getResources(scene);
  const root = MeshBuilder.CreateBox(`pickup-root-${id}`, { size: 0.12 }, scene);
  root.isVisible = false;
  root.isPickable = false;
  root.position.copyFrom(at);

  const sprite = pickupSpriteForKind(kind);
  const potion = MeshBuilder.CreatePlane(`pickup-potion-${id}`, { width: 0.6, height: 0.73 }, scene);
  potion.parent = root;
  potion.material = resources.potionMats[sprite];
  potion.billboardMode = Mesh.BILLBOARDMODE_ALL;
  potion.position.y = 0.08;

  const auraMat = kind === "health"
    ? resources.auraHealthMat
    : kind === "mana"
      ? resources.auraManaMat
      : resources.auraFlameMat;

  const haloA = MeshBuilder.CreateTorus(`pickup-aura-a-${id}`, { diameter: 1.1, thickness: 0.045, tessellation: 24 }, scene);
  haloA.parent = root;
  haloA.rotation.x = Math.PI / 2;
  haloA.material = auraMat;

  const haloB = MeshBuilder.CreateTorus(`pickup-aura-b-${id}`, { diameter: 0.94, thickness: 0.04, tessellation: 24 }, scene);
  haloB.parent = root;
  haloB.rotation.z = Math.PI / 2;
  haloB.material = auraMat;

  const glow = MeshBuilder.CreateSphere(
    `pickup-glow-${id}`,
    { diameterX: 0.88, diameterY: 0.52, diameterZ: 0.88, segments: 12 },
    scene,
  );
  glow.parent = root;
  glow.material = auraMat;

  const light = new PointLight(`pickup-light-${id}`, root.position.clone(), scene);
  light.parent = root;
  light.diffuse = kind === "health"
    ? new Color3(0.42, 1.0, 0.6)
    : kind === "mana"
      ? new Color3(0.32, 0.78, 1.0)
      : new Color3(1.0, 0.5, 0.2);
  light.specular = light.diffuse.scale(0.8);
  light.intensity = 1.26;
  light.range = 6.5;

  const auraColorA = kind === "health"
    ? new Color4(0.48, 1.0, 0.65, 0.42)
    : kind === "mana"
      ? new Color4(0.4, 0.9, 1.0, 0.4)
      : new Color4(1.0, 0.56, 0.2, 0.44);
  const auraColorB = kind === "health"
    ? new Color4(0.2, 0.8, 0.45, 0.2)
    : kind === "mana"
      ? new Color4(0.2, 0.55, 0.9, 0.2)
      : new Color4(0.62, 0.24, 0.08, 0.22);

  const auraSpark = new ParticleSystem(`pickup-aura-${id}`, 260, scene);
  auraSpark.particleTexture = resources.smokeParticleTex;
  auraSpark.emitter = root;
  auraSpark.minEmitBox = new Vector3(-0.2, 0.05, -0.2);
  auraSpark.maxEmitBox = new Vector3(0.2, 0.4, 0.2);
  auraSpark.color1 = auraColorA;
  auraSpark.color2 = auraColorB;
  auraSpark.colorDead = new Color4(0, 0, 0, 0);
  auraSpark.minSize = 0.12;
  auraSpark.maxSize = 0.36;
  auraSpark.minLifeTime = 0.35;
  auraSpark.maxLifeTime = 0.85;
  auraSpark.emitRate = 55;
  auraSpark.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  auraSpark.gravity = new Vector3(0, 0.15, 0);
  auraSpark.direction1 = new Vector3(-0.3, 0.35, -0.3);
  auraSpark.direction2 = new Vector3(0.3, 0.65, 0.3);
  auraSpark.minEmitPower = 0.02;
  auraSpark.maxEmitPower = 0.18;
  auraSpark.updateSpeed = 0.02;
  auraSpark.start();

  const auraDust = new ParticleSystem(`pickup-dust-${id}`, 200, scene);
  auraDust.particleTexture = resources.smokeParticleTex;
  auraDust.emitter = root;
  auraDust.minEmitBox = new Vector3(-0.35, -0.1, -0.35);
  auraDust.maxEmitBox = new Vector3(0.35, 0.18, 0.35);
  auraDust.color1 = new Color4(auraColorA.r, auraColorA.g, auraColorA.b, 0.22);
  auraDust.color2 = new Color4(auraColorB.r, auraColorB.g, auraColorB.b, 0.14);
  auraDust.colorDead = new Color4(0, 0, 0, 0);
  auraDust.minSize = 0.18;
  auraDust.maxSize = 0.45;
  auraDust.minLifeTime = 0.7;
  auraDust.maxLifeTime = 1.4;
  auraDust.emitRate = 22;
  auraDust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  auraDust.gravity = new Vector3(0, 0.08, 0);
  auraDust.direction1 = new Vector3(-0.18, 0.2, -0.18);
  auraDust.direction2 = new Vector3(0.18, 0.32, 0.18);
  auraDust.minEmitPower = 0.01;
  auraDust.maxEmitPower = 0.08;
  auraDust.updateSpeed = 0.02;
  auraDust.start();

  const systems = [auraSpark, auraDust];
  if (kind === "flame") {
    const flameJets = new ParticleSystem(`pickup-flame-jet-${id}`, 200, scene);
    flameJets.particleTexture = resources.fireParticleTex;
    flameJets.emitter = root;
    flameJets.minEmitBox = new Vector3(0.16, 0.14, -0.03);
    flameJets.maxEmitBox = new Vector3(0.25, 0.22, 0.03);
    flameJets.color1 = new Color4(1.0, 0.8, 0.35, 0.85);
    flameJets.color2 = new Color4(1.0, 0.4, 0.12, 0.72);
    flameJets.colorDead = new Color4(0.2, 0.08, 0.02, 0);
    flameJets.minSize = 0.08;
    flameJets.maxSize = 0.2;
    flameJets.minLifeTime = 0.18;
    flameJets.maxLifeTime = 0.32;
    flameJets.emitRate = 48;
    flameJets.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    flameJets.direction1 = new Vector3(0.4, 0.02, -0.05);
    flameJets.direction2 = new Vector3(0.8, 0.22, 0.05);
    flameJets.minEmitPower = 0.12;
    flameJets.maxEmitPower = 0.44;
    flameJets.updateSpeed = 0.015;
    flameJets.start();
    systems.push(flameJets);
  }

  return {
    mesh: root,
    haloA,
    haloB,
    glow,
    light,
    systems,
    baseY: root.position.y,
    phase: Math.random() * Math.PI * 2,
  };
}

export function animatePickupVisual(visual: PickupVisual, timeSeconds: number): void {
  const p = timeSeconds + visual.phase;
  visual.mesh.position.y = visual.baseY + Math.sin(p * 2) * 0.08;
  visual.haloA.rotation.y = p * 1.7;
  visual.haloB.rotation.x = p * 1.3;
  const pulse = 0.92 + (Math.sin(p * 3.2) * 0.5 + 0.5) * 0.16;
  visual.glow.scaling.setAll(pulse);
  visual.light.intensity = 1.08 + (Math.sin(p * 4) * 0.5 + 0.5) * 0.56;

  const pulseRateA = 47 + Math.sin(p * 3.4) * 12;
  const pulseRateB = 18 + Math.sin(p * 2.2 + 1.2) * 5;
  if (visual.systems[0]) visual.systems[0].emitRate = Math.max(12, pulseRateA);
  if (visual.systems[1]) visual.systems[1].emitRate = Math.max(8, pulseRateB);
}

export function disposePickupVisual(visual: PickupVisual): void {
  for (const system of visual.systems) {
    system.stop();
    system.dispose();
  }
  visual.light.dispose();
  visual.mesh.dispose();
}
