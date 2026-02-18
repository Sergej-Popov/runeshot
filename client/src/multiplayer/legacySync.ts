import { AbstractMesh, AssetContainer, AnimationGroup, DynamicTexture, Mesh, MeshBuilder, Scene, SceneLoader, StandardMaterial, Color3, Color4, ParticleSystem, PointLight, TransformNode, Vector3 } from "@babylonjs/core";
import { Client, Room } from "colyseus.js";
import "@babylonjs/loaders/glTF";
import { getServerUrl } from "./net/serverConfig";

type SchemaPlayer = {
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  mana: number;
  respawnIn: number;
};

type SchemaCat = {
  type: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
};

type SchemaProjectile = {
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
};

type SchemaPickup = {
  kind: string;
  x: number;
  y: number;
  z: number;
  amount: number;
};

type PlayerMapSchema = {
  forEach: (cb: (player: SchemaPlayer, key: string) => void) => void;
};

type CatMapSchema = {
  forEach: (cb: (cat: SchemaCat, key: string) => void) => void;
};

type ProjectileMapSchema = {
  forEach: (cb: (projectile: SchemaProjectile, key: string) => void) => void;
};

type PickupMapSchema = {
  forEach: (cb: (pickup: SchemaPickup, key: string) => void) => void;
};

type BattleStateSchema = {
  players: PlayerMapSchema;
  cats?: CatMapSchema;
  projectiles?: ProjectileMapSchema;
  pickups?: PickupMapSchema;
  level?: number;
  portalActive?: boolean;
};

type LocalPose = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  mana: number;
};

type ShootDirection = {
  dirX: number;
  dirY: number;
  dirZ: number;
};

type RemoteVisual = {
  body: Mesh;
  head: Mesh;
};

type RemoteMarker = {
  x: number;
  z: number;
};

type CatVisual = {
  root: TransformNode;
  runAnimation: AnimationGroup | null;
  fallbackMesh: Mesh | null;
  baseY: number;
};

type ProjectileVisual = {
  mesh: Mesh;
};

type PickupVisual = {
  mesh: Mesh;
  haloA: Mesh;
  haloB: Mesh;
  glow: Mesh;
  light: PointLight;
  systems: ParticleSystem[];
  baseY: number;
  phase: number;
};

export type ServerDebugInfo = {
  state: string;
  auth: string;
  lobby: string;
  room: string;
  players: string;
  url: string;
};

type SelfTransform = {
  x: number;
  y: number;
  z: number;
  rotY: number;
};

type ServerWorldState = {
  level: number;
  portalActive: boolean;
};

function getLobbyName(): string {
  const qs = new URLSearchParams(window.location.search);
  const room = qs.get("room")?.trim();
  if (room) return room.slice(0, 40);
  return "main";
}

function getLevelIndex(): number {
  const qs = new URLSearchParams(window.location.search);
  const parsed = Number(qs.get("level") ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(6, Math.floor(parsed)));
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class LegacyMultiplayerSync {
  private room: Room<BattleStateSchema> | null = null;
  private selfSessionId = "";
  private readonly remotes = new Map<string, RemoteVisual>();
  private readonly remoteMarkers = new Map<string, RemoteMarker>();
  private readonly catVisuals = new Map<string, CatVisual>();
  private readonly catMarkers = new Map<string, RemoteMarker>();
  private readonly projectileVisuals = new Map<string, ProjectileVisual>();
  private readonly pickupVisuals = new Map<string, PickupVisual>();
  private catModelContainer: AssetContainer | null = null;
  private catModelHeight = 1;
  private catModelId = 0;
  private catModelLoadPromise: Promise<void> | null = null;
  private catModelLoadFailed = false;
  private pickupParticleTexture: DynamicTexture | null = null;
  private selfHp = 100;
  private selfMana = 90;
  private selfRespawnIn = 0;
  private selfX = 0;
  private selfY = 1;
  private selfZ = 0;
  private selfRotY = 0;
  private serverLevel = 0;
  private serverPortalActive = false;
  private lastSendAt = 0;
  private lastPortalEnterRequestAt = 0;
  private connected = false;
  private connectInFlight = false;
  private reconnectTimer: number | null = null;
  private readonly lobbyName = getLobbyName();
  private readonly levelIndex = getLevelIndex();
  private readonly serverUrl = getServerUrl();
  private lastStatus = "Idle";

  constructor(private readonly scene: Scene, private readonly setStatus: (status: string) => void) {
    this.serverLevel = this.levelIndex;
  }

  async connect(): Promise<void> {
    await this.ensureConnected();
  }

  tick(localPose: LocalPose): void {
    if (!this.room || !this.connected) return;
    this.animatePickups();

    const now = performance.now();
    if (now - this.lastSendAt < 50) return;
    this.lastSendAt = now;

    this.room.send("pose", localPose);
  }

  sendShoot(direction: ShootDirection): void {
    if (!this.room || !this.connected) return;
    this.room.send("shoot", direction);
  }

  getRemoteMinimapMarkers(): RemoteMarker[] {
    return Array.from(this.remoteMarkers.values());
  }

  getRemoteCatMinimapMarkers(): RemoteMarker[] {
    return Array.from(this.catMarkers.values());
  }

  getServerCatCount(): number {
    return this.catVisuals.size;
  }

  getSelfVitals(): { hp: number; mana: number; respawnIn: number } {
    return {
      hp: this.selfHp,
      mana: this.selfMana,
      respawnIn: this.selfRespawnIn,
    };
  }

  getSelfTransform(): SelfTransform {
    return {
      x: this.selfX,
      y: this.selfY,
      z: this.selfZ,
      rotY: this.selfRotY,
    };
  }

  getServerWorldState(): ServerWorldState {
    return {
      level: this.serverLevel,
      portalActive: this.serverPortalActive,
    };
  }

  requestPortalEnter(): void {
    if (!this.room || !this.connected) return;
    const now = performance.now();
    if (now - this.lastPortalEnterRequestAt < 350) return;
    this.lastPortalEnterRequestAt = now;
    this.room.send("enterPortal");
  }

  getDebugInfo(): ServerDebugInfo {
    return {
      state: this.lastStatus,
      auth: this.selfSessionId ? `Session ${this.selfSessionId}` : "No session",
      lobby: this.lobbyName,
      room: this.room?.roomId ?? "n/a",
      players: `${this.countPlayersInRoom()} (remote rendered ${this.remotes.size}, cats ${this.catVisuals.size})`,
      url: this.serverUrl,
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected || this.connectInFlight) return;

    this.connectInFlight = true;
    this.lastStatus = "Connecting";
    this.setStatus(`Multiplayer: Connecting (${this.lobbyName})`);
    this.debug("Connecting", { url: this.serverUrl, lobby: this.lobbyName });

    try {
      const client = new Client(this.serverUrl);
      const room = await client.joinOrCreate<BattleStateSchema>("battle", {
        name: `Pilot-${Math.floor(Math.random() * 10000)}`,
        lobby: this.lobbyName,
        level: this.levelIndex,
      });

      this.room = room;
      this.selfSessionId = room.sessionId;
      this.connected = true;
      this.lastStatus = "Connected";
      this.setStatus(`Multiplayer: Connected (${this.lobbyName})`);
      this.debug("Connected", { roomId: room.roomId, sessionId: room.sessionId });

      this.bindRoom(room);
      this.clearReconnectTimer();
      this.connectInFlight = false;
      return;
    } catch (error) {
      const lastError = asErrorMessage(error);
      this.connected = false;
      this.room = null;
      this.lastStatus = `Offline (${lastError})`;
      this.setStatus(`Multiplayer: ${this.lastStatus}`);
      this.debug("Connection failed", { error: lastError });
      this.scheduleReconnect();
      this.connectInFlight = false;
      return;
    }
  }

  private bindRoom(room: Room<BattleStateSchema>): void {
    void this.ensureCatModelTemplate();

    room.onLeave((code) => {
      this.handleDisconnect(`Disconnected (${code})`);
    });

    room.onError((code, message) => {
      this.handleDisconnect(`Error ${code}: ${message}`);
    });

    room.onStateChange(() => {
      this.syncPlayersFromState(room);
    });

    this.syncPlayersFromState(room);
  }

  private handleDisconnect(reason: string): void {
    this.connected = false;
    this.room = null;
    this.lastStatus = reason;
    for (const sessionId of this.remotes.keys()) this.removeRemote(sessionId);
    for (const catId of this.catVisuals.keys()) this.removeCat(catId);
    for (const projectileId of this.projectileVisuals.keys()) this.removeProjectile(projectileId);
    for (const pickupId of this.pickupVisuals.keys()) this.removePickup(pickupId);
    this.setStatus(`Multiplayer: ${reason}`);
    this.debug("Disconnected", { reason });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected();
    }, 3000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private upsertRemote(sessionId: string, player: SchemaPlayer): void {
    this.remoteMarkers.set(sessionId, { x: player.x, z: player.z });

    let visual = this.remotes.get(sessionId);
    if (!visual) {
      const body = MeshBuilder.CreateCapsule(
        `remote-body-${sessionId}`,
        {
          radius: 0.3,
          height: 1.1,
          tessellation: 8,
        },
        this.scene,
      );
      const head = MeshBuilder.CreateSphere(
        `remote-head-${sessionId}`,
        {
          diameter: 0.22,
          segments: 8,
        },
        this.scene,
      );

      head.parent = body;
      head.position.set(0, 0.35, 0.35);

      const mat = new StandardMaterial(`remote-mat-${sessionId}`, this.scene);
      mat.diffuseColor = new Color3(0.12, 0.74, 0.92);
      body.material = mat;
      head.material = mat;

      visual = { body, head };
      this.remotes.set(sessionId, visual);
    }

    visual.body.position.copyFrom(new Vector3(player.x, player.y - 0.75, player.z));
    visual.body.rotation.y = player.rotY;
  }

  private removeRemote(sessionId: string): void {
    this.remoteMarkers.delete(sessionId);

    const visual = this.remotes.get(sessionId);
    if (!visual) return;

    visual.head.dispose();
    visual.body.dispose();
    this.remotes.delete(sessionId);
    this.debug("Remote player removed", { sessionId });
  }

  private countPlayersInRoom(): number {
    try {
      const players = (this.room as { state?: { players?: { forEach: (cb: () => void) => void } } } | null)?.state?.players;
      if (!players) return 0;
      let count = 0;
      players.forEach(() => {
        count += 1;
      });
      return count;
    } catch {
      return 0;
    }
  }

  private syncPlayersFromState(room: Room<BattleStateSchema>): void {
    const world = (room as { state?: { level?: number; portalActive?: boolean } }).state;
    if (world) {
      const nextLevel = Number.isFinite(world.level) ? Math.max(0, Math.floor(world.level ?? 0)) : this.serverLevel;
      const nextPortal = Boolean(world.portalActive);
      this.serverLevel = nextLevel;
      this.serverPortalActive = nextPortal;
    }

    const players = (room as { state?: { players?: PlayerMapSchema } }).state?.players;
    if (!players || typeof players.forEach !== "function") {
      this.debug("State not ready yet; waiting for players map");
      return;
    }

    const seen = new Set<string>();

    players.forEach((player, sessionId) => {
      if (sessionId === this.selfSessionId) {
        this.selfX = player.x;
        this.selfY = player.y;
        this.selfZ = player.z;
        this.selfRotY = player.rotY;
        this.selfHp = player.hp;
        this.selfMana = player.mana;
        this.selfRespawnIn = player.respawnIn;
        return;
      }
      seen.add(sessionId);
      this.upsertRemote(sessionId, player);
    });

    for (const sessionId of this.remotes.keys()) {
      if (!seen.has(sessionId)) {
        this.removeRemote(sessionId);
      }
    }

    this.syncCatsFromState(room);
    this.syncProjectilesFromState(room);
    this.syncPickupsFromState(room);
  }

  private syncCatsFromState(room: Room<BattleStateSchema>): void {
    const cats = (room as { state?: { cats?: CatMapSchema } }).state?.cats;
    if (!cats || typeof cats.forEach !== "function") return;

    const seen = new Set<string>();
    cats.forEach((cat, catId) => {
      seen.add(catId);
      this.upsertCat(catId, cat);
    });

    for (const catId of this.catVisuals.keys()) {
      if (!seen.has(catId)) this.removeCat(catId);
    }
  }

  private upsertCat(catId: string, cat: SchemaCat): void {
    this.catMarkers.set(catId, { x: cat.x, z: cat.z });

    let visual = this.catVisuals.get(catId);
    if (!visual) {
      visual = this.instantiateCatModelVisual(catId, cat) ?? this.createFallbackCatVisual(catId, cat);
      if (!this.catModelContainer && !this.catModelLoadFailed) {
        void this.ensureCatModelTemplate();
      }
      this.catVisuals.set(catId, visual);
      this.debug("Server cat bound", { catId, type: cat.type });
    }

    // Upgrade fallback cats to GLB once model is available.
    if (visual.fallbackMesh && this.catModelContainer) {
      this.disposeCatVisual(visual);
      visual = this.instantiateCatModelVisual(catId, cat) ?? this.createFallbackCatVisual(catId, cat);
      this.catVisuals.set(catId, visual);
    }

    visual.root.position.set(cat.x, visual.baseY, cat.z);
    visual.root.rotation.y = cat.rotY + Math.PI;
  }

  private removeCat(catId: string): void {
    this.catMarkers.delete(catId);
    const visual = this.catVisuals.get(catId);
    if (!visual) return;
    this.disposeCatVisual(visual);
    this.catVisuals.delete(catId);
    this.debug("Server cat removed", { catId });
  }

  private async ensureCatModelTemplate(): Promise<void> {
    if (this.catModelContainer || this.catModelLoadFailed) return;
    if (this.catModelLoadPromise) return this.catModelLoadPromise;

    this.catModelLoadPromise = (async () => {
      try {
        const container = await SceneLoader.LoadAssetContainerAsync("/models/", "lowpoly_cat_rig__run_animation.glb", this.scene);
        for (const group of container.animationGroups) group.stop();
        this.catModelContainer = container;

        const probe = container.instantiateModelsToScene((name) => `server-cat-probe-${name}`, false);
        const probeRoot = new TransformNode("server-cat-probe-root", this.scene);
        for (const root of probe.rootNodes) root.parent = probeRoot;
        probeRoot.computeWorldMatrix(true);
        const bounds = probeRoot.getHierarchyBoundingVectors(true);
        this.catModelHeight = Math.max(0.1, bounds.max.y - bounds.min.y);
        for (const group of probe.animationGroups) {
          group.stop();
          group.dispose();
        }
        probeRoot.dispose(false, true);
        this.debug("Cat GLB template loaded");
      } catch (error) {
        this.catModelLoadFailed = true;
        this.debug("Cat GLB template failed; fallback mesh will be used", { error: asErrorMessage(error) });
      } finally {
        this.catModelLoadPromise = null;
      }
    })();

    return this.catModelLoadPromise;
  }

  private instantiateCatModelVisual(catId: string, cat: SchemaCat): CatVisual | null {
    if (!this.catModelContainer) return null;
    const id = this.catModelId++;
    const instance = this.catModelContainer.instantiateModelsToScene((name) => `server-cat-${catId}-${id}-${name}`, false);
    const root = new TransformNode(`server-cat-actor-${catId}-${id}`, this.scene);
    for (const node of instance.rootNodes) {
      node.parent = root;
      if (node instanceof AbstractMesh) node.isPickable = true;
      for (const child of node.getChildMeshes(false)) child.isPickable = true;
    }

    const targetHeight = cat.type === "boss" || cat.type === "red" ? 1.764 : 1.05;
    const scale = targetHeight / this.catModelHeight;
    root.scaling.set(scale, scale, scale);
    root.computeWorldMatrix(true);
    const bounds = root.getHierarchyBoundingVectors(true);
    root.position.y += -bounds.min.y + 0.02;

    const runAnimation = instance.animationGroups[0] ?? null;
    if (runAnimation) runAnimation.start(true);
    for (let i = 1; i < instance.animationGroups.length; i += 1) {
      instance.animationGroups[i].stop();
    }
    return { root, runAnimation, fallbackMesh: null, baseY: root.position.y };
  }

  private createFallbackCatVisual(catId: string, cat: SchemaCat): CatVisual {
    const scale = cat.type === "boss" || cat.type === "red" ? 1.28 : 1;
    const body = MeshBuilder.CreateSphere(
      `server-cat-fallback-body-${catId}`,
      { diameterX: 0.7 * scale, diameterY: 0.52 * scale, diameterZ: 1.08 * scale, segments: 14 },
      this.scene,
    );
    const head = MeshBuilder.CreateSphere(
      `server-cat-fallback-head-${catId}`,
      { diameter: 0.46 * scale, segments: 14 },
      this.scene,
    );
    head.position = new Vector3(0, 0.18 * scale, 0.56 * scale);
    const merged = Mesh.MergeMeshes([body, head], true, true, undefined, false, true);
    const mesh = merged ?? body;
    const mat = new StandardMaterial(`server-cat-fallback-mat-${catId}`, this.scene);
    mat.diffuseColor = cat.type === "boss" || cat.type === "red" ? new Color3(0.88, 0.32, 0.24) : new Color3(0.88, 0.74, 0.58);
    mat.specularColor = new Color3(0.12, 0.12, 0.12);
    mesh.material = mat;
    const root = new TransformNode(`server-cat-fallback-root-${catId}`, this.scene);
    mesh.parent = root;
    mesh.position.set(0, 0.56, 0);
    return { root, runAnimation: null, fallbackMesh: mesh, baseY: 0 };
  }

  private disposeCatVisual(visual: CatVisual): void {
    visual.runAnimation?.stop();
    visual.runAnimation?.dispose();
    visual.root.dispose(false, true);
  }

  private syncProjectilesFromState(room: Room<BattleStateSchema>): void {
    const projectiles = (room as { state?: { projectiles?: ProjectileMapSchema } }).state?.projectiles;
    if (!projectiles || typeof projectiles.forEach !== "function") return;

    const seen = new Set<string>();
    projectiles.forEach((projectile, projectileId) => {
      seen.add(projectileId);
      this.upsertProjectile(projectileId, projectile);
    });

    for (const projectileId of this.projectileVisuals.keys()) {
      if (!seen.has(projectileId)) this.removeProjectile(projectileId);
    }
  }

  private upsertProjectile(projectileId: string, projectile: SchemaProjectile): void {
    let visual = this.projectileVisuals.get(projectileId);
    if (!visual) {
      const mesh = MeshBuilder.CreateSphere(
        `server-projectile-${projectileId}`,
        {
          diameter: 0.28,
          segments: 10,
        },
        this.scene,
      );
      const mat = new StandardMaterial(`server-projectile-mat-${projectileId}`, this.scene);
      mat.diffuseColor = new Color3(1.0, 0.45, 0.12);
      mat.emissiveColor = new Color3(1.0, 0.35, 0.08);
      mesh.material = mat;
      visual = { mesh };
      this.projectileVisuals.set(projectileId, visual);
    }
    visual.mesh.position.copyFrom(new Vector3(projectile.x, projectile.y, projectile.z));
  }

  private removeProjectile(projectileId: string): void {
    const visual = this.projectileVisuals.get(projectileId);
    if (!visual) return;
    visual.mesh.dispose();
    this.projectileVisuals.delete(projectileId);
  }

  private syncPickupsFromState(room: Room<BattleStateSchema>): void {
    const pickups = (room as { state?: { pickups?: PickupMapSchema } }).state?.pickups;
    if (!pickups || typeof pickups.forEach !== "function") return;

    const seen = new Set<string>();
    pickups.forEach((pickup, pickupId) => {
      seen.add(pickupId);
      this.upsertPickup(pickupId, pickup);
    });

    for (const pickupId of this.pickupVisuals.keys()) {
      if (!seen.has(pickupId)) this.removePickup(pickupId);
    }
  }

  private upsertPickup(pickupId: string, pickup: SchemaPickup): void {
    let visual = this.pickupVisuals.get(pickupId);
    if (!visual) {
      const mesh = MeshBuilder.CreateBox(`server-pickup-root-${pickupId}`, { size: 0.08 }, this.scene);
      mesh.isVisible = false;
      mesh.isPickable = false;

      const crate = MeshBuilder.CreateBox(
        `server-pickup-crate-${pickupId}`,
        { width: 0.54, height: 0.44, depth: 0.54 },
        this.scene,
      );
      crate.parent = mesh;

      const mat = new StandardMaterial(`server-pickup-mat-${pickupId}`, this.scene);
      if (pickup.kind === "health") {
        mat.diffuseColor = new Color3(0.9, 0.9, 0.92);
      } else {
        mat.diffuseColor = new Color3(0.2, 0.26, 0.32);
      }
      crate.material = mat;

      if (pickup.kind === "health") {
        const crossMat = new StandardMaterial(`server-pickup-health-cross-mat-${pickupId}`, this.scene);
        crossMat.diffuseColor = new Color3(0.9, 0.18, 0.2);
        crossMat.emissiveColor = new Color3(0.28, 0.05, 0.05);
        const crossV = MeshBuilder.CreateBox(
          `server-pickup-health-v-${pickupId}`,
          { width: 0.13, height: 0.28, depth: 0.06 },
          this.scene,
        );
        crossV.parent = mesh;
        crossV.position = new Vector3(0, 0, 0.3);
        crossV.material = crossMat;
        const crossH = MeshBuilder.CreateBox(
          `server-pickup-health-h-${pickupId}`,
          { width: 0.28, height: 0.13, depth: 0.06 },
          this.scene,
        );
        crossH.parent = mesh;
        crossH.position = new Vector3(0, 0, 0.3);
        crossH.material = crossMat;
      } else {
        const accentMat = new StandardMaterial(`server-pickup-mana-accent-mat-${pickupId}`, this.scene);
        accentMat.diffuseColor = new Color3(0.85, 0.67, 0.25);
        accentMat.emissiveColor = new Color3(0.2, 0.14, 0.03);
        const strap = MeshBuilder.CreateBox(
          `server-pickup-mana-strap-${pickupId}`,
          { width: 0.58, height: 0.08, depth: 0.18 },
          this.scene,
        );
        strap.parent = mesh;
        strap.position.y = 0.08;
        strap.material = accentMat;
      }

      const auraMat = new StandardMaterial(`server-pickup-aura-mat-${pickupId}`, this.scene);
      if (pickup.kind === "health") {
        auraMat.emissiveColor = new Color3(0.5, 1.0, 0.65);
        auraMat.diffuseColor = new Color3(0.18, 0.35, 0.22);
      } else {
        auraMat.emissiveColor = new Color3(0.45, 0.86, 1.0);
        auraMat.diffuseColor = new Color3(0.12, 0.25, 0.35);
      }
      auraMat.alpha = 0.24;

      const haloA = MeshBuilder.CreateTorus(
        `server-pickup-aura-a-${pickupId}`,
        { diameter: 1.1, thickness: 0.045, tessellation: 24 },
        this.scene,
      );
      haloA.parent = mesh;
      haloA.rotation.x = Math.PI / 2;
      haloA.material = auraMat;

      const haloB = MeshBuilder.CreateTorus(
        `server-pickup-aura-b-${pickupId}`,
        { diameter: 0.94, thickness: 0.04, tessellation: 24 },
        this.scene,
      );
      haloB.parent = mesh;
      haloB.rotation.z = Math.PI / 2;
      haloB.material = auraMat;

      const glow = MeshBuilder.CreateSphere(
        `server-pickup-glow-${pickupId}`,
        { diameterX: 0.88, diameterY: 0.52, diameterZ: 0.88, segments: 12 },
        this.scene,
      );
      glow.parent = mesh;
      glow.material = auraMat;

      const light = new PointLight(`server-pickup-light-${pickupId}`, Vector3.Zero(), this.scene);
      light.parent = mesh;
      light.diffuse = pickup.kind === "health" ? new Color3(0.42, 1.0, 0.6) : new Color3(0.32, 0.78, 1.0);
      light.specular = light.diffuse.scale(0.8);
      light.intensity = 1.8;
      light.range = 6.5;

      const sparkle = new ParticleSystem(`server-pickup-spark-${pickupId}`, 150, this.scene);
      sparkle.particleTexture = this.getPickupParticleTexture();
      sparkle.emitter = mesh;
      sparkle.minEmitBox = new Vector3(-0.2, 0.05, -0.2);
      sparkle.maxEmitBox = new Vector3(0.2, 0.4, 0.2);
      sparkle.color1 = pickup.kind === "health" ? new Color4(0.48, 1, 0.65, 0.5) : new Color4(0.4, 0.9, 1, 0.48);
      sparkle.color2 = pickup.kind === "health" ? new Color4(0.2, 0.8, 0.45, 0.28) : new Color4(0.2, 0.55, 0.9, 0.25);
      sparkle.colorDead = new Color4(0, 0, 0, 0);
      sparkle.minSize = 0.06;
      sparkle.maxSize = 0.16;
      sparkle.minLifeTime = 0.35;
      sparkle.maxLifeTime = 0.85;
      sparkle.emitRate = 36;
      sparkle.blendMode = ParticleSystem.BLENDMODE_ONEONE;
      sparkle.gravity = new Vector3(0, 0.1, 0);
      sparkle.direction1 = new Vector3(-0.2, 0.35, -0.2);
      sparkle.direction2 = new Vector3(0.2, 0.6, 0.2);
      sparkle.minEmitPower = 0.02;
      sparkle.maxEmitPower = 0.14;
      sparkle.updateSpeed = 0.02;
      sparkle.start();

      const dust = new ParticleSystem(`server-pickup-dust-${pickupId}`, 120, this.scene);
      dust.particleTexture = this.getPickupParticleTexture();
      dust.emitter = mesh;
      dust.minEmitBox = new Vector3(-0.3, -0.08, -0.3);
      dust.maxEmitBox = new Vector3(0.3, 0.15, 0.3);
      dust.color1 = pickup.kind === "health" ? new Color4(0.5, 0.95, 0.7, 0.18) : new Color4(0.45, 0.8, 1, 0.16);
      dust.color2 = pickup.kind === "health" ? new Color4(0.2, 0.6, 0.4, 0.08) : new Color4(0.2, 0.45, 0.8, 0.08);
      dust.colorDead = new Color4(0, 0, 0, 0);
      dust.minSize = 0.14;
      dust.maxSize = 0.34;
      dust.minLifeTime = 0.7;
      dust.maxLifeTime = 1.35;
      dust.emitRate = 18;
      dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      dust.gravity = new Vector3(0, 0.05, 0);
      dust.direction1 = new Vector3(-0.14, 0.18, -0.14);
      dust.direction2 = new Vector3(0.14, 0.3, 0.14);
      dust.minEmitPower = 0.01;
      dust.maxEmitPower = 0.08;
      dust.updateSpeed = 0.02;
      dust.start();

      visual = {
        mesh,
        haloA,
        haloB,
        glow,
        light,
        systems: [sparkle, dust],
        baseY: pickup.y,
        phase: Math.random() * Math.PI * 2,
      };
      this.pickupVisuals.set(pickupId, visual);
    }

    visual.mesh.position.copyFrom(new Vector3(pickup.x, pickup.y, pickup.z));
    visual.baseY = pickup.y;
  }

  private removePickup(pickupId: string): void {
    const visual = this.pickupVisuals.get(pickupId);
    if (!visual) return;
    for (const system of visual.systems) {
      system.stop();
      system.dispose();
    }
    visual.light.dispose();
    visual.mesh.dispose();
    this.pickupVisuals.delete(pickupId);
  }

  private animatePickups(): void {
    const t = performance.now() * 0.001;
    for (const visual of this.pickupVisuals.values()) {
      const p = t + visual.phase;
      visual.mesh.position.y = visual.baseY + Math.sin(p * 2) * 0.08;
      visual.haloA.rotation.y = p * 1.7;
      visual.haloB.rotation.x = p * 1.3;
      const pulse = 0.92 + (Math.sin(p * 3.2) * 0.5 + 0.5) * 0.16;
      visual.glow.scaling.setAll(pulse);
      visual.light.intensity = 1.55 + (Math.sin(p * 4) * 0.5 + 0.5) * 0.8;
    }
  }

  private getPickupParticleTexture(): DynamicTexture {
    if (this.pickupParticleTexture) return this.pickupParticleTexture;
    const tex = new DynamicTexture("server-pickup-particle-tex", { width: 128, height: 128 }, this.scene, false);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.24, "rgba(240,240,240,0.9)");
    grad.addColorStop(0.58, "rgba(180,180,180,0.45)");
    grad.addColorStop(1, "rgba(30,30,30,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 90; i += 1) {
      const alpha = 0.02 + Math.random() * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 128, Math.random() * 128, 0.4 + Math.random() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.update(false);
    this.pickupParticleTexture = tex;
    return tex;
  }

  private debug(message: string, payload?: Record<string, unknown>): void {
    if (payload) {
      console.debug("[MultiplayerSync]", message, payload);
      return;
    }
    console.debug("[MultiplayerSync]", message);
  }
}

