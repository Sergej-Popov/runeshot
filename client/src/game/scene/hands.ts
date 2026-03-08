/**
 * Hands / Weapons — first-person hand model loading, debug UI, rig transforms.
 */
import {
  Color3,
  Node,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { GameContext } from "../runtime/gameContext";
import {
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
} from "../../dom";

// ── Debug value labels ───────────────────────────────────────────────────
function updateHandsDebugValueLabels(ctx: GameContext): void {
  handPosXValEl.textContent = ctx.handRigDebug.posX.toFixed(2);
  handPosYValEl.textContent = ctx.handRigDebug.posY.toFixed(2);
  handPosZValEl.textContent = ctx.handRigDebug.posZ.toFixed(2);
  handRotXValEl.textContent = ctx.handRigDebug.rotX.toFixed(2);
  handRotYValEl.textContent = ctx.handRigDebug.rotY.toFixed(2);
  handRotZValEl.textContent = ctx.handRigDebug.rotZ.toFixed(2);
}

// ── Sync HTML range inputs with handRigDebug state ───────────────────────
export function syncHandsDebugControlsFromState(ctx: GameContext): void {
  handPosXEl.value = ctx.handRigDebug.posX.toString();
  handPosYEl.value = ctx.handRigDebug.posY.toString();
  handPosZEl.value = ctx.handRigDebug.posZ.toString();
  handRotXEl.value = ctx.handRigDebug.rotX.toString();
  handRotYEl.value = ctx.handRigDebug.rotY.toString();
  handRotZEl.value = ctx.handRigDebug.rotZ.toString();
  updateHandsDebugValueLabels(ctx);
}

// ── Bind event handlers for hand debug sliders ───────────────────────────
export function setupHandsDebugUi(ctx: GameContext): void {
  const bindRange = (inputEl: HTMLInputElement, assign: (value: number) => void): void => {
    inputEl.addEventListener("input", () => {
      const value = Number.parseFloat(inputEl.value);
      if (!Number.isFinite(value)) return;
      assign(value);
      updateHandsDebugValueLabels(ctx);
      applyHandsRigTransform(ctx, 0, ctx.recoil * 0.35);
    });
  };

  bindRange(handPosXEl, (value) => { ctx.handRigDebug.posX = value; });
  bindRange(handPosYEl, (value) => { ctx.handRigDebug.posY = value; });
  bindRange(handPosZEl, (value) => { ctx.handRigDebug.posZ = value; });
  bindRange(handRotXEl, (value) => { ctx.handRigDebug.rotX = value; });
  bindRange(handRotYEl, (value) => { ctx.handRigDebug.rotY = value; });
  bindRange(handRotZEl, (value) => { ctx.handRigDebug.rotZ = value; });

  const swallow = (e: Event): void => e.stopPropagation();
  handsDebugPanelEl.addEventListener("mousedown", swallow);
  handsDebugPanelEl.addEventListener("mouseup", swallow);
  handsDebugPanelEl.addEventListener("click", swallow);
  handsDebugPanelEl.addEventListener("wheel", swallow);

  syncHandsDebugControlsFromState(ctx);
}

// ── Show/hide the hands debug panel ──────────────────────────────────────
export function toggleHandsDebugPanel(ctx: GameContext): void {
  ctx.handsDebugOpen = !ctx.handsDebugOpen;
  handsDebugPanelEl.classList.toggle("hidden", !ctx.handsDebugOpen);
}

// ── Apply position+rotation from handRigDebug to handsRoot ───────────────
export function applyHandsRigTransform(ctx: GameContext, bobOffset = 0, recoilOffset = 0): void {
  if (!ctx.handsRoot) return;
  ctx.handsRoot.position.set(
    ctx.handRigDebug.posX,
    ctx.handRigDebug.posY + bobOffset - recoilOffset,
    ctx.handRigDebug.posZ,
  );
  ctx.handsRoot.rotation.set(ctx.handRigDebug.rotX, ctx.handRigDebug.rotY, ctx.handRigDebug.rotZ);
}

// ── Return whichever hand node is currently rightmost in camera space ────
export function getActiveCastHandNode(ctx: GameContext): TransformNode | null {
  if (ctx.leftHandWaveNode && ctx.rightHandWaveNode) {
    const invCam = ctx.camera.getWorldMatrix().clone().invert();
    const leftCam = Vector3.TransformCoordinates(ctx.leftHandWaveNode.getAbsolutePosition(), invCam);
    const rightCam = Vector3.TransformCoordinates(ctx.rightHandWaveNode.getAbsolutePosition(), invCam);
    return rightCam.x >= leftCam.x ? ctx.rightHandWaveNode : ctx.leftHandWaveNode;
  }
  return ctx.rightHandWaveNode ?? ctx.leftHandWaveNode;
}

// ── World-space muzzle point for spell casting ───────────────────────────
export function getCastMuzzlePosition(ctx: GameContext): Vector3 | null {
  const castHand = getActiveCastHandNode(ctx);
  if (!castHand) return null;
  const handPos = castHand.getAbsolutePosition();
  const dir = ctx.camera.getDirection(new Vector3(0.02, -0.04, 1)).normalize();
  return handPos.add(dir.scale(0.58));
}

// ── Load and position first-person hand GLB models ───────────────────────
export async function makeHandModels(ctx: GameContext): Promise<void> {
  if (ctx.handsRoot) ctx.handsRoot.dispose(false, true);

  ctx.handsRoot = new TransformNode("hands-root", ctx.scene);
  ctx.handsRoot.parent = ctx.camera;
  applyHandsRigTransform(ctx);

  ctx.leftHandWaveNode = new TransformNode("left-hand-anchor", ctx.scene);
  ctx.leftHandWaveNode.parent = ctx.handsRoot;
  ctx.leftHandWaveNode.position.copyFrom(ctx.LEFT_HAND_ANCHOR_POS);

  ctx.rightHandWaveNode = new TransformNode("right-hand-wave", ctx.scene);
  ctx.rightHandWaveNode.parent = ctx.handsRoot;
  ctx.rightHandWaveNode.position.copyFrom(ctx.RIGHT_HAND_ANCHOR_POS);

  const handModelUrl = new URL("../../models/hand_low_poly.glb", import.meta.url).toString();
  try {
    const loadHand = async (name: string, parent: TransformNode, mirrored: boolean): Promise<void> => {
      const imported = await SceneLoader.ImportMeshAsync("", "", handModelUrl, ctx.scene);
      const root = new TransformNode(`${name}-root`, ctx.scene);
      root.parent = parent;
      const visibleHandMat = new StandardMaterial(`${name}-mat`, ctx.scene);
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

    await loadHand("fp-left-hand", ctx.leftHandWaveNode, false);
    await loadHand("fp-right-hand", ctx.rightHandWaveNode, true);
  } catch (err) {
    console.warn("Could not load hand model; first-person hands disabled.", err);
  }
}
