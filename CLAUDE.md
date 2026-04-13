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

