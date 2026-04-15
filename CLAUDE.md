## Architecture

- Separation of concerns is strict. Each layer needs to be separated (orchestration, simulation, ui, rendering, net etc).
- If unsure where something belongs or how the system fits together, read ARCHITECTURE.md before proceeding.
- Do not reach across layer boundaries without a clear reason.
  
### Patterns in use

**Clean Architecture** (Dependency Rule): the simulation (innermost ring) imports nothing from outer layers. Rendering and net depend on simulation, not the reverse. Orchestration is the outermost ring and may import freely.

**Ports and Adapters** (Hexagonal): `NetAdapter` is the port. `OfflineAdapter` and `WebSocketAdapter` are the two adapters behind it. The game loop talks only to the interface, never to either adapter directly.

**Event Driven** at the simulation-rendering boundary: `gameEventBus` lets the simulation broadcast state changes without knowing what is listening. Renderers, audio, and HUD all subscribe independently. New listeners never require simulation changes.

## Output

- Return code first. Explanation after, only if non-obvious.
- No inline prose. Use comments sparingly - only where logic is unclear.
- No boilerplate unless explicitly requested.
- Keep track of the last (5-10) changes at a high level to understand how new changes may fit with the recent history of the codebase under `## Recent Changes` in this file.

## Code Rules

- Simplest working solution. No over-engineering.
- No speculative features or "you might also want..."
- Read the file before modifying it. Never edit blind.
- No docstrings or type annotations on code not being changed.
- No error handling for scenarios that cannot happen.
- Three similar lines is better than a premature abstraction.

## Review Rules

- State the bug. Show the fix. Stop.
- No suggestions beyond the scope of the review.
- No compliments on the code before or after the review.

## Debugging Rules

- Never speculate about a bug without reading the relevant code first.
- State what you found, where, and the fix. One pass.
- If cause is unclear: Say so. Do not guess.
- Stop and get clarification if you don't understand the problem or the code. Do not guess.
- If you need to test a fix, ask if you can test it yourself, do not assume you can run the code or have the necessary environment.

## Simple Formatting

- No em dashes, smart quotes, or decorative Unicode symbols.
- Plain hyphens and straight quotes only.
- Natural language characters (accented letters, CJK, etc.) are fine when the content requires them.
- Code output must be copy-paste safe.

## Recent Changes

- **PixiJS migration Phases 0-7** (branch `feature/pixi-renderer`): Full PixiJS v8 renderer alongside DOM renderer. Phases covered: walls+camera, players, projectiles+grenades, fog of war (3-layer Lux-style), effects+markers (smoke, aim lines, damage numbers, status labels, last-known positions, corpse skulls, weapon icons), input+coordinates, dynamic world size. Dual renderer support via `switchRenderer()` in `rendererSwitch.ts`.
- **2D Lighting System**: `lightRaycast.ts` computes 360-degree visibility polygons per light. `lightingManager.ts` renders world-sized lightmap composited via `blendMode='multiply'` in `lightingLayer`. Three tiers: static (cached), dynamic (per-frame), transient (no shadows). `MapData` extended with `lights` and `lighting` config.
- **Grid Displacement System**: `gridDisplacement.ts` - spring-damped physics on background grid points. Displaced by player movement (wake), bullets (travel ripple), and explosions. Per-source `maxDisplacement` override. Public API: `addDisplacementSource()` / `removeDisplacementSource()`.
- **Grenade Effects Overhaul**: Bug fix + visual rework. Scene graph restructured with 7 new layers; sensory effects (explosions, smoke, flash) moved ABOVE `lightingLayer` to fix FOW visibility bug. New SoA particle pool system (`particlePool.ts`) with Canvas 2D texture atlas. Per-grenade-type effect modules in `effects/`:
  - `fragEffect.ts`: 3-5 staggered shockwave rings, 40-60 emissive sparks + 15-25 dark debris with secondary spark emission, scorch decals (8s fade), multi-phase lighting (spike + decay), two-phase grid displacement (outward blast + vacuum pull).
  - `c4Effect.ts`: Heavy rings (1.5x radius), 80-120 sparks + 40-60 debris + 30-40 fine dust, heat shimmer (DisplacementFilter, 2.5s), screen desaturation (ColorMatrixFilter within 600px), sustained lighting, three-phase grid displacement with `maxDisplacement:42`.
  - `flashEffect.ts`: Full Pixi replacement for DOM flash overlay. 5-phase timeline (white pulse, peak hold, retinal burn with radial gradient, desaturation, recovery). Camera-tracked overlay in `flashLayer`.
  - `smokeEffect.ts`: AABB-aware volumetric particle system. Pre-computes navigation field, steers particles around walls through doorways. Three volumetric layers (inner/mid/outer), staged dissipation, per-particle FOW handling, CPU-side light sampling, bullet wake turbulence.
  - `lightingManager.ts` exports `getStaticLights()`, `getTransientLights()`, `getPlayerLights()` for smoke lighting. FRAG/C4 lighting handled by effect modules; flash/generic kept in manager.
  - `gridDisplacement.ts` updated: FRAG/C4 displacement handled by effect modules; flash/smoke get generic displacement. `maxDisplacement` per-source support added.
- **Graphics Quality Architecture**: `graphicsConfig.ts` defines `GraphicsConfig` type covering all quality-affecting rendering decisions. Quality sub-interfaces (`FragQuality`, `C4Quality`, etc.) are compile-time enforced against per-domain configs via `AssertExtends` type checks. `applyGraphicsConfig()` pushes preset values into existing per-domain config objects via `Object.assign`. Feature toggles guard 8 call sites (grid displacement, glow filter, heat shimmer, screen desaturation, secondary sparks, scorch decals, smoke light sampling, smoke volume layers). Current values are the HIGH preset baseline. `LIGHTMAP_SCALE` writable via setter.
- **VFX Configuration Blocks**: Centralized all visual effect parameters into typed VFX blocks co-located with simulation definitions. `GRENADE_VFX` in `grenades.ts` (typed per grenade: `FragVfx`, `C4Vfx`, `FlashVfx`, `SmokeVfx`) and `DEFAULT_WEAPON_VFX` + `WEAPON_VFX_OVERRIDES` in `weapons.ts` with `getWeaponVfx()` merge accessor. Design constants (colors, physics, timing, lighting, displacement) moved from `effectsConfig`, `lightingConfig`, `gridConfig`, and inline renderer code into VFX blocks. Quality-managed fields (particle counts, bank capacities, texture sizes) remain in `effectsConfig`. All grenade/weapon string comparisons eliminated from renderer event handlers. VFX types declared in `global.d.ts`.
- **Performance Optimization Pass**: Systematic hot-path audit across rendering, simulation, and network layers:
  - `gridDisplacement.ts`: Early-out skips physics loop + Graphics redraw when grid is at rest (no active sources and all points settled).
  - `lightingManager.ts`: Dirty-flagging skips lightmap render-to-texture pass when no light positions/states changed. Initial static render on init for LOW preset support.
  - `playerGlowManager.ts`: Viewport culling removes GlowFilter from off-screen player containers, avoiding GPU filter passes.
  - `detection.ts`: Pre-allocated entry pool + reusable result object eliminates per-frame array/object allocations.
  - `visibility.ts`: Numeric Map keys (id*10000+id) replace template literal strings; shared `_losResult` object eliminates per-call allocations.
  - `gameSimulation.ts`: Segment AABB broad-phase (`minX/minY/maxX/maxY` on `WallSegment`) culls ~80-90% of ray-segment tests for projectiles and grenades. `events.push(...spread)` replaced with indexed loop.
  - `authoritativeSimulation.ts`: `pushAll` spread replaced with loop; `Object.values().flat()` for spawn points cached at map load.
  - `particlePool.ts`: `aliveIndices` array enables `updateBank` to skip dead slots instead of scanning full capacity.
  - `webSocketAdapter.ts`: Interpolation skipped for stationary remote players (delta < 0.1px threshold).
  - `graphicsConfig.ts`: New `features.dynamicLighting` toggle; LOW preset disables per-frame lighting updates.
- **Architecture Audit & Security Hardening**:
  - Server input validation: `validatePlayerInput()` in `gameRoom.ts` type-checks and clamps all `PlayerInput` fields per input type. Movement dx/dy clamped to [-1,1], chargePercent to [0,1], grenade/weapon types whitelisted. Eliminates raw client data spreading.
  - Rate limiting: per-connection message throttle (120 msgs/sec) with auto-disconnect. `maxPayload` set on WebSocketServer.
  - Name sanitization: `sanitizeName()` strips control/zero-width chars, caps at 24 chars. Applied in both ws-server and CF worker.
  - Layer isolation: `simulation/events.ts` now owns all `GameEvent`/`PlayerInput` type definitions. `net/gameEvent.ts` re-exports them plus the `EventBus` runtime. Simulation no longer imports from net.
  - Rendering no longer imports from orchestration. Grenade charge state and selected type threaded as parameters from `gameLoop` through `renderPipeline` to aim line renderers and HUD.
  - `renderPipeline.ts` no longer calls `getActiveWeapon`/`getWeaponDef` directly; camera offset computed in the game loop and passed as a parameter.
  - Fixed duplicate code blocks in `renderPipeline.ts` (raycast and lighting sections were copy-pasted).
  - Fixed host reassignment bug in `gameRoom.ts` on player leave.
