import {
  AbstractMesh,
  AnimationGroup,
  Color3,
  Mesh,
  MeshBuilder,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AssetContainer,
  type Scene,
} from "@babylonjs/core";
import type { EnemyType } from "../runtime/types";
import { enemyFallbackScale, enemyTargetHeight } from "../runtime/combat";

// ──────────────────────────────────────────────
// State held by the factory (module-level)
// ──────────────────────────────────────────────

let enemyModelContainer: AssetContainer | null = null;
let enemyModelHeight = 1;
let enemyModelId = 0;

// ──────────────────────────────────────────────
// Template loading
// ──────────────────────────────────────────────

export async function loadEnemyModelTemplate(scene: Scene): Promise<void> {
  if (enemyModelContainer) return;

  try {
    const container = await SceneLoader.LoadAssetContainerAsync(
      "/models/",
      "lowpoly_cat_rig__run_animation.glb",
      scene,
    );
    for (const group of container.animationGroups) group.stop();
    enemyModelContainer = container;

    const probe = container.instantiateModelsToScene(
      (name) => `cat-probe-${name}`,
      false,
    );
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
    console.warn(
      "Could not load animated cat model from /models; using procedural cat.",
      err,
    );
    enemyModelContainer = null;
  }
}

// ──────────────────────────────────────────────
// Model instantiation
// ──────────────────────────────────────────────

export type InstantiatedEnemy = {
  root: TransformNode;
  runAnimation: AnimationGroup | null;
};

export function instantiateEnemyModel(
  type: EnemyType,
  pos: Vector3,
  scene: Scene,
): InstantiatedEnemy | null {
  if (!enemyModelContainer) return null;
  const id = enemyModelId++;
  const instance = enemyModelContainer.instantiateModelsToScene(
    (name) => `cat-${id}-${name}`,
    false,
  );

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
  for (let i = 1; i < instance.animationGroups.length; i += 1) {
    instance.animationGroups[i].stop();
  }
  return { root: actorRoot, runAnimation };
}

// ──────────────────────────────────────────────
// Procedural fallback mesh (when glTF unavailable)
// ──────────────────────────────────────────────

export function createProceduralEnemyMesh(
  type: EnemyType,
  pos: Vector3,
  scene: Scene,
): Mesh {
  const size = enemyFallbackScale(type);

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

  mesh.position = new Vector3(
    pos.x,
    enemyTargetHeight(type),
    pos.z,
  );

  return mesh;
}

/**
 * Reset factory state (e.g. on full game restart).
 */
export function resetEnemyFactory(): void {
  enemyModelContainer = null;
  enemyModelHeight = 1;
  enemyModelId = 0;
}
