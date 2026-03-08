# Client — BabylonJS Game Client

Vite-bundled BabylonJS 3D game client with Colyseus multiplayer.

## Quick commands

| Action | Command | Working dir |
|---|---|---|
| Dev server | `npm run dev` | `client/` |
| Typecheck | `npx tsc --noEmit` | `client/` |
| Run tests | `npx vitest run` | `client/` |
| Watch tests | `npx vitest` | `client/` |
| Build | `npm run build` | `client/` |

## TypeScript config

**Lenient**: `strict: false`, `noImplicitAny: false`, target ES2020, module resolution `Bundler`.

## Architecture

Entry point is `src/main.ts` (896 lines). It declares ~75 module-level variables that hold all game state and passes them to extracted modules via a **GameContext accessor object** (`ctx`).

### GameContext pattern

- Type defined in `game/runtime/gameContext.ts`.
- The `ctx` object in main.ts uses `get`/`set` accessors to bridge to the bare module-level variables.
- Extracted modules receive `ctx: GameContext` and read/write state through it.
- Cross-domain callbacks (e.g. `ctx.damagePlayer`, `ctx.updateHud`) are function fields assigned after the ctx declaration, most inlined to call modules directly.
- Map query helpers (`ctx.isWallAt`, `ctx.floorHeightAtMap`, `ctx.canOccupyMap`) wrap local functions in main.ts.

### Module layout

```
src/
  main.ts               # Entry: variables, ctx, game loop, init()
  dom.ts                 # DOM element references
  audio.ts               # Sound loading & playback
  audio/                 # Audio assets
  models/                # 3D model assets
  app/
    loop.ts              # Game loop utility (+ test)
  game/
    input.ts             # Input binding setup
    state.ts             # Shared game state helpers (+ test)
    featureFlags.ts      # Feature flag checks
    pickupVisuals.ts     # Pickup item rendering
    potionSprites.ts     # Potion sprite rendering
    runtime/             # Pure logic, NO Babylon dependency — all tested
      gameContext.ts      # GameContext type definition
      constants.ts        # Game constants (radii, speeds, etc.)
      types.ts            # Shared type definitions
      spatial.ts          # Spatial math utilities (+ test)
      runes.ts            # Rune effect calculations (+ test)
      enemyStats.ts       # Enemy stat tables & scaling (+ test)
      combat.ts           # Damage formulas, knockback, DoT (+ test)
      cheats.ts           # Cheat command parsing & state (+ test)
      mapQuery.ts         # Wall/floor/occupancy queries (+ test)
      freezeIndicator.ts  # Freeze visual state (+ test)
    scene/               # Babylon-dependent scene modules — NO tests
      materials.ts        # Material/texture creation
      levelBuilder.ts     # Level geometry construction
      effects.ts          # Visual effects (particles, flashes)
      enemyFactory.ts     # Enemy mesh creation
      potionModels.ts     # Potion 3D models
      hands.ts            # Hand/weapon rendering
      multiplayerUpdates.ts # Multiplayer state sync
      enemyAi.ts          # Enemy AI (~490 lines, largest module)
      projectiles.ts      # Fireballs, inferno stream, potion projectiles
      playerMovement.ts   # Player physics & movement
      hud.ts              # HUD rendering, minimap, cheat badges
      combatActions.ts    # Combat, damage, firing, enemy lookup
      cheatsUi.ts         # Cheat console toggle & execution
  multiplayer/
    types.ts             # Multiplayer type definitions
    legacySync.ts        # Colyseus state sync bridge
    MultiplayerGame.ts   # Multiplayer game management
    input/               # Multiplayer input handling
    net/                 # Network layer
    scene/               # Multiplayer scene components
    ui/                  # Multiplayer UI elements
```

### Key conventions

- **`game/runtime/`** = pure logic, no Babylon imports, always has tests.
- **`game/scene/`** = Babylon-dependent rendering/scene code, no tests.
- Modules in `game/scene/` can import from each other directly (e.g. `combatActions.ts` imports from `projectiles.ts` and `enemyAi.ts`).
- `main.ts` still contains: level building, enemy creation, `startLevel`, `resetRun`, `toggleRune`, `useSelectedPotion`, the game loop tick, and `init()`.

## Testing

- **Framework**: Vitest, environment `node`.
- **59 tests** across 9 test files.
- Test files are co-located: `foo.ts` has `foo.test.ts` next to it.
- `game/runtime/` modules are tested with plain unit tests (no mocking needed).
- `game/scene/` modules have no tests (Babylon dependency).

## Dependencies

- `@babylonjs/core` + `@babylonjs/loaders` — 3D engine
- `colyseus.js` — multiplayer client
