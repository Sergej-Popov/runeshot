import {
  Color3,
  DynamicTexture,
  StandardMaterial,
  Texture,
  type Scene,
} from "@babylonjs/core";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type LevelMaterials = {
  wallMat: StandardMaterial;
  floorMat: StandardMaterial;
  pitMat: StandardMaterial;
  platformMat: StandardMaterial;
  stairMat: StandardMaterial;
  trampolineMat: StandardMaterial;
  portalMat: StandardMaterial;
};

export type ParticleTextures = {
  smokeParticleTex: DynamicTexture;
  fireParticleTex: DynamicTexture;
};

// ──────────────────────────────────────────────
// Wall brick texture generation
// ──────────────────────────────────────────────

function createBrickTexture(scene: Scene): DynamicTexture {
  const wallTex = new DynamicTexture(
    "wall-brick-tex",
    { width: 1024, height: 1024 },
    scene,
    false,
  );
  const ctx = wallTex.getContext();
  ctx.fillStyle = "#6a4a3a";
  ctx.fillRect(0, 0, 1024, 1024);

  const brickH = 64;
  const brickW = 128;
  for (let row = 0; row < 16; row += 1) {
    const y = row * brickH;
    const offset = (row % 2) * (brickW / 2);
    for (let x = -brickW; x < 1024 + brickW; x += brickW) {
      const bx = x + offset;
      const tint = 92 + Math.floor(Math.random() * 36);
      ctx.fillStyle = `rgb(${tint + 28}, ${tint + 8}, ${tint - 6})`;
      ctx.fillRect(bx + 2, y + 2, brickW - 4, brickH - 4);

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(bx + 8, y + 8, brickW - 24, 6);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(bx + 6, y + brickH - 12, brickW - 16, 5);
    }
  }

  ctx.strokeStyle = "rgba(40,28,22,0.65)";
  ctx.lineWidth = 2;
  for (let y = 0; y <= 1024; y += brickH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  wallTex.update(false);
  wallTex.wrapU = Texture.WRAP_ADDRESSMODE;
  wallTex.wrapV = Texture.WRAP_ADDRESSMODE;
  wallTex.vScale = 1.2;
  return wallTex;
}

// ──────────────────────────────────────────────
// Level materials
// ──────────────────────────────────────────────

export function createLevelMaterials(scene: Scene): LevelMaterials {
  const wallMat = new StandardMaterial("wall", scene);
  wallMat.diffuseColor = new Color3(0.33, 0.33, 0.4);
  wallMat.backFaceCulling = false;
  wallMat.diffuseTexture = createBrickTexture(scene);
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

  return { wallMat, floorMat, pitMat, platformMat, stairMat, trampolineMat, portalMat };
}

// ──────────────────────────────────────────────
// Particle textures
// ──────────────────────────────────────────────

function createSmokeParticleTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(
    "smoke-particle-tex",
    { width: 128, height: 128 },
    scene,
    false,
  );
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
    ctx.arc(
      Math.random() * 128,
      Math.random() * 128,
      Math.random() * 2.8 + 0.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  tex.update(false);
  return tex;
}

function createFireParticleTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(
    "fire-particle-tex",
    { width: 128, height: 128 },
    scene,
    false,
  );
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

export function createParticleTextures(scene: Scene): ParticleTextures {
  return {
    smokeParticleTex: createSmokeParticleTexture(scene),
    fireParticleTex: createFireParticleTexture(scene),
  };
}
