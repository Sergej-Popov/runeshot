# Runeshot

Multiplayer 3D arena game — BabylonJS client + Colyseus server.

npm workspaces monorepo with two packages: `client/` and `server/`.
See also: [`client/AGENT.md`](client/AGENT.md) and [`server/AGENT.md`](server/AGENT.md).

## Quick commands

| Action | Command |
|---|---|
| Dev (both) | `npm run dev` |
| Dev client only | `npm run dev:client` |
| Dev server only | `npm run dev:server` |
| Build all | `npm run build` |
| Typecheck all | `npm run typecheck` |
| Test all | `npm run test` |

## Repo layout

```
runeshot/
  client/          # BabylonJS + Vite game client
  server/          # Colyseus game server (Express + WS)
  docker/          # Docker support files
  generated/       # Asset pipeline output (spell atlas)
  images/          # Static images
  Dockerfile.client
  Dockerfile.server
  docker-compose.yml
  deploy.sh        # LAN deploy via SMB + SSH
```

## Key facts

- **No root tsconfig** — each workspace has its own.
- **No linter/formatter** configured.
- **No CI/CD** — deployment is manual LAN push (`deploy.sh`).
- **No shared source packages** — client and server are independent. They share the Colyseus protocol implicitly via `@colyseus/schema`.
- Client uses **lenient TypeScript** (`strict: false`, `noImplicitAny: false`). Server uses **strict mode**.
- Both workspaces use **Vitest** for testing.

## Protocol (client <-> server)

Client messages to server: `"input"`, `"pose"`, `"shoot"`, `"enterPortal"`, `"usePotion"`.
State syncs back via Colyseus schema delta encoding. See `server/src/state/BattleState.ts` for the schema and `client/src/multiplayer/legacySync.ts` for the client-side bridge.
