# Architecture

## Layers

Five strict layers.

```
simulation/    --> may NOT import from rendering/, ui/, or orchestration/
rendering/     --> may import from simulation/ and net/gameEvent.ts, may NOT mutate simulation state
net/           --> may import from simulation/, may NOT import from rendering/
orchestration/ --> may import from everything (simulation, rendering, net, ui, ai)
ui/            --> may import from anything except simulation internals
```

**The simulation layer** is the source of truth for all game state and logic. It is completely decoupled from rendering and UI concerns, and only communicates via events and read-only state accessors.

**The rendering layer** is purely a consumer of simulation state and events, and the UI layer is purely a consumer of both.

**The network layer** is an adapter that allows the simulation to run in either local or remote mode without changing the simulation code itself.

**The orchestration layer** is application-level glue: it wires all layers together, owns the game loop, input handling, and match lifecycle. It is the only layer that may freely import across all others.

**The ui layer** is seperated from rendering to ensure that the graphics are decoupled from the menu and display systems. This allows for more flexibility in how the UI is implemented (e.g. using a different framework or library) without affecting the core rendering logic.

Separation of concerns so that if we need to swap out the rendering layer (e.g. for a WebGL/Canvas implementation) or add a new game mode with different UI, we can do so without changing the core simulation logic.

## Directories

```
server/               WebSocket multiplayer server (room lifecycle, tick loop)
src/
  orchestration/      Game loop, match lifecycle, input controller. Wires all layers.
  simulation/         Zero DOM. Game state, physics, rules.
    combat/           Weapons, grenades, damage, projectiles, smoke.
    detection/        Line-of-sight and player detection.
    environment/      Wall geometry and collision data.
    match/            Round/match state machine.
    player/           Player registry, movement, collision, visibility.
  rendering/          All visual output (DOM and PixiJS).
    canvas/           PixiJS renderer and all sub-systems.
    dom/              DOM/CSS renderer.
  net/                Event bus, transport adapters, wire protocol.
  ui/                 Screens and menus (not in-game rendering).
  ai/                 Bot behavior.
  audio/              Sound system.
  config/             Game balance and mode definitions.
  maps/               Map data and helpers.
  utils/              Shared pure math helpers.
```

## Runtime Flow

```
Input -> orchestration/gameLoop -> adapter.sendInput() -> simulation
                                               |
                                           GameEvent[]
                                               |
                                         gameEventBus
                                               |
                                        ClientRenderer -> DOM / Audio

Per-frame (not event-driven):
  orchestration/gameLoop -> detectOtherPlayers() -> updateRenderPipeline()
                                                         |
                                               camera, raycasting, visibility
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
- **Rendering never mutates simulation state.** Renderers subscribe to `gameEventBus` and consume state read-only. Any call to simulation write functions (`addSmokeData`, `clearPlayerRegistry`, etc.) belongs in `orchestration/` or the adapter layer.
- **Detection and tick-driven logic belong in the game loop.** `renderPipeline.ts` consumes detection results as a parameter; it does not call simulation functions directly.

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

## Map Data

Maps conform to the v1.5 schema in `src/shared/map/MapData.ts` and are validated by `src/orchestration/bootstrap/MapValidator.ts` at load time.

**Map files must be fully declarative.** A map module exports a single `MapData` object literal and nothing else. The intent is that a map file reads like a JSON config: every wall, zone, nav hint, decal, light, and placement is spelled out as a literal with all required fields present.

Not allowed in a map file:

- Factory helpers that fabricate `Wall`, `Zone`, `NavHint`, or any other placement (`aabb()`, `spawnZone()`, `cover()`, etc.).
- Default-filling tables keyed by type (`WALL_TYPE_DEFAULTS`, etc.). Wall-type-dependent fields like `solid`, `occludesVision`, `bulletPenetrable`, `penetrationDecay`, `audioOcclude` are written out on every wall.
- Module-level mutable state (counters, accumulators) used to derive IDs or positions.
- Loops, `.map`, `.filter`, or any other derivation at import time.
- Imports from `simulation/`, `rendering/`, `net/`, `orchestration/`, or `ai/`. Only `@shared/map/MapData` types are allowed.

Why: the map is authoring data, not code. Keeping it declarative means the file can be round-tripped through an editor, serialised, validated, and diffed as data. Runtime derivations belong in compilers (`orchestration/bootstrap/mapAccessors.ts` today, per-layer compilers in Phase 2) -- not in the map file itself. Every consumer -- physics, rendering, AI, editor -- derives its own runtime representation from the same canonical `MapData`.

Adding a new field with defaults that vary by some classifier (e.g. a new wall type): extend the type in `MapData.ts`, update `MapValidator` if a rule applies, and write the field explicitly on every placement. Do not add lookup tables to map files.

## Adding Things

- **Weapon / grenade**: add a definition in `simulation/combat/`.
    - The simulation, rendering, buy menu, and AI all read definitions dynamically.
- **Game mode**: add an entry to the mode registry in `config/modes/`.
    - The menu reads it automatically.
- **Map**: add a file in `maps/` and register it in the map helper. Author as a pure `MapData` literal -- see **Map Data** above.
- **Game event**: define the type in `src/simulation/events.ts`, emit from `AuthoritativeSimulation` (offline) and `WebSocketAdapter.eventHandler` (online), handle in both `ClientRenderer` classes. The `net/gameEvent.ts` module re-exports all types and owns the `EventBus` runtime.
- **HUD element**: add to `rendering/dom/hud.ts` or the relevant rendering sub-system.
- **Sound**: add to `audio/soundMap.ts`.
