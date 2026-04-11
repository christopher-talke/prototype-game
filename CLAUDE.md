## Architecture

- Separation of concerns is strict. Each layer needs to be seperated (simulation, ui, rendering, net etc).
- If unsure where something belongs or how the system fits together, read ARCHITECTURE.md before proceeding.
- Do not reach across layer boundaries without a clear reason.

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

- **PixiJS migration Phase 0-2** (branch `feature/pixi-renderer`): PixiJS v8 renderer running alongside DOM renderer. `SETTINGS.renderer = 'pixi'` is hardcoded during development (localStorage key `sightline-renderer`). Both renderers coexist - pixi mode is guarded by `SETTINGS.renderer === 'pixi'` checks throughout.
- **Phase 1 - Walls + Camera**: `pixiApp.ts`, `pixiSceneGraph.ts` (16 layer containers), `pixiCamera.ts` (worldContainer transform, lerped aim offset), `pixiWallRenderer.ts` (Graphics per wall, `cacheAsTexture(true)`). Camera wired into `renderPipeline.ts`.
- **Phase 2 - Players**: `pixiPlayerRenderer.ts` (circle body, direction indicator, same-team flash square, health/armor bars, corpse markers, hit flash via tint, `applyPixiVisibility`). `pixiClientRenderer.ts` subscribes to gameEventBus for player events. `playerRenderer.ts:createPlayer` routes to `createPixiPlayer` in pixi mode.
- **fix - game loop**: `gameLoop.ts` gated the entire loop on `playerEl` existing. In pixi mode no DOM element is registered, so movement was silently blocked. Fixed: `SETTINGS.renderer === 'pixi' || playerEl`.
- **fix - rotation**: `inputController.ts` used `pageX - MAP_OFFSET` (DOM body-space) for rotation angle. In pixi mode there is no scroll so this drifts. Fixed: replaced with `screenToWorld(e.clientX, e.clientY)` from `coordConvert.ts`, which dispatches to `pixiScreenToWorld(clientX, clientY)` = `clientX + cameraX` in pixi mode.
- **Phase 3 - Projectiles + Grenades + Explosions**: `pixiProjectilePool.ts` (64-initial/512-max Graphics pool, tint-based weapon differentiation: sniper=white/2x, shrapnel=orange/0.67x, default=yellow/1x). `pixiGrenadeRenderer.ts` (per-grenade Graphics circle in `grenadeLayer`, explosion ring via Ticker scale 0.1->1 + alpha 1->0 over 500ms in `explosionLayer`). `pixiClientRenderer.ts` extended: BULLET_SPAWN/REMOVED/GRENADE_SPAWN/DETONATE/REMOVED handlers, `updateVisuals()` syncs positions, `clearPlayers()` also clears bullets/grenades. `main.ts` calls `initPixiProjectilePool()` after `initPixiApp()`.
- **Phase 4 - Fog of War**: `computeRaycastPolygon()` now returns `{ vertices: coordinates[]; count: number } | null` (CSS string building moved to DOM path in `raycastRenderer.ts`). `pixiFogOfWar.ts`: three-layer Lux-style approach - (1) subtle blue-white tint polygon in `backgroundLayer` below walls, (2) 82% dark overlay rect with visibility polygon `cut()` in `fogOfWarLayer` above walls, (3) radial gradient falloff `Sprite` (Canvas 2D texture, 1600px radius) centered on player for distance dimming. FOV cone fallback as two Graphics lines in `fovConeLayer`. `renderPipeline.ts` dispatches raycast result to both renderers.
- **Phase 5 - Effects + Markers**: `pixiSmokeRenderer.ts` (Graphics circle in `smokeLayer`, alpha fade over last 2s). `pixiAimLineRenderer.ts` (3 Graphics lines in `aimLineLayer` for center/left/right, grenade aim line; uses `pixiScreenToWorld` for mouse coords, right-click ADS toggle). Damage numbers on `BULLET_HIT` (floating `Text` in `damageNumberLayer`, animates y up + alpha fade over 800ms via Ticker). Status labels on `PLAYER_STATUS_CHANGED` (`Text` in `statusLabelLayer`, 1500ms timeout, 2000ms for DEAD, persistent for BUYING).
- **Phase 5 bug fixes**: (1) Last known positions: `updatePixiLastKnown` in `pixiPlayerRenderer.ts` creates 20x20 team-colored rect in `lastKnownLayer`, fades via Ticker after 3s; called from `renderPipeline.ts` alongside `applyPixiVisibility`. (2) Corpse skull: corpse is now a Container with circle + Text '\u2620' (skull) at center. (3) Status labels now update position every frame in `updateVisuals()`. (4) Smoke improved: multi-layer circles (outer/mid/core) + `BlurFilter(12)` in `pixiSmokeRenderer.ts`. (5) Weapon icons: `pixiPlayerRenderer.ts` loads SVGs as white-silhouette textures (canvas `destination-in` composite), adds `Sprite` to player container with rotation `-PI/2`, flip via `scale.y` when `rot 180-360`.
- **Phase 6 - Input + Coordinates**: Already complete from prior session. `inputController.ts` uses `screenToWorld()` from `coordConvert.ts`; pixi aim line uses `pixiScreenToWorld`. No MAP_OFFSET in pixi path.
- **Phase 7 - Dynamic World Size**: `MapData` type gains optional `bounds?: { width; height }`. `setEnvironmentLimits(w, h)` added to `environment.ts`, called in `loadMapWalls()` from active map bounds (default 3000). `GameSimulation.setLimits()` replaces MAP_SIZE constant for bullet/grenade clamping; `AuthoritativeSimulation.setMap()` propagates limits to inner sim. `webSocketAdapter.ts` local bullet bounds use `environment.limits`. `server/gameRoom.ts` welcome and sim-setMap use `mapData.bounds ?? 3000`.
- **Dual renderer support**: Both DOM and PixiJS renderers kept and maintained. `switchRenderer(newType)` in `rendererSwitch.ts` tears down both renderers' visual state, toggles pixi canvas / `body.renderer-pixi` CSS class, and rebuilds walls + players from game state. PixiJS always initialized at startup (canvas hidden in DOM mode). `app.ts` restored localStorage reading. Settings dropdown calls `switchRenderer()` directly (no restart needed).
- **2D Lighting System**: `lightRaycast.ts` computes 360-degree visibility polygons per light using `raySegmentIntersect` + wall corners. `lightingManager.ts` renders a world-sized RenderTexture lightmap (ambient fill + additive gradient sprites masked by shadow polygons), composited via `Sprite` with `blendMode='multiply'` in `lightingLayer`. Three tiers: static (map-defined, cached polygons), dynamic (player lights, per-frame raycast), transient (bullets/explosions, no shadows). `MapData` extended with `lights?: LightDef[]` and `lighting?: LightingConfig` (ambientLight 0-1 for day/night, ambientColor for tint). `setAmbientLight(level)` exposed on window for runtime control. Wired into `match.ts`, `renderPipeline.ts`, `rendererSwitch.ts`, `main.ts`.

