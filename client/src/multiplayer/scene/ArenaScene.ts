import {
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { MAP } from "../../game/state";
import type { RemotePlayerState } from "../types";
import type { InputSnapshot } from "../types";

const TILE_SIZE = 2;
const WALL_HEIGHT = 3;

type PlayerVisual = {
  body: Mesh;
  cap: Mesh;
};

function mapToWorld(mx: number, my: number): Vector3 {
  return new Vector3((mx - MAP[0].length / 2) * TILE_SIZE, 0, (my - MAP.length / 2) * TILE_SIZE);
}

export class ArenaScene {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly playerVisuals = new Map<string, PlayerVisual>();
  private localSelf = { x: 0, y: 1, z: 0, rotY: 0, ready: true };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);

    this.scene.clearColor.set(0.06, 0.08, 0.12, 1);

    this.camera = new UniversalCamera("camera", new Vector3(0, 1.4, -4), this.scene);
    this.camera.minZ = 0.05;
    this.camera.fov = Math.PI / 2.8;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;

    const light = new HemisphericLight("hemi", new Vector3(0.4, 1, 0.3), this.scene);
    light.intensity = 0.95;

    this.makeStaticWorld();

    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private makeStaticWorld(): void {
    const ground = MeshBuilder.CreateGround("ground", {
      width: MAP[0].length * TILE_SIZE,
      height: MAP.length * TILE_SIZE,
      subdivisions: 2,
    }, this.scene);
    const floorMaterial = new StandardMaterial("floor", this.scene);
    floorMaterial.diffuseColor = new Color3(0.18, 0.22, 0.28);
    floorMaterial.specularColor.set(0, 0, 0);
    ground.material = floorMaterial;

    const wallMaterial = new StandardMaterial("wall", this.scene);
    wallMaterial.diffuseColor = new Color3(0.42, 0.35, 0.32);

    for (let y = 0; y < MAP.length; y += 1) {
      for (let x = 0; x < MAP[y].length; x += 1) {
        if (MAP[y][x] !== "#") continue;
        const wall = MeshBuilder.CreateBox(`wall-${x}-${y}`, {
          width: TILE_SIZE,
          depth: TILE_SIZE,
          height: WALL_HEIGHT,
        }, this.scene);
        const at = mapToWorld(x + 0.5, y + 0.5);
        wall.position.set(at.x, WALL_HEIGHT / 2, at.z);
        wall.material = wallMaterial;
      }
    }
  }

  private makePlayerVisual(sessionId: string, isSelf: boolean): PlayerVisual {
    const body = MeshBuilder.CreateCapsule(`player-${sessionId}`, {
      radius: 0.35,
      height: 1.2,
      tessellation: 8,
    }, this.scene);
    body.position.y = 0.6;

    const cap = MeshBuilder.CreateBox(`player-cap-${sessionId}`, {
      width: 0.12,
      depth: 0.12,
      height: 0.12,
    }, this.scene);
    cap.parent = body;
    cap.position.set(0, 0.1, 0.45);

    const material = new StandardMaterial(`player-mat-${sessionId}`, this.scene);
    material.diffuseColor = isSelf ? new Color3(1.0, 0.55, 0.18) : new Color3(0.25, 0.82, 0.9);
    body.material = material;
    cap.material = material;

    return { body, cap };
  }

  upsertPlayer(player: RemotePlayerState, selfSessionId: string): void {
    const isSelf = player.sessionId === selfSessionId;
    let visual = this.playerVisuals.get(player.sessionId);
    if (!visual) {
      visual = this.makePlayerVisual(player.sessionId, isSelf);
      this.playerVisuals.set(player.sessionId, visual);
    }

    visual.body.position.set(player.x, player.y, player.z);
    visual.body.rotation.y = player.rotY;

    if (isSelf) {
      if (!this.localSelf.ready) {
        this.localSelf = { x: player.x, y: player.y, z: player.z, rotY: player.rotY, ready: true };
      } else {
        const t = 0.2;
        this.localSelf.x = this.localSelf.x + (player.x - this.localSelf.x) * t;
        this.localSelf.y = this.localSelf.y + (player.y - this.localSelf.y) * t;
        this.localSelf.z = this.localSelf.z + (player.z - this.localSelf.z) * t;
        this.localSelf.rotY = this.localSelf.rotY + (player.rotY - this.localSelf.rotY) * t;
      }
    }
  }

  applyLocalInput(input: InputSnapshot, dt: number): void {
    if (!this.localSelf.ready) return;

    const turnSpeed = 2.8;
    const walkSpeed = 5;
    const sprintSpeed = 8;
    const half = MAP.length;

    this.localSelf.rotY += input.turn * turnSpeed * dt;

    const len = Math.hypot(input.strafe, input.forward);
    const mx = len > 0.001 ? input.strafe / len : 0;
    const mz = len > 0.001 ? input.forward / len : 0;
    const speed = input.sprint ? sprintSpeed : walkSpeed;

    const sin = Math.sin(this.localSelf.rotY);
    const cos = Math.cos(this.localSelf.rotY);
    const worldX = mx * cos + mz * sin;
    const worldZ = mz * cos - mx * sin;

    this.localSelf.x = Math.max(-half, Math.min(half, this.localSelf.x + worldX * speed * dt));
    this.localSelf.z = Math.max(-half, Math.min(half, this.localSelf.z + worldZ * speed * dt));

    this.camera.position.set(this.localSelf.x, this.localSelf.y + 0.9, this.localSelf.z);
    this.camera.rotation.set(0, this.localSelf.rotY, 0);
  }

  removePlayer(sessionId: string): void {
    const visual = this.playerVisuals.get(sessionId);
    if (!visual) return;

    visual.cap.dispose();
    visual.body.dispose();
    this.playerVisuals.delete(sessionId);
  }

  start(update: (dt: number) => void): void {
    let last = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      this.scene.render();
    });
  }
}
