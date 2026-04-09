## Refactor Progress

- [x] P0: Path aliases (tsconfig paths + vite.config.ts) and camelCase naming convention
- [x] P1: Decompose game loop (interactivity.ts -> gameLoop.ts + inputController.ts + renderPipeline.ts)
- [x] P2: Split player creation (player.ts -> playerData.ts + playerRenderer.ts)
- [x] P3: Split player registry (Players.ts -> playerRegistry.ts + rendering/globals.ts)
- [x] P4: Split smoke (smoke.ts -> smokeData.ts + smokeRenderer.ts)
- [x] P5: Split visibility/detection pipeline (lineOfSight.ts + detection.ts)
- [x] P6: Split raycast (raycast.ts -> detection/raycast.ts + raycastRenderer.ts)
- [x] P7: Move GameSimulation + AuthoritativeSimulation to simulation/
- [x] P8: Consolidate collision duplication
- [x] P9: Split wall creation (wall.ts -> wallData.ts + wallRenderer.ts)
- [x] P10: Fix OfflineAdapter footstep audio leak
- [x] P11: Fix match.ts rendering leaks (cursor)
- [x] P12: Deduplicate normalizeAngle
- [x] P13: Move UI screens to ui/
- [x] P14: Document rotation client prediction

## Output

- Return code first. Explanation after, only if non-obvious.
- No inline prose. Use comments sparingly - only where logic is unclear.
- No boilerplate unless explicitly requested.

## Code Rules

- Simplest working solution. No over-engineering.
- No abstractions for single-use operations.
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
- If cause is unclear: say so. Do not guess.

## Simple Formatting

- No em dashes, smart quotes, or decorative Unicode symbols.
- Plain hyphens and straight quotes only.
- Natural language characters (accented letters, CJK, etc.) are fine when the content requires them.
- Code output must be copy-paste safe.
