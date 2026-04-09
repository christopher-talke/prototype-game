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

