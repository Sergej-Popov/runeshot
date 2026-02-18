import { canvas } from "../dom";
import { initAudio } from "../audio";
import { InputController } from "./input/InputController";
import { NetworkSession } from "./net/NetworkSession";
import { ArenaScene } from "./scene/ArenaScene";
import { HudController } from "./ui/HudController";
import type { RemotePlayerState } from "./types";

export class MultiplayerGame {
  private readonly scene = new ArenaScene(canvas);
  private readonly input = new InputController(canvas);
  private readonly session = new NetworkSession();
  private readonly hud = new HudController();

  private readonly players = new Map<string, RemotePlayerState>();
  private connectionStatus = "Connecting";

  async start(): Promise<void> {
    initAudio();

    this.scene.start((dt) => {
      const input = this.input.consumeSnapshot();
      this.scene.applyLocalInput(input, dt);
      this.session.sendInput(input);

      const self = this.players.get(this.session.sessionId);
      this.hud.update({
        health: Math.floor(self?.hp ?? 100),
        ammo: Math.floor(self?.ammo ?? 0),
        playersOnline: this.players.size,
        status: this.connectionStatus,
      });
    });

    try {
      await this.session.connect({
        onPlayerUpsert: (player) => {
          this.players.set(player.sessionId, player);
          this.scene.upsertPlayer(player, this.session.sessionId);
          this.connectionStatus = "Connected";
        },
        onPlayerRemove: (sessionId) => {
          this.players.delete(sessionId);
          this.scene.removePlayer(sessionId);
        },
        onDisconnect: (reason) => {
          this.connectionStatus = reason;
        },
      });
      this.connectionStatus = "Connected";
    } catch (error) {
      this.connectionStatus = "Server unreachable on :2567";
      throw error;
    }
  }
}
