# Architecture

## Layers

Four strict layers.

```
simulation/  --> may NOT import from rendering/ or ui/
rendering/   --> may import from simulation/ and net/GameEvent.ts
net/         --> may import from simulation/, may NOT import from rendering/
ui/          --> may import from anything except simulation internals
```

The primary purpose of this is to allow the simulation to be used in isolation for testing, bots, and potentially other game modes in the future. The rendering layer is purely a consumer of simulation state and events, and the UI layer is purely a consumer of both. 

The network layer is an adapter that allows the simulation to run in either local or remote mode without changing the simulation code itself.

Seperation of concerns so that if we need to swap out the rendering layer (e.g. for a WebGL/Canvas implementation) or add a new game mode with different UI, we can do so without changing the core simulation logic.

## Directories

```
server/          WebSocket multiplayer server (room lifecycle, tick loop)
src/
  simulation/    Zero DOM. Game state, physics, rules.
  rendering/     All DOM output.
  net/           Event bus, transport adapters, wire protocol.
  ui/            Screens and menus (not in-game rendering).
  ai/            Bot behavior.
  audio/         Sound system.
  combat/        Weapon, grenade, and damage definitions.
  config/        Game balance and mode definitions.
  environment/   Map geometry and collision data.
  hud/           In-game UI elements.
  maps/          Map data.
  match/         Match lifecycle.
  utilities/     Shared pure math helpers.
```

## Runtime Flow

```
Input -> gameLoop -> adapter.sendInput() -> simulation
                                               |
                                           GameEvent[]
                                               |
                                         gameEventBus
                                               |
                                        ClientRenderer -> DOM / Audio

Per-frame (not event-driven):
  gameLoop -> renderPipeline -> camera, raycasting, visibility
```

## Adapter Pattern

The game loop never talks to the simulation or network directly.

```
OfflineAdapter    -> AuthoritativeSimulation (local)
WebSocketAdapter  -> Server -> AuthoritativeSimulation (remote)
```

Both implement the same `NetAdapter` interface. Logic added to `AuthoritativeSimulation` works in both modes automatically.

**Online - client-side prediction:** The client immediately applies move inputs locally (optimistic) and sends them to the server. The server echoes back an authoritative position (`input_ack`). The client replays pending unacknowledged inputs from that position. Small errors are smoothed; large errors (respawns) snap immediately. Remote players are interpolated toward server snapshots.

## Key Globals

These are module-level singletons. Do not instantiate new ones.

- `PLAYERS` / `ACTIVE_PLAYER` - player registry, source of truth for all player state
- `gameEventBus` - the single event bus shared by both adapters and the renderer
- `getAdapter()` / `setAdapter()` - the active transport; swapped when switching offline/online
- `environment` - collision geometry for the active map

## Constraints

- **No DOM in simulation.** `simulation/` must stay pure. All rendering side effects go through `ClientRenderer` via events.
- **All state flows through the adapter.** Do not mutate player positions directly; it bypasses reconciliation in online mode.

## Graphics Quality Config

All rendering quality decisions route through `GraphicsConfig` (defined in `rendering/canvas/config/graphicsConfig.ts`). The simulation layer never imports or references it.

### Structure

```
rendering/canvas/config/
  graphicsConfig.ts      Type, sub-interfaces, preset map, runtime state, applyGraphicsConfig()
  effectsConfig.ts       Frag/C4/flash/smoke design + quality fields
  glowConfig.ts          Glow filter design + quality fields
  gridConfig.ts          Background grid design + quality fields
  particleConfig.ts      Particle texture sizes
  lightingConfig.ts      Lighting design constants
  cameraConfig.ts        Camera design constants
  hudConfig.ts           HUD design constants
  presets/
    presetLow.ts         All features off, reduced counts/textures, 1 smoke layer
    presetMedium.ts      Partial features, moderate counts/textures, 1 smoke layer
    presetHigh.ts        All features on, baseline counts/textures, 3 smoke layers
    presetUltra.ts       All features on, higher counts/textures, 3 smoke layers
```

### Two kinds of config value

- **Quality-managed** -- varies by preset (particle counts, texture sizes, feature toggles). Defined in quality sub-interfaces (`FragQuality`, `C4Quality`, etc.) inside `graphicsConfig.ts`. Pushed into per-domain configs by `applyGraphicsConfig()` via `Object.assign`.
- **Design constants** -- identical across all presets (physics, colors, timings, animation curves). Live directly in per-domain config files and are never overwritten.

### Compile-time enforcement

Each per-domain config uses `AssertExtends` type assertions to verify it includes all fields from the corresponding quality sub-interface. Adding a field to a quality sub-interface without updating the per-domain config default or the presets is a compiler error.

### Feature toggles

Eight boolean toggles in `GraphicsConfig.features` guard expensive rendering paths:

| Toggle | Guard site |
|--------|-----------|
| `gridDisplacement` | `renderPipeline.ts` -- skips `updateGridDisplacement()` |
| `glowFilter` | `playerGlowManager.ts` -- skips GlowFilter creation |
| `heatShimmer` | `c4Effect.ts` -- skips DisplacementFilter spawn |
| `screenDesaturation` | `c4Effect.ts` -- skips ColorMatrixFilter |
| `secondarySparks` | `fragEffect.ts` -- skips secondary spark emission |
| `scorchDecals` | `fragEffect.ts`, `c4Effect.ts` -- skips scorch sprite spawn |
| `smokeLightSampling` | `smokeEffect.ts` -- skips per-particle light sampling |
| `smokeVolumeLayers` | `effectsConfig.smoke.layerCount` (1 vs 3) |

### Adding a new quality field to an existing section

1. Add the field to the quality sub-interface in `graphicsConfig.ts`.
2. Add a value to each preset file in `presets/`. Compiler catches missing fields.
3. Add a default to the per-domain config. `AssertExtends` catches a missing field.
4. `Object.assign` in `applyGraphicsConfig()` covers it automatically -- no change needed there.

### Adding a new effect with quality parameters

1. Create a new quality sub-interface in `graphicsConfig.ts` and add a section to `GraphicsConfig`.
2. Add values to each preset file.
3. Create or update a per-domain config file with `AssertExtends` assertion.
4. Add one `Object.assign` line to `applyGraphicsConfig()`.
5. If the effect should be toggleable, add a boolean to `features` and guard the call site.

## Adding Things

- **Weapon / grenade**: add a definition in `Combat/`. 
    - The simulation, rendering, buy menu, and AI all read definitions dynamically.
- **Game mode**: add an entry to the mode registry in `Config/modes/`. 
    - The menu reads it automatically.
- **Map**: add a file in `Maps/` and register it in the map helper.
- **Game event**: define the type in `Net/GameEvent.ts`, emit from `AuthoritativeSimulation`, handle in `ClientRenderer`.
- **HUD element**: add to `HUD/`.
- **Sound**: add to `Audio/soundMap.ts`.
