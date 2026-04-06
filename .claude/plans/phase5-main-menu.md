# Phase 5: Game Mode System + Main Menu

## Goal

Add a Factorio-style main menu that gates game startup, lets the player pick a mode
(config-driven), links to existing settings, and shows controls. Online is stubbed
as disabled. Adding a new mode in future = one entry in GAME_MODES array.

## Screens

```
MAIN
  [OFFLINE]         -> MODE SELECT
  [ONLINE]          disabled, "Coming Soon"
  [SETTINGS]        opens existing settings overlay
  [HOW TO PLAY]     -> HOW TO PLAY

MODE SELECT
  Mode cards (click to select, highlighted border)
  [BACK] [PLAY]

HOW TO PLAY
  Controls reference table
  [BACK]
```

## Architecture

### New: `src/Config/modes/index.ts`
All mode definitions as `{ id, name, description, tags, partial: DeepPartial<GameModeConfig> }[]`.
No per-file splitting -- all modes in one place so adding a new one is trivially visible.

### New: `src/MainMenu/MainMenu.ts`
- `showMainMenu(onPlay: (modeId: string) => void)` -- mounts overlay, wires up all screens
- Internal state machine: `'main' | 'mode-select' | 'how-to-play'`
- `hideMainMenu()` -- fades overlay out, unmounts
- Settings button calls `toggleSettings()` from existing settings module
- No dependencies on game state -- pure UI

### New: `src/MainMenu/menu.css`
- Full-screen fixed overlay, `z-index: 9500` (above HUD at 1000)
- Dark opaque background with subtle CSS grid texture
- Font: 'Courier New', monospace -- matches existing HUD aesthetic
- Button variants: primary (cyan accent), disabled (muted, pointer-events: none)
- Mode cards: dark panel, `border: 1px solid rgba`, selected state gets cyan border glow
- Fade-out animation on game start

### Modified: `src/main.ts`
- Remove `initMatch()` from DOMContentLoaded
- After player/AI setup, call `showMainMenu(onPlay)` instead
- `onPlay(modeId)`: `setGameMode(GAME_MODES[modeId].partial)` -> `initMatch(playerIds)` -> `hideMainMenu()`
- HUD still init'd before menu so it's ready when game starts

## Game Modes

| ID | Name | Key Overrides |
|----|------|---------------|
| `tdm` | Team Deathmatch | defaults (empty partial) |
| `snipers-only` | Snipers Only | allowedWeapons: ['SNIPER'], startingWeapons: ['SNIPER'], startingMoney: 0 |
| `low-gravity` | Low Gravity | speed: 9, grenadeFriction: 0.98, bulletSpeedMultiplier: 1.3 |
| `one-shot-kill` | One-Shot Kill | maxHealth: 1, startingArmor: 0, globalDamageMultiplier: 100 |

## Aesthetic Notes

Match existing HUD: dark navy backgrounds, Courier New, rgba borders,
cyan (#00e5ff) and amber (#fbbf24) as accent colours. Buttons are flat rectangles
with border, no gradients, subtle hover fill. Mode cards have a description line
and small tag pills (e.g. "ALL WEAPONS", "FAST", "LETHAL").

## Files Changed

New:
- `src/Config/modes/index.ts`
- `src/MainMenu/MainMenu.ts`
- `src/MainMenu/menu.css`

Modified:
- `src/main.ts` -- defer initMatch, add showMainMenu call
