import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BattleRoom } from "./rooms/BattleRoom.js";

const port = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  // eslint-disable-next-line no-console
  console.log("[server] /health");
  res.json({ ok: true });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("battle", BattleRoom).filterBy(["lobby"]);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Colyseus listening on ws://localhost:${port}`);
});
