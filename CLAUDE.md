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
- **Next - Phase 5**: Effects + Markers (smoke clouds, aim line, damage numbers, status labels).

