import { Client, Room } from "colyseus.js";
import type { InputSnapshot, RemotePlayerState } from "../types";
import { getServerUrl } from "./serverConfig";

type SchemaPlayer = {
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  mana: number;
};

type PlayerMapSchema = {
  forEach: (cb: (player: SchemaPlayer, key: string) => void) => void;
};

type BattleStateSchema = {
  players: PlayerMapSchema;
};

export type SessionHandlers = {
  onPlayerUpsert: (player: RemotePlayerState) => void;
  onPlayerRemove: (sessionId: string) => void;
  onDisconnect?: (reason: string) => void;
};

function getLobbyName(): string {
  const qs = new URLSearchParams(window.location.search);
  const room = qs.get("room")?.trim();
  if (room) return room.slice(0, 40);
  return "main";
}

function asRemotePlayerState(sessionId: string, player: SchemaPlayer): RemotePlayerState {
  return {
    sessionId,
    name: player.name,
    x: player.x,
    y: player.y,
    z: player.z,
    rotY: player.rotY,
    hp: player.hp,
    mana: player.mana,
  };
}

export class NetworkSession {
  private room: Room<BattleStateSchema> | null = null;
  private clientSessionId = "";
  private knownPlayerIds = new Set<string>();

  get sessionId(): string {
    return this.clientSessionId;
  }

  async connect(handlers: SessionHandlers): Promise<void> {
    const client = new Client(getServerUrl());
    const lobby = getLobbyName();
    this.debug("Connecting", { url: getServerUrl(), lobby });
    this.room = await client.joinOrCreate<BattleStateSchema>("battle", {
      name: `Pilot-${Math.floor(Math.random() * 10000)}`,
      lobby,
    });
    this.clientSessionId = this.room.sessionId;
    this.knownPlayerIds.clear();
    this.debug("Connected", { sessionId: this.clientSessionId, roomId: this.room.roomId });

    this.room.onLeave((code) => {
      this.knownPlayerIds.clear();
      this.debug("Disconnected", { code });
      handlers.onDisconnect?.(`Disconnected (code: ${code})`);
    });

    this.room.onError((code, message) => {
      this.knownPlayerIds.clear();
      this.debug("Connection error", { code, message });
      handlers.onDisconnect?.(`Connection error ${code}: ${message}`);
    });

    this.room.onStateChange(() => {
      this.syncPlayersFromState(handlers);
    });

    this.syncPlayersFromState(handlers);
  }

  sendInput(input: InputSnapshot): void {
    this.room?.send("input", input);
  }

  private syncPlayersFromState(handlers: SessionHandlers): void {
    if (!this.room) return;
    const players = (this.room as { state?: { players?: PlayerMapSchema } }).state?.players;
    if (!players || typeof players.forEach !== "function") {
      this.debug("State not ready yet; waiting for players map");
      return;
    }

    const seen = new Set<string>();

    players.forEach((player, sessionId) => {
      seen.add(sessionId);
      handlers.onPlayerUpsert(asRemotePlayerState(sessionId, player));
    });

    // Remove stale players that are no longer present in room state.
    // The active game path keeps player cache outside this class, so we
    // infer removals by comparing known session ids from last snapshot.
    for (const sessionId of this.knownPlayerIds) {
      if (!seen.has(sessionId)) {
        handlers.onPlayerRemove(sessionId);
      }
    }
    this.knownPlayerIds = seen;
  }

  private debug(message: string, payload?: Record<string, unknown>): void {
    if (payload) {
      console.debug("[NetworkSession]", message, payload);
      return;
    }
    console.debug("[NetworkSession]", message);
  }
}
