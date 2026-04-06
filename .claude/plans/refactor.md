# Comprehensive Code Review & Refactoring Plan

## Context

This is a ~4000-line TypeScript 2D game using DOM + CSS clip-path for FOV rendering, with 20 players (1 human, 19 AI), 5 weapons, 4 grenade types, and TDM as the only game mode. All stats are hardcoded. No object pooling exists. Game logic and rendering are tightly coupled -- every state mutation directly touches the DOM.

**Goals:**

1. Performance optimization without altering gameplay feel
2. Data-driven architecture for stats, game modes, projectiles
3. Modular game mode system (config-driven)
4. Prepare architecture for online multiplayer while keeping offline play working

---

## Code Smells

### Performance (Critical)

| Severity | File:Line                             | Issue                                                                                                                                    |
| -------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL | `src/Player/interactivity.ts:103-104` | `getBoundingClientRect()` + `getComputedStyle()` on every mousemove -- forces layout reflow 60-120x/sec                                  |
| CRITICAL | `src/Combat/projectiles.ts:25-29,125` | `createElement('div')` per bullet, `element.remove()` + `splice()` on death. No pooling. Shotgun = 8 DOM creates/frame, C4 shrapnel = 80 |
| HIGH     | `src/AI/ai.ts:143-163`                | 19 AIs x 20 players x `isLineBlocked()` (3 rays each) = ~1000+ ray-segment iterations/frame                                              |
| HIGH     | `src/Combat/projectiles.ts:104`       | `document.getElementById('player-${player.id}')` inside hot collision loop. `getPlayerElement()` already exists using cached Map         |
| HIGH     | `src/Globals/Players.ts:38-39`        | `getPlayerInfo()` uses `PLAYERS.find()` O(n) -- called from 6+ modules many times/frame                                                  |
| MEDIUM   | `src/Combat/projectiles.ts:126`       | `splice(i, 1)` shifts array. Should be swap-and-pop O(1)                                                                                 |
| MEDIUM   | `src/Globals/Players.ts:30-31`        | `getOtherPlayers()` creates new filtered array every call                                                                                |
| MEDIUM   | `src/HUD/hud.ts:200`                  | `querySelectorAll('.grenade-slot')` runs every frame in `updateHUD()`                                                                    |
| LOW      | `src/Player/Raycast/raycast.ts:160`   | `new RayPoint[]` allocated every frame                                                                                                   |

### Architecture

| ID  | File                                  | Issue                                                                            |
| --- | ------------------------------------- | -------------------------------------------------------------------------------- |
| A1  | `src/Combat/weapons.ts:1-110`         | All 5 weapon stat blocks hardcoded as TS object                                  |
| A2  | `src/Combat/grenades.ts`              | All 4 grenade stat blocks hardcoded                                              |
| A3  | `src/Combat/gameState.ts:5-6`         | `STARTING_MONEY=99999`, `MATCH_DURATION=300000` are module constants             |
| A4  | `src/Combat/damage.ts:10-12`          | `ARMOR_ABSORPTION=0.5`, `RESPAWN_TIME=3000` hardcoded                            |
| A5  | `src/AI/ai.ts:17-26`                  | 7 AI tuning constants hardcoded                                                  |
| A6  | `src/main.ts:19-34`                   | Game mode `'tdm'` with no mode system. Player count (20) and teams (2) hardcoded |
| A7  | `src/Combat/grenadeProjectiles.ts:17` | `FRICTION=0.94` in grenade file, not centralized                                 |
| A8  | `src/constants.ts:4`                  | `SPEED=6` is compile-time constant                                               |
| A9  | `src/Combat/shooting.ts:12`           | `RECOIL_RESET_DELAY=300` hardcoded in shooting module                            |

### Multiplayer Readiness

| ID  | File:Line                                 | Issue                                                                         |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| M1  | `src/Combat/damage.ts:20-42`              | `applyDamage()` mutates health/armor directly. No authority check, no event.  |
| M2  | `src/Combat/projectiles.ts:91`            | Projectile collision calls `applyDamage()` inline -- damage decided by client |
| M3  | `src/Combat/gameState.ts:38-45`           | `recordKill()` mutates kills/money directly. Client can farm kills            |
| M4  | `src/Combat/gameState.ts:92-118`          | `buyWeapon()` deducts money client-side with no server validation             |
| M5  | `src/Combat/shooting.ts:70`               | Ammo decremented client-side, no fire validation                              |
| M6  | `src/Player/interactivity.ts:109,235-236` | Position and rotation mutated directly from input, no reconciliation          |
| M7  | `src/Combat/damage.ts:55-68`              | `killPlayer()` directly sets `dead=true`, schedules respawn locally           |
| M8  | Everywhere                                | Game logic and DOM rendering are in the same functions -- no separation       |

---

## Phase 1: Performance Quick Wins (no API changes)

### STATUS: COMPLETED

### 1A. Fix layout thrashing in mousemove

**File:** `src/Player/interactivity.ts:103-108`

```typescript
// BEFORE (forces layout reflow every mousemove):
const pointerBox = renderedPlayerElement.getBoundingClientRect();
const centerPoint = window.getComputedStyle(renderedPlayerElement).transformOrigin;
const centers = centerPoint.split(' ');
const centerY = pointerBox.top + parseInt(centers[1]) + scrollY;
const centerX = pointerBox.left + parseInt(centers[0]) + scrollX;

// AFTER (pure math, zero DOM reads):
const centerX = playerInfo.current_position.x + HALF_HIT_BOX + MAP_OFFSET;
const centerY = playerInfo.current_position.y + HALF_HIT_BOX + MAP_OFFSET;
```

### 1B. Player lookup Map

**File:** `src/Globals/Players.ts`

Add `PLAYERS_MAP: Map<number, player_info>` alongside the array. Update `addPlayer()` to populate both. Change `getPlayerInfo()` to `PLAYERS_MAP.get(id)`. O(n) -> O(1) for every caller.

### 1C. Use cached element reference

**File:** `src/Combat/projectiles.ts:104`

Replace `document.getElementById('player-${player.id}')` with `getPlayerElement(player.id)` (already exists in `Globals/Players.ts:18`).

### 1D. Swap-and-pop removal

**Files:** `src/Combat/projectiles.ts:126`, `src/Combat/grenadeProjectiles.ts` (grenade splice)

```typescript
// BEFORE:
projectiles.splice(i, 1);

// AFTER:
const last = projectiles.length - 1;
if (i !== last) projectiles[i] = projectiles[last];
projectiles.length = last;
```

### 1E. Cache HUD grenade slots

**File:** `src/HUD/hud.ts`

Cache the 4 `.grenade-slot` elements at `initHUD()` time. Replace per-frame `querySelectorAll` with direct Map reads.

---

## Phase 2: Projectile Object Pool

### STATUS: COMPLETE

### New file: `src/Combat/ProjectilePool.ts`

- `MAX_PROJECTILES = 512` (handles C4 burst of 80 + concurrent fire)
- Pre-create all `<div class="projectile">` at init, set `display: none`
- `freeStack: number[]` of available indices
- `acquire()`: pop from freeStack, set fields, show element
- `release()`: hide element, push index back. No `element.remove()`, no splice
- Sniper styling: toggle `.projectile-sniper` class on acquire/release

### Refactor `src/Combat/projectiles.ts`

- `spawnBullet()` calls `pool.acquire()` instead of `createElement()`
- Dead bullets call `pool.release()` instead of `element.remove()` + `splice()`
- `grenadeProjectiles.ts` shrapnel works automatically (calls `spawnBullet()`)

---

## Phase 3: Separate Game State from Rendering (Multiplayer Foundation)

### STATUS: COMPLETED

This is the critical architectural change that enables both online play and cleaner offline code. Currently every mutation function (damage, kill, move, buy) directly touches the DOM. We need to split this into: **state mutation** (portable, can run on server) and **rendering** (client-only, reacts to state).

### 3A. GameEvent system

### STATUS: COMPLETED

**New file:** `src/Net/GameEvent.ts`

Define a discriminated union of all game-meaningful events:

```typescript
type GameEvent =
    | { type: 'PLAYER_MOVE'; playerId: number; x: number; y: number; rotation: number }
    | { type: 'PLAYER_FIRE'; playerId: number; angleDeg: number; weaponType: string }
    | { type: 'BULLET_SPAWN'; bulletId: number; ownerId: number; x: number; y: number; dx: number; dy: number; speed: number; damage: number; weaponType?: string }
    | { type: 'BULLET_HIT'; bulletId: number; targetId: number; damage: number; killerId: number }
    | { type: 'BULLET_REMOVED'; bulletId: number }
    | { type: 'PLAYER_DAMAGED'; targetId: number; damage: number; attackerId: number; newHealth: number; newArmor: number }
    | { type: 'PLAYER_KILLED'; targetId: number; killerId: number }
    | { type: 'PLAYER_RESPAWN'; playerId: number; x: number; y: number }
    | { type: 'WEAPON_BUY'; playerId: number; weaponType: string }
    | { type: 'WEAPON_SWITCH'; playerId: number; slotIndex: number }
    | { type: 'GRENADE_THROW'; playerId: number; type: GrenadeType; x: number; y: number; angleDeg: number }
    | { type: 'GRENADE_DETONATE'; grenadeId: number; x: number; y: number }
    | { type: 'RELOAD_START'; playerId: number }
    | { type: 'RELOAD_COMPLETE'; playerId: number; ammo: number }
    | { type: 'MATCH_START'; modeId: string; playerIds: number[] }
    | { type: 'MATCH_END'; winnerId?: number };
```

These events are the **network protocol**. Offline mode emits and consumes them locally. Online mode serializes and sends them over WebSocket.

### 3B. GameSimulation (authoritative state)

### STATUS: COMPLETED

**New file:** `src/Net/GameSimulation.ts`

A pure-logic class with no DOM dependencies. Holds all authoritative state:

- Player positions, health, armor, weapons, grenades
- Projectile positions and alive state
- Match state, economy
- Grenade positions and timers

Methods:

- `processInput(input: PlayerInput): GameEvent[]` -- validates and applies input, returns events
- `tick(dt: number): GameEvent[]` -- advances simulation one step (projectile movement, grenade timers, collision), returns events
- `applyEvent(event: GameEvent): void` -- applies an authoritative event to state (used by clients receiving server events)
- `getSnapshot(): GameSnapshot` -- full state for late-joining clients

This class replaces the scattered state mutations in `damage.ts`, `projectiles.ts`, `gameState.ts`, and `shooting.ts`. The existing functions become thin wrappers that call into the simulation.

### 3C. Renderer (client-only, reacts to events)

### STATUS: COMPLETED

**New file:** `src/Net/ClientRenderer.ts`

Subscribes to `GameEvent` stream and handles all DOM/audio side effects:

- `PLAYER_MOVE` -> update CSS transform
- `PLAYER_DAMAGED` -> hit flash, health bar, damage number, hit marker
- `PLAYER_KILLED` -> death animation, kill feed
- `PLAYER_RESPAWN` -> remove dead class, reposition
- `BULLET_SPAWN` -> acquire from pool, position
- `BULLET_REMOVED` -> release to pool
- `GRENADE_DETONATE` -> explosion visual, sound

This is a refactor of existing rendering code out of the mutation functions, not new rendering logic.

### 3D. NetAdapter interface

### STATUS: COMPLETED

**New file:** `src/Net/NetAdapter.ts`

```typescript
interface NetAdapter {
    mode: 'offline' | 'online';
    sendInput(input: PlayerInput): void;
    onEvent(callback: (event: GameEvent) => void): void;
    connect?(): Promise<void>;
    disconnect?(): void;
}
```

**Two implementations:**

**OfflineAdapter** (`src/Net/OfflineAdapter.ts`):

- Holds a `GameSimulation` instance locally
- `sendInput()` -> immediately processes through simulation -> emits events to callback
- `tick()` called from game loop -> emits events
- This is what the game uses today, just formalized

**OnlineAdapter** (`src/Net/OnlineAdapter.ts`, future):

- `sendInput()` -> serializes and sends via WebSocket to server
- Server runs `GameSimulation`, broadcasts events to all clients
- `onEvent()` receives server events, applies to local predicted state
- Client-side prediction: local player movement applied immediately, reconciled on server response
- Entity interpolation: other players smoothly interpolated between server snapshots

### 3E. Migration strategy (incremental, not big-bang)

### STATUS: COMPLETED

The refactor happens incrementally. Each step keeps the game playable:

1. **Define GameEvent types** -- no behavior change
2. **Create GameSimulation** by extracting logic from existing functions. Each existing function (`applyDamage`, `recordKill`, `spawnBullet`, etc.) becomes a thin wrapper that calls simulation + emits event
3. **Create ClientRenderer** by extracting DOM code from those same functions into event handlers
4. **Create OfflineAdapter** that wires simulation -> renderer
5. **Update game loop** (`interactivity.ts`) to use the adapter instead of direct function calls
6. At this point, offline play works exactly as before, but through the event system
7. **OnlineAdapter** can be built later against the same interface

---

## Phase 4: Data-Driven Config System

### STATUS: COMPLETED

### New files

- `src/Config/types.ts` -- `GameModeConfig` interface
- `src/Config/defaults.ts` -- `BASE_DEFAULTS` matching all current hardcoded values exactly
- `src/Config/activeConfig.ts` -- `getConfig()` / `setGameMode()` singleton

### GameModeConfig interface

```typescript
interface GameModeConfig {
    id: string;
    name: string;

    match: {
        duration: number; // ms (currently 300000)
        maxPlayers: number; // currently 20
        teamsCount: number; // currently 2
        friendlyFire: boolean; // currently false
    };

    economy: {
        startingMoney: number; // currently 99999
        killRewardMultiplier: number; // 1.0
    };

    player: {
        maxHealth: number; // 100
        startingArmor: number; // 0
        speed: number; // 6
        respawnTime: number; // 3000
        armorAbsorption: number; // 0.5
    };

    physics: {
        grenadeFriction: number; // 0.94
        bulletSpeedMultiplier: number; // 1.0
    };

    weapons: {
        allowedWeapons: string[] | 'ALL';
        startingWeapons: string[]; // ['PISTOL']
        overrides: Record<string, Partial<WeaponDef>>;
        globalDamageMultiplier: number; // 1.0
        recoilMultiplier: number; // 1.0
    };

    grenades: {
        allowedGrenades: GrenadeType[] | 'ALL';
        startingGrenades: Partial<Record<GrenadeType, number>>;
    };

    ai: {
        speed: number;
        detectRange: number; // 800
        fireCone: number; // 8
    };
}
```

### Config resolution

`resolveConfig(partial: DeepPartial<GameModeConfig>)` deep-merges onto `BASE_DEFAULTS`. Arrays replace, not concatenate. Cached singleton -- `getConfig()` is a property read, zero per-frame cost.

### Migration

Replace hardcoded constants to read from `getConfig()`:

- `gameState.ts:5-6` -- `STARTING_MONEY`, `MATCH_DURATION`
- `damage.ts:10-12` -- `ARMOR_ABSORPTION`, `RESPAWN_TIME`
- `shooting.ts:12` -- `RECOIL_RESET_DELAY`
- `grenadeProjectiles.ts:17` -- `FRICTION`
- `constants.ts:4` -- `SPEED`
- `ai.ts:17-26` -- all AI constants

Wrap `getWeaponDef()` to apply `config.weapons.overrides[weaponId]` and `globalDamageMultiplier`.

In online mode, the server sends the resolved config to clients at match start. Both sides use the same `GameModeConfig` to drive the simulation.

---

## Phase 5: Game Mode System

### New files

- `src/Config/modes/` -- one file per mode exporting a `Partial<GameModeConfig>`
- `src/GameMode/GameModeController.ts` -- lifecycle hooks

### Predefined modes

| Mode              | Key Overrides                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **TDM**           | Empty partial (all defaults)                                                             |
| **Snipers Only**  | `allowedWeapons: ['SNIPER']`, `startingWeapons: ['SNIPER']`, `startingMoney: 0`          |
| **Low Gravity**   | `grenadeFriction: 0.98`, `player.speed: 8`, `bulletSpeedMultiplier: 1.2`                 |
| **One-Shot Kill** | `player.maxHealth: 1`, `globalDamageMultiplier: 10`                                      |
| **Gun Game**      | `startingMoney: 0`, `killRewardMultiplier: 0`, custom onKill hook for weapon progression |

### GameModeController

```typescript
class GameModeController {
    startMode(modeId: string): void; // resolves config, calls initMatch()
    onKill(killerId, victimId): void; // for Gun Game weapon progression
    onRespawn(playerId): void; // sets starting weapons/grenades per mode
    isWeaponAllowed(weaponId): boolean; // buy menu filter
    isGrenadeAllowed(type): boolean; // buy menu filter
}
```

### Integration

- `main.ts` -- calls `controller.startMode()` at init
- `damage.ts` `respawnPlayer()` -- calls `controller.onRespawn()`
- `gameState.ts` `recordKill()` -- calls `controller.onKill()`
- `hud.ts` buy menu -- filters through `isWeaponAllowed()`

In online mode, the server selects the mode and sends the resolved config. The controller runs on both sides.

---

## Phase 6: Online Multiplayer Implementation (future, requires Phase 3)

### Server

- Node.js + WebSocket (ws library)
- Runs `GameSimulation` as authority
- Receives `PlayerInput` from clients, validates, ticks simulation at fixed 60Hz
- Broadcasts `GameEvent[]` to all clients each tick
- Handles: connection, disconnection, late join (sends snapshot)
- AI runs server-side for online matches (clients only render)

### Client (online mode)

- `OnlineAdapter` connects via WebSocket
- Local player: client-side prediction with server reconciliation
    - Apply input immediately to local simulation copy
    - When server event arrives, rewind and replay from last confirmed state
- Remote players: entity interpolation
    - Buffer 2-3 server snapshots, interpolate positions between them
    - Smooth visual movement at ~100ms delay
- Projectiles: server-authoritative hit detection
    - Client shows predicted bullet visuals
    - Server confirms/denies hits via events

### Lobby / matchmaking (minimal)

- Simple room system: create room -> get room code -> others join with code
- Or quick match queue
- Room selects game mode config before match starts

### What stays client-only (never networked)

- FOV/raycast rendering (clip-path)
- Camera/viewport
- HUD rendering
- Audio playback
- Aim line visualization
- Last-known position markers
- Crosshair

---

## Dependency Graph

```
Phase 1 (Quick Wins) -----------> independent, do first
Phase 2 (Projectile Pool) ------> independent
Phase 3 (State/Render Split) ----> independent (LARGEST, enables online)
Phase 4 (Config System) ---------> independent of 2, 3
Phase 5 (Game Modes) ------------> requires Phase 4
Phase 6 (Online Multiplayer) ----> requires Phase 3 + 4
```

Phases 1, 2, 3, and 4 can proceed in parallel. Phase 1 first (smallest, highest ROI). Phase 3 is the most important architectural change -- without it, online play requires a full rewrite.

---

## Verification

### Phase 1

- Play a full match. Confirm mouse aiming feels identical (no drift or offset)
- Fire all 5 weapons. Confirm hit markers, damage numbers, kill feed work
- No console errors

### Phase 2

- Fire shotgun (8 pellets), throw frag (30 shrapnel), detonate C4 (80 shrapnel)
- Confirm all spawn and despawn without visual artifacts
- DOM element count stays bounded

### Phase 3

- Offline play through OfflineAdapter must be identical to current behavior
- All game events fire correctly (add temporary console.log to verify)
- No rendering code in simulation, no state mutation in renderer

### Phase 4

- With defaults, game plays identically to current
- Every `BASE_DEFAULTS` value matches its hardcoded constant

### Phase 5

- "Snipers Only" -- only sniper in buy menu, start with sniper
- "One-Shot Kill" -- any hit kills
- TDM -- normal gameplay restored

### Phase 6

- Two browser tabs can connect and see each other move
- Damage dealt by one client is reflected on the other
- Kill/death/money state consistent across clients
- Disconnection handled gracefully (player removed or AI takes over)

---

## Critical files to modify

- `src/Globals/Players.ts`
- `src/Player/interactivity.ts`
- `src/Combat/projectiles.ts`
- `src/Combat/grenadeProjectiles.ts`
- `src/Combat/gameState.ts`
- `src/Combat/damage.ts`
- `src/Combat/weapons.ts`
- `src/Combat/shooting.ts`
- `src/HUD/hud.ts`
- `src/AI/ai.ts`
- `src/constants.ts`
- `src/main.ts`

## New files to create

- `src/Config/types.ts`
- `src/Config/defaults.ts`
- `src/Config/activeConfig.ts`
- `src/Config/modes/*.ts` (one per game mode)
- `src/Combat/ProjectilePool.ts`
- `src/GameMode/GameModeController.ts`
- `src/Net/GameEvent.ts`
- `src/Net/GameSimulation.ts`
- `src/Net/ClientRenderer.ts`
- `src/Net/NetAdapter.ts`
- `src/Net/OfflineAdapter.ts`
- `src/Net/OnlineAdapter.ts` (Phase 6)
