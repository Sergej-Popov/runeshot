import http from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "colyseus.js";
import { BattleRoom } from "./BattleRoom.js";

type SchemaPlayer = {
  name: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  ammo: number;
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

type SchemaPickup = {
  kind: string;
  x: number;
  y: number;
  z: number;
  amount: number;
};

type TestRoomState = {
  players: Map<string, SchemaPlayer>;
  cats: Map<string, SchemaCat>;
  projectiles: Map<string, { ownerId: string; x: number; y: number; z: number }>;
  pickups: Map<string, SchemaPickup>;
  level: number;
  portalActive: boolean;
};

const TILE_SIZE = 2;
const MAP_HALF = 8;

function mapToWorld(x: number, y: number): { x: number; z: number } {
  return {
    x: (x - MAP_HALF) * TILE_SIZE,
    z: (y - MAP_HALF) * TILE_SIZE,
  };
}

function getPlayers(room: { state?: { players?: Map<string, SchemaPlayer> } }): Map<string, SchemaPlayer> | null {
  return room.state?.players ?? null;
}

function getCats(room: { state?: { cats?: Map<string, SchemaCat> } }): Map<string, SchemaCat> | null {
  return room.state?.cats ?? null;
}

function getProjectiles(
  room: { state?: { projectiles?: Map<string, { ownerId: string; x: number; y: number; z: number }> } },
): Map<string, { ownerId: string; x: number; y: number; z: number }> | null {
  return room.state?.projectiles ?? null;
}

function getPickups(room: { state?: { pickups?: Map<string, SchemaPickup> } }): Map<string, SchemaPickup> | null {
  return room.state?.pickups ?? null;
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
  pollMs = 20,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for condition after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, pollMs);
    });
  }
}

describe("BattleRoom", () => {
  let httpServer: http.Server;
  let gameServer: Server;
  let wsUrl: string;

  beforeEach(async () => {
    const app = express();
    httpServer = http.createServer(app);
    gameServer = new Server({
      transport: new WebSocketTransport({ server: httpServer }),
    });
    gameServer.define("battle", BattleRoom);

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
      httpServer.once("error", reject);
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server address");
    }
    wsUrl = `ws://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    try {
      await gameServer.gracefullyShutdown(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Server is not running")) throw error;
    }
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          if (error.message.includes("Server is not running")) {
            resolve();
            return;
          }
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("adds a player to state when a client joins", async () => {
    const client = new Client(wsUrl);
    const room = await client.joinOrCreate<TestRoomState>("battle", {
      name: "Tester",
      lobby: "test-lobby",
      bots: false,
    });

    await waitFor(() => {
      const players = getPlayers(room);
      if (!players) return false;
      const player = players.get(room.sessionId);
      return Boolean(player);
    });

    const self = getPlayers(room)?.get(room.sessionId);
    expect(self).toBeTruthy();
    expect(self?.name).toBe("Tester");
    expect(self?.hp).toBe(100);
    expect(self?.ammo).toBe(90);

    await room.leave();
  });

  it("publishes server-authoritative cats and updates their positions", async () => {
    const client = new Client(wsUrl);
    const room = await client.joinOrCreate<TestRoomState>("battle", {
      name: "CatObserver",
      lobby: "cats",
    });

    await waitFor(() => {
      const cats = getCats(room);
      return Boolean(cats && cats.size > 0);
    });
    const snapshotCats = Array.from(getCats(room)?.values() ?? []);
    const boss = snapshotCats.find((cat) => cat.type === "boss");
    const normal = snapshotCats.find((cat) => cat.type !== "boss");
    expect(boss?.hp).toBe(20);
    expect(normal?.hp).toBe(10);

    const cats = getCats(room);
    const firstId = cats?.keys().next().value as string | undefined;
    if (!firstId) throw new Error("Missing cat id");

    const before = getCats(room)?.get(firstId);
    if (!before) throw new Error("Missing initial cat state");
    const beforeX = before.x;
    const beforeZ = before.z;

    await waitFor(() => {
      const cat = getCats(room)?.get(firstId);
      if (!cat) return false;
      return Math.abs(cat.x - beforeX) > 0.02 || Math.abs(cat.z - beforeZ) > 0.02;
    }, 4000);

    await room.leave();
  });

  it("applies movement input and pose clamps", async () => {
    const client = new Client(wsUrl);
    const room = await client.joinOrCreate<TestRoomState>("battle", {
      name: "Mover",
      lobby: "movement-tests",
      bots: false,
    });

    await waitFor(() => Boolean(getPlayers(room)?.get(room.sessionId)));
    const initial = getPlayers(room)?.get(room.sessionId);
    if (!initial) throw new Error("Missing initial player state");
    const initialX = initial.x;
    const initialZ = initial.z;

    room.send("input", {
      forward: 1,
      strafe: 0,
      turn: 0,
      sprint: false,
      shoot: false,
    });

    await waitFor(() => {
      const current = getPlayers(room)?.get(room.sessionId);
      if (!current) return false;
      return Math.abs(current.x - initialX) > 0.05 || Math.abs(current.z - initialZ) > 0.05;
    });

    room.send("pose", { x: 999, y: 99, z: -999, hp: 250, ammo: 2000 });
    await waitFor(() => {
      const current = getPlayers(room)?.get(room.sessionId);
      if (!current) return false;
      return current.x <= 15 && current.y <= 8 && current.z >= -15 && current.hp <= 100 && current.ammo <= 999;
    });

    const clamped = getPlayers(room)?.get(room.sessionId);
    expect(clamped?.x).toBeLessThanOrEqual(15);
    expect(clamped?.y).toBeLessThanOrEqual(8);
    expect(clamped?.z).toBeGreaterThanOrEqual(-15);
    expect(clamped?.hp).toBeLessThanOrEqual(100);
    expect(clamped?.ammo).toBeLessThanOrEqual(999);

    await room.leave();
  });

  it("spawns and moves projectiles on shoot", async () => {
    const client = new Client(wsUrl);
    const room = await client.joinOrCreate<TestRoomState>("battle", {
      name: "Shooter",
      lobby: "projectiles",
      bots: false,
    });

    await waitFor(() => Boolean(getPlayers(room)?.get(room.sessionId)));
    room.send("shoot", { dirX: 0, dirY: 1, dirZ: 0 });

    await waitFor(() => {
      const projectiles = getProjectiles(room);
      return Boolean(projectiles && projectiles.size > 0);
    });

    const projectiles = getProjectiles(room);
    const projectileId = projectiles?.keys().next().value as string | undefined;
    if (!projectileId) throw new Error("Missing projectile id");
    const before = getProjectiles(room)?.get(projectileId);
    if (!before) throw new Error("Missing projectile state");
    const beforeX = before.x;
    const beforeY = (before as { y?: number }).y ?? 0;
    const beforeZ = before.z;

    await waitFor(() => {
      const current = getProjectiles(room)?.get(projectileId);
      if (!current) return false;
      const y = (current as { y?: number }).y ?? 0;
      return Math.abs(current.x - beforeX) > 0.01 || Math.abs(y - beforeY) > 0.01 || Math.abs(current.z - beforeZ) > 0.01;
    }, 3000);

    await room.leave();
  });

  it("damages another player by 10 hp per projectile", async () => {
    const clientA = new Client(wsUrl);
    const shooterRoom = await clientA.joinOrCreate<TestRoomState>("battle", {
      name: "ShooterA",
      lobby: "pvp-damage",
      bots: false,
    });

    const clientB = new Client(wsUrl);
    const targetRoom = await clientB.joinOrCreate<TestRoomState>("battle", {
      name: "TargetB",
      lobby: "pvp-damage",
      bots: false,
    });

    await waitFor(() => {
      const players = getPlayers(shooterRoom);
      return Boolean(players && players.size >= 2);
    });

    const shooter = getPlayers(shooterRoom)?.get(shooterRoom.sessionId);
    const target = getPlayers(shooterRoom)?.get(targetRoom.sessionId);
    if (!shooter || !target) throw new Error("Missing shooter/target state");

    // Put target in front of shooter to guarantee an immediate hit in test.
    shooterRoom.send("pose", { x: 0, y: 1, z: 0, rotY: 0 });
    targetRoom.send("pose", { x: 0, y: 1, z: 1.2, rotY: 0 });

    await waitFor(() => {
      const s = getPlayers(shooterRoom)?.get(shooterRoom.sessionId);
      const t = getPlayers(shooterRoom)?.get(targetRoom.sessionId);
      if (!s || !t) return false;
      return Math.abs(s.x) < 0.05 && Math.abs(s.z) < 0.05 && Math.abs(t.x) < 0.05 && Math.abs(t.z - 1.2) < 0.05;
    });

    const beforeHp = getPlayers(shooterRoom)?.get(targetRoom.sessionId)?.hp;
    if (beforeHp === undefined) throw new Error("Missing target hp");

    shooterRoom.send("shoot", { dirX: 0, dirY: 0, dirZ: 1 });

    await waitFor(() => {
      const hp = getPlayers(shooterRoom)?.get(targetRoom.sessionId)?.hp;
      if (hp === undefined) return false;
      return hp === beforeHp - 10;
    }, 3000);

    await shooterRoom.leave();
    await targetRoom.leave();
  });

  it("respawns a downed player after 5 seconds", async () => {
    const clientA = new Client(wsUrl);
    const shooterRoom = await clientA.joinOrCreate<TestRoomState>("battle", {
      name: "ShooterA",
      lobby: "respawn-test",
      bots: false,
    });

    const clientB = new Client(wsUrl);
    const targetRoom = await clientB.joinOrCreate<TestRoomState>("battle", {
      name: "TargetB",
      lobby: "respawn-test",
      bots: false,
    });

    await waitFor(() => {
      const players = getPlayers(shooterRoom);
      return Boolean(players && players.size >= 2);
    });

    shooterRoom.send("pose", { x: 0, y: 1, z: 0, rotY: 0 });
    targetRoom.send("pose", { x: 0, y: 1, z: 1.2, rotY: 0 });

    await waitFor(() => {
      const t = getPlayers(shooterRoom)?.get(targetRoom.sessionId);
      return Boolean(t && Math.abs(t.z - 1.2) < 0.05);
    });

    for (let i = 0; i < 10; i += 1) {
      shooterRoom.send("shoot", { dirX: 0, dirY: 0, dirZ: 1 });
      await new Promise((resolve) => {
        setTimeout(resolve, 260);
      });
    }

    await waitFor(() => {
      const t = getPlayers(shooterRoom)?.get(targetRoom.sessionId);
      return Boolean(t && t.hp === 0 && t.respawnIn > 0);
    }, 6000);

    await waitFor(() => {
      const t = getPlayers(shooterRoom)?.get(targetRoom.sessionId);
      return Boolean(t && t.hp === 100 && t.respawnIn <= 0);
    }, 9000);

    await shooterRoom.leave();
    await targetRoom.leave();
  }, 15000);

  it("collects server-authoritative ammo pickup", async () => {
    const client = new Client(wsUrl);
    const room = await client.joinOrCreate<TestRoomState>("battle", {
      name: "LootTester",
      lobby: "pickup-test",
      bots: false,
    });

    await waitFor(() => Boolean(getPlayers(room)?.get(room.sessionId)));
    await waitFor(() => {
      const pickups = getPickups(room);
      return Boolean(pickups && pickups.size > 0);
    });

    const ammoPickupEntry = Array.from(getPickups(room)?.entries() ?? []).find(([, p]) => p.kind === "ammo");
    if (!ammoPickupEntry) throw new Error("Missing ammo pickup in room state");
    const [pickupId, pickup] = ammoPickupEntry;

    room.send("shoot", { dirX: 0, dirY: 1, dirZ: 0 });
    await waitFor(() => {
      const self = getPlayers(room)?.get(room.sessionId);
      return Boolean(self && self.ammo === 89);
    });

    room.send("pose", { x: pickup.x, y: pickup.y, z: pickup.z, rotY: 0 });

    await waitFor(() => {
      const self = getPlayers(room)?.get(room.sessionId);
      const pickups = getPickups(room);
      if (!self || !pickups) return false;
      return self.ammo > 89 && !pickups.has(pickupId);
    }, 4000);

    await room.leave();
  });

  it("cats shoot server projectiles and damage players", async () => {
    const client = new Client(wsUrl);
    const room = await client.joinOrCreate<TestRoomState>("battle", {
      name: "BotTarget",
      lobby: "bot-shooting",
      bots: true,
    });

    await waitFor(() => Boolean(getPlayers(room)?.get(room.sessionId)));
    await waitFor(() => Boolean(getCats(room) && getCats(room)!.size > 0));

    // Place player near a known cat spawn edge so AI engages quickly.
    room.send("pose", { x: -10.8, y: 1, z: -10.8, rotY: 0 });
    await waitFor(() => {
      const self = getPlayers(room)?.get(room.sessionId);
      return Boolean(self && Math.abs(self.x + 10.8) < 0.2 && Math.abs(self.z + 10.8) < 0.2);
    });

    await waitFor(() => {
      const anyCatProjectile = Array.from(getProjectiles(room)?.values() ?? []).some((p) => p.ownerId.startsWith("cat:"));
      return anyCatProjectile;
    }, 8000);

    const initialHp = getPlayers(room)?.get(room.sessionId)?.hp ?? 100;
    await waitFor(() => {
      const hp = getPlayers(room)?.get(room.sessionId)?.hp;
      if (hp === undefined) return false;
      return hp < initialHp;
    }, 9000);

    await room.leave();
  }, 15000);

  it("moves all players to the next level when one enters an open portal", async () => {
    const clientA = new Client(wsUrl);
    const roomA = await clientA.joinOrCreate<TestRoomState>("battle", {
      name: "PortalRunner",
      lobby: "level-sync",
      bots: false,
      level: 0,
    });

    const clientB = new Client(wsUrl);
    const roomB = await clientB.joinOrCreate<TestRoomState>("battle", {
      name: "Teammate",
      lobby: "level-sync",
      bots: false,
      level: 0,
    });

    await waitFor(() => {
      const players = getPlayers(roomA);
      return Boolean(players && players.size >= 2);
    });
    await waitFor(() => roomA.state?.portalActive === true);

    const level0Portal = mapToWorld(13.5, 13.5);
    roomA.send("pose", { x: level0Portal.x, y: 1, z: level0Portal.z, rotY: 0 });
    roomA.send("enterPortal", {});

    await waitFor(() => roomA.state?.level === 1, 5000);
    await waitFor(() => roomB.state?.level === 1, 5000);

    const level1Spawn = mapToWorld(2.2, 13.2);
    await waitFor(() => {
      const pA = getPlayers(roomA)?.get(roomA.sessionId);
      const pB = getPlayers(roomA)?.get(roomB.sessionId);
      if (!pA || !pB) return false;
      return (
        Math.hypot(pA.x - level1Spawn.x, pA.z - level1Spawn.z) < 0.25 &&
        Math.hypot(pB.x - level1Spawn.x, pB.z - level1Spawn.z) < 0.25
      );
    }, 6000);

    await roomA.leave();
    await roomB.leave();
  }, 15000);
});
