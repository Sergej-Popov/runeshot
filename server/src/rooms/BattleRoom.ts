import { Client, Room } from "colyseus";
import { BattleState, Cat, Pickup, Player, Projectile } from "../state/BattleState.js";

const ARENA_HALF_SIZE = 15;
const BASE_SPEED = 5;
const SPRINT_SPEED = 8;
const TURN_SPEED = 2.8;
const FIRE_COOLDOWN = 0.24;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_SPEED = 10.625;
const PROJECTILE_LIFE = 3.5;
const PROJECTILE_RADIUS = 0.45;
const RESPAWN_DELAY_SECONDS = 5;
const SERVER_CATS = 5;
const CAT_BASE_SPEED = 3.2;
const CAT_TURN_SPEED = 3.8;
const CAT_PERSONAL_SPACE = 1.4;
const CAT_FIRE_RANGE_NORMAL = 10.5;
const CAT_FIRE_RANGE_BOSS = 13;
const CAT_PROJECTILE_SPEED = 9.2;
const CAT_PROJECTILE_LIFE = 3.2;
const CAT_PROJECTILE_DAMAGE_NORMAL = 8;
const CAT_PROJECTILE_DAMAGE_BOSS = 12;
const TILE_SIZE = 2;
const MAP_W = 16;
const MAP_H = 16;
const LEVEL_RESPAWN_MAP_POINTS = [
  { x: 2.2, y: 2.2 },
  { x: 2.2, y: 13.2 },
  { x: 13.2, y: 2.2 },
  { x: 2.6, y: 8.0 },
  { x: 2.4, y: 8.0 },
  { x: 10.8, y: 9.4 },
  { x: 8.0, y: 13.2 },
];
const LEVEL_PORTAL_MAP_POINTS = [
  { x: 13.5, y: 13.5 },
  { x: 13.5, y: 2.5 },
  { x: 2.5, y: 13.5 },
  { x: 13.5, y: 8.5 },
  { x: 13.5, y: 8.5 },
  { x: 2.5, y: 8.5 },
  { x: 8.0, y: 2.4 },
];
const PICKUP_MAP_POINTS = [
  { x: 3.2, y: 3.2 },
  { x: 6.8, y: 3.4 },
  { x: 10.8, y: 3.6 },
  { x: 13.0, y: 6.0 },
  { x: 12.6, y: 10.6 },
  { x: 9.2, y: 12.6 },
  { x: 5.0, y: 12.8 },
  { x: 3.4, y: 10.6 },
  { x: 2.8, y: 7.6 },
  { x: 6.2, y: 8.2 },
  { x: 9.8, y: 8.0 },
  { x: 12.2, y: 7.8 },
];
const PICKUP_RADIUS = 0.95;
const MAX_PLAYER_AMMO = 200;
const PORTAL_ACTIVATE_RADIUS = 1.4;
const CAT_SPAWN_MAP_POINTS = [
  { x: 2.6, y: 2.6 },
  { x: 13.2, y: 2.8 },
  { x: 13.4, y: 13.2 },
  { x: 2.8, y: 13.4 },
  { x: 8.0, y: 2.2 },
  { x: 13.8, y: 8.0 },
  { x: 8.0, y: 13.8 },
  { x: 2.2, y: 8.0 },
];

type CatBrain = {
  targetId: string | null;
  thinkIn: number;
  orbitDir: 1 | -1;
  preferredRange: number;
  shootIn: number;
  desiredYaw: number;
  stuckFor: number;
  lastX: number;
  lastZ: number;
};

type PlayerInput = {
  forward: number;
  strafe: number;
  turn: number;
  sprint: boolean;
  shoot: boolean;
};

type PlayerPose = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  ammo: number;
};

type ShootPayload = {
  dirX: number;
  dirY: number;
  dirZ: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize2D(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function rotateTowards(current: number, desired: number, maxStep: number): number {
  const delta = normalizeAngle(desired - current);
  const clamped = clamp(delta, -maxStep, maxStep);
  return normalizeAngle(current + clamped);
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class BattleRoom extends Room<BattleState> {
  private readonly inputs = new Map<string, PlayerInput>();
  private readonly fireCooldowns = new Map<string, number>();
  private readonly lastPoseAt = new Map<string, number>();
  private inputSamples = 0;
  private poseSamples = 0;
  private lastTrafficLogAt = 0;
  private readonly catBrains = new Map<string, CatBrain>();
  private projectileSeq = 0;
  private pickupSeq = 0;
  private readonly respawnAt = new Map<string, number>();
  private roomLevel = 0;
  private botsEnabled = true;
  private lobbyName = "main";

  override onCreate(options?: { lobby?: string; level?: number; bots?: boolean }): void {
    this.setState(new BattleState());
    this.roomLevel = clampLevelIndex(options?.level);
    this.state.level = this.roomLevel;
    this.botsEnabled = options?.bots !== false;
    this.lobbyName = options?.lobby ?? "main";
    this.setMetadata({ lobby: this.lobbyName, level: this.roomLevel });
    this.debug("created", { lobby: this.lobbyName, level: this.roomLevel, bots: this.botsEnabled });
    this.resetLevelContent();

    this.onMessage("input", (client, payload: Partial<PlayerInput>) => {
      this.inputs.set(client.sessionId, {
        forward: clamp(payload.forward ?? 0, -1, 1),
        strafe: clamp(payload.strafe ?? 0, -1, 1),
        turn: clamp(payload.turn ?? 0, -3, 3),
        sprint: Boolean(payload.sprint),
        shoot: Boolean(payload.shoot),
      });
      this.inputSamples += 1;
      this.logTrafficIfNeeded();
    });

    this.onMessage("pose", (client, payload: Partial<PlayerPose>) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (player.hp <= 0) return;

      player.x = clamp(payload.x ?? player.x, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
      player.y = clamp(payload.y ?? player.y, 0.2, 8);
      player.z = clamp(payload.z ?? player.z, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
      player.rotY = payload.rotY ?? player.rotY;
      this.lastPoseAt.set(client.sessionId, Date.now());
      this.poseSamples += 1;
      this.logTrafficIfNeeded();
    });

    this.onMessage("shoot", (client, payload: Partial<ShootPayload>) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter) return;
      if (shooter.hp <= 0) return;
      this.tryShoot(client.sessionId, shooter, payload);
    });

    this.onMessage("enterPortal", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      this.tryAdvanceLevel(client.sessionId, player);
    });

    this.setSimulationInterval((deltaTimeMs) => {
      const dt = deltaTimeMs / 1000;
      this.stepCooldowns(dt);
      this.stepPlayers(dt);
      if (this.botsEnabled) this.stepCats(dt);
      this.stepProjectiles(dt);
      this.stepPickups();
    });
  }

  override onJoin(client: Client, options?: { name?: string }): void {
    const spawn = this.getRespawnPoint();
    const playerName = (options?.name ?? "Pilot").slice(0, 24);
    this.state.players.set(client.sessionId, new Player(playerName, spawn.x, spawn.y, spawn.z));
    this.inputs.set(client.sessionId, {
      forward: 0,
      strafe: 0,
      turn: 0,
      sprint: false,
      shoot: false,
    });
    this.fireCooldowns.set(client.sessionId, 0);
    this.debug("join", {
      sessionId: client.sessionId,
      name: playerName,
      players: this.state.players.size,
    });
  }

  override onLeave(client: Client): void {
    this.inputs.delete(client.sessionId);
    this.fireCooldowns.delete(client.sessionId);
    this.lastPoseAt.delete(client.sessionId);
    this.respawnAt.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.removeProjectilesByOwner(client.sessionId);
    this.debug("leave", { sessionId: client.sessionId, players: this.state.players.size });
  }

  override onDispose(): void {
    this.debug("disposed");
  }

  private stepCooldowns(dt: number): void {
    for (const [sessionId, cooldown] of this.fireCooldowns.entries()) {
      this.fireCooldowns.set(sessionId, Math.max(0, cooldown - dt));
    }
  }

  private stepPlayers(dt: number): void {
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.hp <= 0) {
        this.stepRespawn(sessionId, player);
        continue;
      }

      const poseAgeMs = Date.now() - (this.lastPoseAt.get(sessionId) ?? 0);
      if (poseAgeMs < 250) continue;

      const input = this.inputs.get(sessionId);
      if (!input) continue;

      player.rotY += input.turn * TURN_SPEED * dt;

      const move = normalize2D(input.strafe, input.forward);
      const speed = input.sprint ? SPRINT_SPEED : BASE_SPEED;
      const sin = Math.sin(player.rotY);
      const cos = Math.cos(player.rotY);
      const worldX = move.x * cos + move.z * sin;
      const worldZ = move.z * cos - move.x * sin;

      player.x = clamp(player.x + worldX * speed * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
      player.z = clamp(player.z + worldZ * speed * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);

      if (input.shoot) this.tryShoot(sessionId, player);
    }
  }

  private tryShoot(shooterId: string, shooter: Player, payload?: Partial<ShootPayload>): void {
    const cooldown = this.fireCooldowns.get(shooterId) ?? 0;
    if (cooldown > 0 || shooter.ammo <= 0) return;

    shooter.ammo = Math.max(0, shooter.ammo - 1);
    this.fireCooldowns.set(shooterId, FIRE_COOLDOWN);

    const fallbackX = Math.sin(shooter.rotY);
    const fallbackY = 0;
    const fallbackZ = Math.cos(shooter.rotY);
    const rawX = Number.isFinite(payload?.dirX) ? Number(payload?.dirX) : fallbackX;
    const rawY = Number.isFinite(payload?.dirY) ? Number(payload?.dirY) : fallbackY;
    const rawZ = Number.isFinite(payload?.dirZ) ? Number(payload?.dirZ) : fallbackZ;
    const len = Math.hypot(rawX, rawY, rawZ);
    const aimX = len > 0.00001 ? rawX / len : fallbackX;
    const aimY = len > 0.00001 ? rawY / len : fallbackY;
    const aimZ = len > 0.00001 ? rawZ / len : fallbackZ;
    const projectileId = `p-${++this.projectileSeq}`;
    const projectile = new Projectile(
      shooterId,
      shooter.x + aimX * 0.9,
      shooter.y + 0.5 + aimY * 0.2,
      shooter.z + aimZ * 0.9,
      aimX * PROJECTILE_SPEED,
      aimY * PROJECTILE_SPEED,
      aimZ * PROJECTILE_SPEED,
      PROJECTILE_LIFE,
      PROJECTILE_DAMAGE,
    );
    this.state.projectiles.set(projectileId, projectile);
    this.debug("projectile spawn", { shooterId, projectileId, ammo: shooter.ammo });
  }

  private logTrafficIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastTrafficLogAt < 5000) return;

    this.lastTrafficLogAt = now;
    this.debug("traffic", {
      players: this.state.players.size,
      cats: this.state.cats.size,
      inputSamples: this.inputSamples,
      poseSamples: this.poseSamples,
      projectiles: this.state.projectiles.size,
      pickups: this.state.pickups.size,
    });
    this.inputSamples = 0;
    this.poseSamples = 0;
  }

  private debug(message: string, payload?: Record<string, unknown>): void {
    if (payload) {
      // eslint-disable-next-line no-console
      console.log(`[BattleRoom:${this.roomId}] ${message}`, payload);
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[BattleRoom:${this.roomId}] ${message}`);
  }

  private seedCats(): void {
    for (let i = 0; i < SERVER_CATS; i += 1) {
      const spawnPoint = CAT_SPAWN_MAP_POINTS[i % CAT_SPAWN_MAP_POINTS.length];
      const base = this.mapToWorld(spawnPoint.x, spawnPoint.y, 0.56);
      const spawn = {
        x: clamp(base.x + randRange(-0.35, 0.35), -ARENA_HALF_SIZE + 0.8, ARENA_HALF_SIZE - 0.8),
        y: 0.56,
        z: clamp(base.z + randRange(-0.35, 0.35), -ARENA_HALF_SIZE + 0.8, ARENA_HALF_SIZE - 0.8),
      };
      const catId = `cat-${i + 1}`;
      const cat = new Cat(i === 0 ? "boss" : "normal", spawn.x, 0.56, spawn.z);
      this.state.cats.set(catId, cat);
      this.catBrains.set(catId, {
        targetId: null,
        thinkIn: randRange(0.15, 0.8),
        orbitDir: Math.random() < 0.5 ? -1 : 1,
        preferredRange: i === 0 ? randRange(6.2, 7.8) : randRange(4.4, 6.6),
        shootIn: randRange(0.45, 1.25),
        desiredYaw: Math.random() * Math.PI * 2 - Math.PI,
        stuckFor: 0,
        lastX: cat.x,
        lastZ: cat.z,
      });
    }
    this.debug("cats seeded", { cats: this.state.cats.size });
  }

  private stepCats(dt: number): void {
    const players = Array.from(this.state.players.entries())
      .filter(([, player]) => player.hp > 0)
      .map(([sessionId, player]) => ({ sessionId, player }));
    for (const [catId, cat] of this.state.cats.entries()) {
      const brain = this.catBrains.get(catId);
      if (!brain) continue;

      brain.thinkIn -= dt;
      brain.shootIn -= dt;

      const target = this.resolveCatTarget(cat.x, cat.z, brain, players);
      if (!target) {
        if (brain.thinkIn <= 0) {
          brain.desiredYaw = randRange(-Math.PI, Math.PI);
          brain.thinkIn = randRange(1.2, 2.2);
        }
        cat.rotY = rotateTowards(cat.rotY, brain.desiredYaw, CAT_TURN_SPEED * dt);
        const slowForwardX = Math.sin(cat.rotY);
        const slowForwardZ = Math.cos(cat.rotY);
        cat.x = clamp(cat.x + slowForwardX * CAT_BASE_SPEED * 0.28 * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
        cat.z = clamp(cat.z + slowForwardZ * CAT_BASE_SPEED * 0.28 * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
        brain.lastX = cat.x;
        brain.lastZ = cat.z;
        continue;
      }

      const toTargetX = target.player.x - cat.x;
      const toTargetZ = target.player.z - cat.z;
      const toTarget = normalize2D(toTargetX, toTargetZ);
      const distToTarget = Math.hypot(toTargetX, toTargetZ);

      if (brain.thinkIn <= 0) {
        if (Math.random() < 0.08) brain.orbitDir = (brain.orbitDir * -1) as 1 | -1;
        brain.preferredRange = cat.type === "boss" || cat.type === "red" ? randRange(6.1, 8.1) : randRange(4.2, 6.8);
        brain.thinkIn = randRange(1.15, 2.05);
      }

      const tangentX = -toTarget.z * brain.orbitDir;
      const tangentZ = toTarget.x * brain.orbitDir;
      let desiredVecX = tangentX * 0.95;
      let desiredVecZ = tangentZ * 0.95;
      if (distToTarget > brain.preferredRange + 1.1) {
        desiredVecX = toTarget.x * 0.95 + tangentX * 0.24;
        desiredVecZ = toTarget.z * 0.95 + tangentZ * 0.24;
      } else if (distToTarget < brain.preferredRange - 0.85) {
        desiredVecX = -toTarget.x * 0.9 + tangentX * 0.4;
        desiredVecZ = -toTarget.z * 0.9 + tangentZ * 0.4;
      } else {
        desiredVecX += toTarget.x * 0.34;
        desiredVecZ += toTarget.z * 0.34;
      }

      const separation = this.computeSeparation(catId, cat);
      desiredVecX += separation.x * 0.65;
      desiredVecZ += separation.z * 0.65;
      const desiredDir = normalize2D(desiredVecX, desiredVecZ);
      let desiredYaw = Math.atan2(desiredDir.x, desiredDir.z);
      if (separation.x !== 0 || separation.z !== 0) {
        const separationYaw = Math.atan2(separation.x, separation.z);
        desiredYaw = rotateTowards(desiredYaw, separationYaw, 0.45);
      }
      desiredYaw = this.keepInArena(cat, desiredYaw);
      brain.desiredYaw = desiredYaw;
      cat.rotY = rotateTowards(cat.rotY, desiredYaw, CAT_TURN_SPEED * dt);

      const facingDelta = Math.abs(normalizeAngle(brain.desiredYaw - cat.rotY));
      const facingScale = clamp((Math.cos(facingDelta) + 0.35) / 1.35, 0.2, 1);
      const speed = (cat.type === "boss" || cat.type === "red" ? CAT_BASE_SPEED * 0.93 : CAT_BASE_SPEED) * facingScale;
      const forwardX = Math.sin(cat.rotY);
      const forwardZ = Math.cos(cat.rotY);
      cat.x = clamp(cat.x + forwardX * speed * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
      cat.z = clamp(cat.z + forwardZ * speed * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);

      // Detect lack of progress and force a temporary breakout heading.
      const moved = Math.hypot(cat.x - brain.lastX, cat.z - brain.lastZ);
      if (speed > 1.1 && moved < 0.015) {
        brain.stuckFor += dt;
      } else {
        brain.stuckFor = Math.max(0, brain.stuckFor - dt * 0.7);
      }
      if (brain.stuckFor > 0.35) {
        const breakYaw = normalizeAngle(brain.desiredYaw + brain.orbitDir * (Math.PI * 0.55) + randRange(-0.4, 0.4));
        cat.rotY = rotateTowards(cat.rotY, breakYaw, CAT_TURN_SPEED * 1.9 * dt);
        cat.x = clamp(cat.x + Math.sin(cat.rotY) * CAT_BASE_SPEED * 0.9 * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
        cat.z = clamp(cat.z + Math.cos(cat.rotY) * CAT_BASE_SPEED * 0.9 * dt, -ARENA_HALF_SIZE, ARENA_HALF_SIZE);
        brain.stuckFor = 0;
        brain.thinkIn = randRange(0.8, 1.4);
      }
      brain.lastX = cat.x;
      brain.lastZ = cat.z;

      this.tryCatShoot(catId, cat, target.player, distToTarget, toTarget, brain);
    }
  }

  private resolveCatTarget(
    x: number,
    z: number,
    brain: CatBrain,
    players: Array<{ sessionId: string; player: Player }>,
  ): { sessionId: string; player: Player } | null {
    if (brain.targetId) {
      const sticky = players.find((entry) => entry.sessionId === brain.targetId);
      if (sticky) return sticky;
    }

    let closest: { sessionId: string; player: Player } | null = null;
    let closestDist = Number.POSITIVE_INFINITY;
    for (const entry of players) {
      const dx = entry.player.x - x;
      const dz = entry.player.z - z;
      const d = dx * dx + dz * dz;
      if (d < closestDist) {
        closestDist = d;
        closest = entry;
      }
    }
    brain.targetId = closest?.sessionId ?? null;
    return closest;
  }

  private computeSeparation(catId: string, cat: Cat): { x: number; z: number } {
    let sx = 0;
    let sz = 0;
    for (const [otherId, other] of this.state.cats.entries()) {
      if (otherId === catId || other.hp <= 0) continue;
      const dx = cat.x - other.x;
      const dz = cat.z - other.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= 0.0001) continue;
      const d = Math.sqrt(d2);
      if (d > CAT_PERSONAL_SPACE) continue;
      const push = (CAT_PERSONAL_SPACE - d) / CAT_PERSONAL_SPACE;
      sx += (dx / d) * push;
      sz += (dz / d) * push;
    }
    return normalize2D(sx, sz);
  }

  private keepInArena(cat: Cat, desiredYaw: number): number {
    const edge = ARENA_HALF_SIZE - 0.9;
    if (Math.abs(cat.x) <= edge && Math.abs(cat.z) <= edge) return desiredYaw;
    const toCenter = normalize2D(-cat.x, -cat.z);
    const centerYaw = Math.atan2(toCenter.x, toCenter.z);
    return rotateTowards(desiredYaw, centerYaw, 1.2);
  }

  private tryCatShoot(
    catId: string,
    cat: Cat,
    target: Player,
    distance: number,
    toTarget: { x: number; z: number },
    brain: CatBrain,
  ): void {
    const range = cat.type === "boss" || cat.type === "red" ? CAT_FIRE_RANGE_BOSS : CAT_FIRE_RANGE_NORMAL;
    if (brain.shootIn > 0 || distance > range) return;

    const facingX = Math.sin(cat.rotY);
    const facingZ = Math.cos(cat.rotY);
    const frontness = facingX * toTarget.x + facingZ * toTarget.z;
    if (frontness < 0.35) return;

    const spread = cat.type === "boss" || cat.type === "red" ? 0.02 : 0.045;
    const aimX = toTarget.x + randRange(-spread, spread);
    const aimZ = toTarget.z + randRange(-spread, spread);
    const aim = normalize2D(aimX, aimZ);
    const damage = cat.type === "boss" || cat.type === "red" ? CAT_PROJECTILE_DAMAGE_BOSS : CAT_PROJECTILE_DAMAGE_NORMAL;

    const projectileId = `p-${++this.projectileSeq}`;
    const projectile = new Projectile(
      `cat:${catId}`,
      cat.x + aim.x * 0.75,
      cat.y + (cat.type === "boss" || cat.type === "red" ? 0.64 : 0.56),
      cat.z + aim.z * 0.75,
      aim.x * CAT_PROJECTILE_SPEED,
      0,
      aim.z * CAT_PROJECTILE_SPEED,
      CAT_PROJECTILE_LIFE,
      damage,
    );
    this.state.projectiles.set(projectileId, projectile);
    brain.shootIn = cat.type === "boss" || cat.type === "red" ? randRange(0.95, 1.35) : randRange(1.35, 2.1);
  }

  private stepProjectiles(dt: number): void {
    const toRemove: string[] = [];

    for (const [projectileId, projectile] of this.state.projectiles.entries()) {
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.z += projectile.vz * dt;

      if (
        projectile.life <= 0 ||
        Math.abs(projectile.x) > ARENA_HALF_SIZE + 2 ||
        Math.abs(projectile.z) > ARENA_HALF_SIZE + 2
      ) {
        toRemove.push(projectileId);
        continue;
      }

      const hitPlayer = this.tryHitPlayer(projectile);
      if (hitPlayer) {
        toRemove.push(projectileId);
        continue;
      }

      const hitCat = this.tryHitCat(projectile);
      if (hitCat) {
        toRemove.push(projectileId);
      }
    }

    for (const projectileId of toRemove) {
      this.state.projectiles.delete(projectileId);
    }
  }

  private tryHitPlayer(projectile: Projectile): boolean {
    for (const [sessionId, player] of this.state.players.entries()) {
      if (sessionId === projectile.ownerId || player.hp <= 0) continue;
      const dx = player.x - projectile.x;
      const dz = player.z - projectile.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > PROJECTILE_RADIUS * PROJECTILE_RADIUS) continue;

      player.hp = Math.max(0, player.hp - projectile.damage);
      this.debug("projectile hit player", {
        owner: projectile.ownerId,
        target: sessionId,
        hp: player.hp,
      });
      if (player.hp <= 0 && !this.respawnAt.has(sessionId)) {
        this.scheduleRespawn(sessionId, player);
      }
      return true;
    }
    return false;
  }

  private tryHitCat(projectile: Projectile): boolean {
    if (projectile.ownerId.startsWith("cat:")) return false;
    for (const [catId, cat] of this.state.cats.entries()) {
      if (cat.hp <= 0) continue;
      const dx = cat.x - projectile.x;
      const dz = cat.z - projectile.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > PROJECTILE_RADIUS * PROJECTILE_RADIUS) continue;

      cat.hp = Math.max(0, cat.hp - projectile.damage);
      if (cat.hp <= 0) {
        this.state.cats.delete(catId);
        this.catBrains.delete(catId);
        this.removeProjectilesByOwner(`cat:${catId}`);
        this.checkPortalUnlock();
      }
      this.debug("projectile hit cat", {
        owner: projectile.ownerId,
        catId,
        hp: cat.hp,
      });
      return true;
    }
    return false;
  }

  private removeProjectilesByOwner(ownerId: string): void {
    for (const [projectileId, projectile] of this.state.projectiles.entries()) {
      if (projectile.ownerId === ownerId) {
        this.state.projectiles.delete(projectileId);
      }
    }
  }

  private stepRespawn(sessionId: string, player: Player): void {
    if (!this.respawnAt.has(sessionId)) {
      this.scheduleRespawn(sessionId, player);
    }

    const at = this.respawnAt.get(sessionId);
    if (!at) return;
    const remaining = (at - Date.now()) / 1000;
    if (remaining > 0) {
      player.respawnIn = remaining;
      return;
    }

    const spawn = this.getRespawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.hp = 100;
    player.ammo = 90;
    player.respawnIn = 0;
    this.respawnAt.delete(sessionId);
    this.debug("respawn", { sessionId });
  }

  private scheduleRespawn(sessionId: string, player: Player): void {
    this.respawnAt.set(sessionId, Date.now() + RESPAWN_DELAY_SECONDS * 1000);
    player.respawnIn = RESPAWN_DELAY_SECONDS;
    this.debug("downed", { sessionId, respawnIn: RESPAWN_DELAY_SECONDS });
  }

  private resetLevelContent(): void {
    this.state.level = this.roomLevel;
    this.state.portalActive = false;
    this.state.cats.clear();
    this.catBrains.clear();
    this.state.projectiles.clear();
    this.state.pickups.clear();

    if (this.botsEnabled) this.seedCats();
    this.seedPickups();
    this.checkPortalUnlock();
  }

  private checkPortalUnlock(): void {
    if (!this.botsEnabled) {
      this.state.portalActive = true;
      return;
    }
    if (this.state.cats.size > 0) return;
    if (this.state.portalActive) return;
    this.state.portalActive = true;
    this.debug("portal opened", { level: this.roomLevel });
  }

  private tryAdvanceLevel(triggerSessionId: string, player: Player): void {
    if (!this.state.portalActive) return;
    if (!this.playerWithinPortal(player)) return;
    if (this.roomLevel >= LEVEL_RESPAWN_MAP_POINTS.length - 1) return;

    this.roomLevel += 1;
    this.setMetadata({ lobby: this.lobbyName, level: this.roomLevel });

    const spawn = this.getRespawnPoint();
    for (const [sessionId, roomPlayer] of this.state.players.entries()) {
      roomPlayer.x = spawn.x;
      roomPlayer.y = spawn.y;
      roomPlayer.z = spawn.z;
      roomPlayer.respawnIn = 0;
      if (roomPlayer.hp <= 0) {
        roomPlayer.hp = 100;
        roomPlayer.ammo = Math.max(roomPlayer.ammo, 90);
      }
      this.respawnAt.delete(sessionId);
    }

    this.resetLevelContent();
    this.debug("level advanced", {
      triggerSessionId,
      level: this.roomLevel,
      players: this.state.players.size,
    });
  }

  private playerWithinPortal(player: Player): boolean {
    const portal = this.getPortalPoint();
    const dx = player.x - portal.x;
    const dz = player.z - portal.z;
    return dx * dx + dz * dz <= PORTAL_ACTIVATE_RADIUS * PORTAL_ACTIVATE_RADIUS;
  }

  private getPortalPoint(): { x: number; y: number; z: number } {
    const mapPoint = LEVEL_PORTAL_MAP_POINTS[this.roomLevel] ?? LEVEL_PORTAL_MAP_POINTS[0];
    return this.mapToWorld(mapPoint.x, mapPoint.y, 1.5);
  }

  private getRespawnPoint(): { x: number; y: number; z: number } {
    const mapPoint = LEVEL_RESPAWN_MAP_POINTS[this.roomLevel] ?? LEVEL_RESPAWN_MAP_POINTS[0];
    return {
      x: (mapPoint.x - MAP_W / 2) * TILE_SIZE,
      y: 1,
      z: (mapPoint.y - MAP_H / 2) * TILE_SIZE,
    };
  }

  private seedPickups(): void {
    const healthCount = Math.max(2, 3 + Math.floor(this.roomLevel / 2) + (this.roomLevel === 3 ? 2 : 0));
    const ammoCount = 4;

    for (let i = 0; i < healthCount; i += 1) {
      const point = PICKUP_MAP_POINTS[(i + this.roomLevel) % PICKUP_MAP_POINTS.length];
      const world = this.mapToWorld(point.x, point.y, 0.4);
      this.state.pickups.set(`pickup-${++this.pickupSeq}`, new Pickup("health", world.x, world.y, world.z, 22));
    }

    for (let i = 0; i < ammoCount; i += 1) {
      const point = PICKUP_MAP_POINTS[(i + this.roomLevel * 2 + 3) % PICKUP_MAP_POINTS.length];
      const world = this.mapToWorld(point.x, point.y, 0.4);
      this.state.pickups.set(`pickup-${++this.pickupSeq}`, new Pickup("ammo", world.x, world.y, world.z, 10));
    }

    this.debug("pickups seeded", { pickups: this.state.pickups.size });
  }

  private stepPickups(): void {
    for (const [pickupId, pickup] of this.state.pickups.entries()) {
      for (const player of this.state.players.values()) {
        if (player.hp <= 0) continue;
        const dx = player.x - pickup.x;
        const dz = player.z - pickup.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > PICKUP_RADIUS * PICKUP_RADIUS) continue;

        const consumed = this.applyPickup(player, pickup);
        if (consumed) {
          this.state.pickups.delete(pickupId);
          this.debug("pickup collected", {
            pickupId,
            kind: pickup.kind,
            amount: pickup.amount,
            player: player.name,
          });
        }
        break;
      }
    }
  }

  private applyPickup(player: Player, pickup: Pickup): boolean {
    if (pickup.kind === "health") {
      if (player.hp >= 100) return false;
      player.hp = Math.min(100, player.hp + pickup.amount);
      return true;
    }

    if (pickup.kind === "ammo") {
      if (player.ammo >= MAX_PLAYER_AMMO) return false;
      player.ammo = Math.min(MAX_PLAYER_AMMO, player.ammo + pickup.amount);
      return true;
    }

    return false;
  }

  private mapToWorld(mx: number, my: number, y = 0): { x: number; y: number; z: number } {
    return {
      x: (mx - MAP_W / 2) * TILE_SIZE,
      y,
      z: (my - MAP_H / 2) * TILE_SIZE,
    };
  }
}

function clampLevelIndex(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(LEVEL_RESPAWN_MAP_POINTS.length - 1, Math.floor(parsed)));
}
