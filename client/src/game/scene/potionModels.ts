import {
  Color3,
  Mesh,
  MeshBuilder,
  SceneLoader,
  StandardMaterial,
  Vector3,
  VertexData,
  type Scene,
} from "@babylonjs/core";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const POTION_MODEL_FILE = "../../models/4_colour_alchemist_sphere_like_potions.glb";

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

let freezePotionTemplateMesh: Mesh | null = null;
let freezePotionTemplatePromise: Promise<void> | null = null;
let poisonPotionTemplateMesh: Mesh | null = null;
let poisonPotionTemplatePromise: Promise<void> | null = null;

// ──────────────────────────────────────────────
// Public getters
// ──────────────────────────────────────────────

export function getFreezePotionTemplate(): Mesh | null {
  return freezePotionTemplateMesh;
}

export function getPoisonPotionTemplate(): Mesh | null {
  return poisonPotionTemplateMesh;
}

// ──────────────────────────────────────────────
// Material utilities
// ──────────────────────────────────────────────

function materialBlueScore(material: unknown): number {
  if (!material || typeof material !== "object") return -10;
  const rec = material as { diffuseColor?: Color3; albedoColor?: Color3; emissiveColor?: Color3 };
  const c = rec.albedoColor ?? rec.diffuseColor ?? rec.emissiveColor;
  if (!c) return -5;
  return c.b - (c.r * 0.55 + c.g * 0.45);
}

function materialGreenScore(material: unknown): number {
  if (!material || typeof material !== "object") return -10;
  const rec = material as { diffuseColor?: Color3; albedoColor?: Color3; emissiveColor?: Color3 };
  const c = rec.albedoColor ?? rec.diffuseColor ?? rec.emissiveColor;
  if (!c) return -5;
  return c.g - (c.r * 0.5 + c.b * 0.5);
}

function materialNameIncludes(material: unknown, token: string): boolean {
  if (!material || typeof material !== "object") return false;
  const name = (material as { name?: string }).name;
  if (!name) return false;
  return name.toLowerCase().includes(token.toLowerCase());
}

function configurePotionVisualMaterial(mesh: Mesh): void {
  const material = mesh.material as (StandardMaterial & { twoSidedLighting?: boolean }) | null;
  if (!material) return;
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
}

// ──────────────────────────────────────────────
// Mesh extraction (connected component)
// ──────────────────────────────────────────────

function extractFirstConnectedComponent(source: Mesh): Mesh | null {
  const positions = source.getVerticesData("position");
  const indices = source.getIndices();
  if (!positions || !indices || indices.length < 3) return null;

  const vertexCount = Math.floor(positions.length / 3);
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) parent[i] = i;

  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== x) {
      const p = parent[x];
      parent[x] = r;
      x = p;
    }
    return r;
  };

  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    union(a, b);
    union(b, c);
    union(c, a);
  }

  const componentOrder: number[] = [];
  const componentSeen = new Set<number>();
  const componentTriangleCounts = new Map<number, number>();
  const componentMin = new Map<number, Vector3>();
  const componentMax = new Map<number, Vector3>();
  const componentCenterAccum = new Map<number, Vector3>();
  const componentCenterCount = new Map<number, number>();

  for (let vi = 0; vi < vertexCount; vi += 1) {
    const root = find(vi);
    const p = new Vector3(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]);
    const min = componentMin.get(root);
    const max = componentMax.get(root);
    if (!min) {
      componentMin.set(root, p.clone());
      componentMax.set(root, p.clone());
      componentCenterAccum.set(root, p.clone());
      componentCenterCount.set(root, 1);
    } else {
      min.x = Math.min(min.x, p.x);
      min.y = Math.min(min.y, p.y);
      min.z = Math.min(min.z, p.z);
      const mx = componentMax.get(root)!;
      mx.x = Math.max(mx.x, p.x);
      mx.y = Math.max(mx.y, p.y);
      mx.z = Math.max(mx.z, p.z);
      componentCenterAccum.get(root)!.addInPlace(p);
      componentCenterCount.set(root, (componentCenterCount.get(root) ?? 0) + 1);
    }
  }

  const componentCenter = new Map<number, Vector3>();
  for (const root of componentCenterAccum.keys()) {
    const sum = componentCenterAccum.get(root)!;
    const count = componentCenterCount.get(root) ?? 1;
    componentCenter.set(root, sum.scale(1 / count));
  }

  for (let i = 0; i < indices.length; i += 3) {
    const root = find(indices[i]);
    if (!componentSeen.has(root)) {
      componentSeen.add(root);
      componentOrder.push(root);
    }
    componentTriangleCounts.set(root, (componentTriangleCounts.get(root) ?? 0) + 1);
  }

  if (componentOrder.length <= 1) return source;

  let chosenRoot = componentOrder[0];
  let chosenTris = componentTriangleCounts.get(chosenRoot) ?? 0;
  for (const root of componentOrder) {
    const triCount = componentTriangleCounts.get(root) ?? 0;
    if (triCount > chosenTris) {
      chosenTris = triCount;
      chosenRoot = root;
    }
  }

  const seedMin = componentMin.get(chosenRoot) ?? Vector3.Zero();
  const seedMax = componentMax.get(chosenRoot) ?? Vector3.Zero();
  const seedSize = seedMax.subtract(seedMin);
  const seedRadius = Math.max(seedSize.length() * 0.55, 0.08);
  const seedCenter = componentCenter.get(chosenRoot) ?? Vector3.Zero();
  const includedRoots = new Set<number>([chosenRoot]);
  for (const root of componentOrder) {
    if (root === chosenRoot) continue;
    const c = componentCenter.get(root);
    if (!c) continue;
    if (Vector3.Distance(c, seedCenter) <= seedRadius) {
      includedRoots.add(root);
    }
  }

  const normals = source.getVerticesData("normal") ?? undefined;
  const uvs = source.getVerticesData("uv") ?? undefined;

  const newPositions: number[] = [];
  const newNormals: number[] = [];
  const newUvs: number[] = [];
  const newIndices: number[] = [];
  const remap = new Map<number, number>();

  const mapVertex = (oldIndex: number): number => {
    const existing = remap.get(oldIndex);
    if (existing !== undefined) return existing;
    const next = remap.size;
    remap.set(oldIndex, next);
    newPositions.push(
      positions[oldIndex * 3],
      positions[oldIndex * 3 + 1],
      positions[oldIndex * 3 + 2],
    );
    if (normals) {
      newNormals.push(
        normals[oldIndex * 3],
        normals[oldIndex * 3 + 1],
        normals[oldIndex * 3 + 2],
      );
    }
    if (uvs) {
      newUvs.push(
        uvs[oldIndex * 2],
        uvs[oldIndex * 2 + 1],
      );
    }
    return next;
  };

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    if (!includedRoots.has(find(a))) continue;
    newIndices.push(mapVertex(a), mapVertex(b), mapVertex(c));
  }

  if (newIndices.length === 0) return source;

  const out = new Mesh(`${source.name}-single`, source.getScene());
  const data = new VertexData();
  data.positions = newPositions;
  data.indices = newIndices;
  if (newNormals.length > 0) data.normals = newNormals;
  else {
    const computedNormals: number[] = [];
    VertexData.ComputeNormals(newPositions, newIndices, computedNormals);
    data.normals = computedNormals;
  }
  if (newUvs.length > 0) data.uvs = newUvs;
  data.applyToMesh(out, true);
  out.material = source.material;
  out.isPickable = false;
  configurePotionVisualMaterial(out);
  return out;
}

// ──────────────────────────────────────────────
// Template loaders
// ──────────────────────────────────────────────

async function loadPotionTemplate(
  scene: Scene,
  colorToken: string,
  scoreFunc: (material: unknown) => number,
): Promise<Mesh | null> {
  const potionModelUrl = new URL(POTION_MODEL_FILE, import.meta.url).toString();
  const imported = await SceneLoader.ImportMeshAsync("", "", potionModelUrl, scene);
  const candidates = imported.meshes.filter(
    (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0,
  );
  if (candidates.length === 0) {
    throw new Error(`No usable meshes in ${POTION_MODEL_FILE}`);
  }

  let chosen = candidates.find((c) => materialNameIncludes(c.material, colorToken)) ?? candidates[0];
  let bestScore = -9999;
  for (const candidate of candidates) {
    const score = scoreFunc(candidate.material) + (materialNameIncludes(candidate.material, colorToken) ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      chosen = candidate;
    }
  }

  for (const candidate of candidates) {
    if (candidate !== chosen) candidate.dispose(false, false);
  }

  const single = extractFirstConnectedComponent(chosen);
  if (single && single !== chosen) {
    chosen.dispose(false, false);
    chosen = single;
  }

  chosen.setParent(null);
  chosen.computeWorldMatrix(true);
  chosen.bakeCurrentTransformIntoVertices();
  chosen.position.setAll(0);
  chosen.rotation.setAll(0);
  chosen.scaling.setAll(1);
  chosen.isVisible = false;
  chosen.setEnabled(false);
  chosen.isPickable = false;
  configurePotionVisualMaterial(chosen);
  return chosen;
}

export async function loadFreezePotionTemplate(scene: Scene): Promise<void> {
  if (freezePotionTemplateMesh) return;
  if (freezePotionTemplatePromise) return freezePotionTemplatePromise;

  freezePotionTemplatePromise = (async () => {
    try {
      freezePotionTemplateMesh = await loadPotionTemplate(scene, "blue", materialBlueScore);
    } catch (err) {
      console.warn(`Could not load potion model ${POTION_MODEL_FILE}; freeze throw uses sphere fallback.`, err);
      freezePotionTemplateMesh = null;
    } finally {
      freezePotionTemplatePromise = null;
    }
  })();

  return freezePotionTemplatePromise;
}

export async function loadPoisonPotionTemplate(scene: Scene): Promise<void> {
  if (poisonPotionTemplateMesh) return;
  if (poisonPotionTemplatePromise) return poisonPotionTemplatePromise;

  poisonPotionTemplatePromise = (async () => {
    try {
      poisonPotionTemplateMesh = await loadPotionTemplate(scene, "green", materialGreenScore);
    } catch (err) {
      console.warn(`Could not load potion model ${POTION_MODEL_FILE}; poison throw uses sphere fallback.`, err);
      poisonPotionTemplateMesh = null;
    } finally {
      poisonPotionTemplatePromise = null;
    }
  })();

  return poisonPotionTemplatePromise;
}

/**
 * Reset potion template state.
 */
export function resetPotionModels(): void {
  freezePotionTemplateMesh = null;
  freezePotionTemplatePromise = null;
  poisonPotionTemplateMesh = null;
  poisonPotionTemplatePromise = null;
}
