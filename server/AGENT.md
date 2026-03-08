# Server — Colyseus Game Server

Authoritative game server using Colyseus on Express + WebSocket transport.

## Quick commands

| Action | Command | Working dir |
|---|---|---|
| Dev (watch) | `npm run dev` | `server/` |
| Typecheck | `npx tsc --noEmit` | `server/` |
| Run tests | `npx vitest run --pool=threads` | `server/` |
| Build | `npm run build` | `server/` |

Dev uses `tsx watch` for hot reload.

## TypeScript config

**Strict mode**: `strict: true`, target ES2022, module `NodeNext`.
`experimentalDecorators: true` and `useDefineForClassFields: false` — required by `@colyseus/schema` decorators.
Test files (`*.test.ts`) are excluded from the build.

## Architecture

```
src/
  index.ts                  # Entry point (26 lines) — Express + Colyseus setup
  state/
    BattleState.ts          # Colyseus schema classes (180 lines)
  rooms/
    BattleRoom.ts           # All game logic (1079 lines)
    BattleRoom.test.ts      # Integration tests (489 lines, 7 tests)
```

### Entry point (`index.ts`)

Creates Express app with `/health` endpoint, attaches Colyseus `Server` with `WebSocketTransport`, defines `"battle"` room filtered by `lobby`. Default port: 2567.

### Schema (`state/BattleState.ts`)

Colyseus `@type` decorated schema classes — state is delta-synced to clients automatically.

| Class | Purpose |
|---|---|
| `BattleState` | Root state: `level`, `portalActive`, + MapSchema collections below |
| `Player` | Position, HP, mana, potion inventory (5 kinds), status effects (poisoned/speedBoosted/frozen) |
| `Cat` | Enemy entity: type, position, HP. Types: normal, red, boss |
| `Projectile` | Owner, position, velocity, life, damage |
| `Pickup` | Kind (health/mana/potion types), position, amount |
| `PoisonCloud` | Position, remaining life |

### Game logic (`rooms/BattleRoom.ts`)

Single monolithic file containing all server-side game logic. Key areas:

- **Lifecycle**: `onCreate`, `onJoin`, `onLeave` — room setup, player spawn/despawn
- **Message handlers**: `input` (movement), `pose` (camera sync), `shoot` (fire projectile), `enterPortal` (level transition), `usePotion` (potion effects)
- **Simulation loop** (60Hz via `setSimulationInterval`): player movement, cat AI, projectile physics, collision detection, pickup collection, poison cloud ticking, portal activation
- **Level progression**: Multi-level with increasing difficulty, portal-based advancement
- **Cat AI**: Pathfinding toward players, firing projectiles, boss/red/normal variants
- **Potion system**: 5 potion kinds — health (instant heal), mana (instant restore), poison (AoE cloud), speed (60s boost), freeze (AoE slow)

### Client messages (inbound)

| Message | Fields | Purpose |
|---|---|---|
| `"input"` | `forward`, `back`, `left`, `right`, `sprint` | Movement input |
| `"pose"` | `rotY` | Camera rotation sync |
| `"shoot"` | `dx`, `dy`, `dz` | Fire projectile in direction |
| `"enterPortal"` | — | Request level transition |
| `"usePotion"` | `kind` | Use a potion |

## Testing

- **Framework**: Vitest with `--pool=threads`.
- **7 integration tests** in `BattleRoom.test.ts`.
- Tests spin up a real Colyseus server + WebSocket clients — no mocking.
- Tests cover: player join, movement, shooting, cat spawning, portal flow, potion usage.

## Dependencies

- `colyseus` + `@colyseus/schema` + `@colyseus/ws-transport` — multiplayer framework
- `express` — HTTP server
- `tsx` (dev) — TypeScript execution with watch mode
