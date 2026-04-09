# Architecture

A developer guide to the runtime structure of the game. 

If you want to add a weapon, grenade, game mode, or network feature, this tells you where to go.

## Quick Reference

| I want to...                    | Go to                                      |
|---------------------------------|--------------------------------------------|
| Add a new weapon                | `src/Combat/weapons.ts` (WEAPON_DEFS)      |
| Add a new grenade type          | `src/Combat/grenades.ts` (GRENADE_DEFS)    |
| Add a new game mode             | `src/Config/modes/index.ts`                |
| Change player/match balance     | `src/Config/defaults.ts`                   |
| Add a new map                   | `src/Maps/` + `src/Maps/helpers.ts`        |
| Add a new HUD element           | `src/HUD/hud.ts`                           |
| Add a new sound                 | `src/Audio/soundMap.ts`                    |
| Add a new game event            | `src/Net/GameEvent.ts`                     |
| Change simulation logic         | `src/simulation/authoritativeSimulation.ts` |
| Change projectile/grenade physics | `src/simulation/gameSimulation.ts`        |
| Add rendering for a new event   | `src/Net/ClientRenderer.ts`               |
| Change AI behavior              | `src/ai/ai.ts`                             |
| Change server multiplayer logic  | `server/GameRoom.ts`                      |
| Change client multiplayer logic  | `src/Net/WebSocketAdapter.ts`             |
| Change fog of war / raycasting  | `src/simulation/detection/raycast.ts` (geometry), `src/rendering/raycastRenderer.ts` (DOM) |
| Change visibility / detection   | `src/simulation/player/visibility.ts` (logic), `src/rendering/visibilityRenderer.ts` (DOM) |

---

## Layer Rules

The codebase enforces three strict layers. The rendering layer is designed to be replaceable with WebGL.

```
simulation/  --> may NOT import from rendering/ or ui/
rendering/   --> may import from `simulation/` and `net/gameEvent.ts` (subscribe)
net/         --> may import from `simulation/`, but may NOT import from `rendering/`
ui/          --> may import from anything except simulation internals
```

---

## Directory Structure

```
server/                  WebSocket multiplayer server
  ws-server.ts             Entry point, room routing
  GameRoom.ts              Room lifecycle, tick loop, player management

src/
  main.ts                  Boot sequence, match lifecycle, menu wiring
  constants.ts             FOV, hit box sizes, rotation offset

  simulation/              Zero DOM. Game state, physics, rules.
    gameLoop.ts              rAF loop, input collection, tick orchestration
    inputController.ts       Keyboard/mouse listeners, grenade charge, movement input
    gameSimulation.ts        Pure projectile/grenade physics
    authoritativeSimulation.ts  Full state machine: input, match/round, economy, respawns
    player/
      playerData.ts            generatePlayers, PlayerStatus, HELD_DIRECTIONS
      playerRegistry.ts        PLAYERS, PLAYERS_MAP, ACTIVE_PLAYER, lookups
      collision.ts             moveWithCollision (single consolidated implementation)
      visibility.ts            lineOfSight() pure computation, isFacingTarget()
    combat/
      smokeData.ts             SmokeData[], isSmoked(), expiry logic
    detection/
      detection.ts             detectOtherPlayers -> DetectionEntry[] (no DOM)
      raycast.ts               2D raycasting geometry, polygon computation
    environment/
      wallData.ts              registerWallGeometry, addWallToCollisions

  rendering/               All DOM output. Replaceable with WebGL.
    renderPipeline.ts        Per-frame update dispatcher (camera, vis, raycast, hud, etc.)
    playerRenderer.ts        Player div, health bars, nametags, positioning
    playerElements.ts        DOM element registries (player, health bar, nametag elements)
    wallRenderer.ts          Wall div creation
    visibilityRenderer.ts    applyVisibility, last-known markers, debug LOS
    raycastRenderer.ts       Fog-of-war clip-path, FOV lines, adaptive quality modal
    smokeRenderer.ts         Smoke cloud DOM, fading lifecycle

  Net/                     Event bus + transport adapters
    GameEvent.ts             Event/Input type definitions + EventBus
    ClientRenderer.ts        Subscribes to event bus, drives DOM + audio side effects
    NetAdapter.ts            Adapter interface
    OfflineAdapter.ts        Local simulation wrapper
    WebSocketAdapter.ts      WebSocket client, prediction, reconciliation
    activeAdapter.ts         Module-level get/set for current adapter
    Protocol.ts              Wire protocol types

  ui/                      Screens and menus (not in-game rendering)
    mainMenu/                Main menu, mode select, customize, how-to-play
    loading/                 Loading screen with progress bar
    settings/                Settings menu (controls, audio, game) + keybinds
    lobby/                   Online multiplayer lobby
    gameCustomizer/          Game configuration UI (tabbed: match, economy, weapons, etc.)

  AI/                      Bot behavior
    ai.ts                    State machine: patrol -> chase -> search

  Audio/                   Sound system
    audio.ts                 AudioContext, spatial panning, gain hierarchy
    soundMap.ts              Sound ID -> file mappings, preload cache

  Combat/                  Weapons, grenades, projectiles, damage
    weapons.ts               WEAPON_DEFS (damage, fire rate, recoil, etc.)
    grenades.ts              GRENADE_DEFS (fuse, radius, shrapnel, etc.)
    shooting.ts              Fire state tracking (mousedown/up)
    damage.ts                isPlayerDead check
    ProjectilePool.ts        DOM element pool for bullet rendering

  Config/                  Game balance and mode definitions
    types.ts                 GameModeConfig interface
    defaults.ts              BASE_DEFAULTS for all config values
    activeConfig.ts          Runtime config getter, mode merging
    modes/index.ts           Game mode registry (TDM, Snipers, Low Gravity, etc.)

  Environment/             Map geometry and collision data
    environment.ts           Collision grid, viewport limits, wall segments

  HUD/                     In-game UI (health, ammo, buy menu, kill feed, scoreboard)
    hud.ts                   Element creation and event-driven updates

  Maps/                    Map data
    arena.ts                 Arena map: walls, spawns, patrol points
    helpers.ts               getActiveMap() / setActiveMap()

  Match/                   Match lifecycle
    match.ts                 initMatchSystem, launchMatch, returnToMenu

  Player/                  Remaining player utilities (to be further split)
    aimline.ts               ADS aim line rendering
    Raycast/rayGeometry.ts   Ray-segment intersection math

  Rendering/               Legacy rendering utilities (to be consolidated into rendering/)
    Camera.ts                Camera positioning + scrollTo
    cssTransform.ts          CSS transform string builder
    FogOfWar.ts              FOW element creation

  Utilities/               Math helpers (angle, distance, random, etc.)
  utils/                   Shared pure utilities (normalizeAngle)
```

---

## Runtime Flow

### Boot Sequence

Everything starts in `main.ts` on `DOMContentLoaded`:

```
1. Show loading screen
2. generateEnvironment()         Build collision grid from map walls
3. drawFogOfWar()                Initialize FOV overlay
4. initProjectilePool()          Pre-allocate 512 bullet DOM elements
5. clientRenderer.init()         Subscribe to gameEventBus
6. Create wall elements          registerWallGeometry() + renderWall() per wall
7. initGameLoop()                Input listeners + requestAnimationFrame loop
8. initHUD()                     Build UI elements
9. loadAllSounds()               Pre-cache all audio buffers
10. authSim.setMap(...)          Pass wall geometry to simulation
11. showMainMenu()               Wait for user to start a match
```

### Match Start

When the user clicks Play:

```
launchMatch(modeId)
  1. setGameMode(modeOverrides)  Merge mode config with defaults
  2. spawnOfflinePlayers()       Create player_info + DOM elements
  3. authSim.initMatch(ids)      Initialize match/round state, economy
  4. authSim.startRound()        Reset positions, emit ROUND_START
  5. gameEventBus.emitAll()      ClientRenderer processes initial events
```

For online matches, the flow is different: the server runs `beginGame()` which sets up the simulation server-side, and the client receives events + snapshots over WebSocket.

### Game Loop (60 fps)

`simulation/gameLoop.ts` runs via `requestAnimationFrame`:

```
Each frame:
  1. Read input state (WASD keys held, mouse fire state)
  2. If round active + player alive:
     - adapter.sendInput(MOVE)             Movement direction
     - adapter.sendInput(FIRE)             If mouse held
  3. adapter.tick(timestamp)               Advance simulation
     - Ticks projectiles, grenades, reloads, respawns, match timer
     - Returns GameEvent[] -> emitted to bus
  4. updateRenderPipeline()                Per-frame visual updates:
     - clientRenderer.updateVisuals()        Sync DOM positions
     - Camera update                         Center viewport on player
     - detectOtherPlayers() -> results       Compute visibility (pure)
     - Apply visibility to DOM               visibilityRenderer
     - Raycast / FOV                         raycastRenderer
     - Aim line, HUD, smoke clouds
  5. updateAllAI()                         (offline only) Run bot logic
```

---

## Core Abstraction: The Adapter Pattern

The game loop never talks to the simulation or network directly. It talks to an adapter:

```
                     getAdapter()
                         |
            +------------+------------+
            |                         |
      OfflineAdapter           WebSocketAdapter
            |                         |
   AuthoritativeSimulation      WebSocket -> Server
   (runs locally)               (server runs AuthSim)
```

Both adapters implement `NetAdapter`:

```typescript
interface NetAdapter {
  mode: 'offline' | 'online';
  sendInput(input: PlayerInput): void;
  tick(segments, players, timestamp): void;
  isRoundActive(): boolean;
  isMatchActive(): boolean;
  getProjectiles(): SimProjectile[];
  getGrenades(): SimGrenade[];
  getPlayerState(id): PlayerGameState;
  // ...
}
```

**Offline**: `sendInput()` calls `authSim.processInput()` synchronously. Events are emitted immediately. All state is local.

**Online**: `sendInput()` sends a message to the server via WebSocket. The server processes input on its own `AuthoritativeSimulation` and broadcasts events + snapshots. The client predicts movement locally and reconciles with server acknowledgments.

This means any new game logic added to `AuthoritativeSimulation` works in both modes automatically.

---

## Event System

All state changes flow through `GameEvent`:

```
AuthoritativeSimulation
  -> returns GameEvent[]
  -> gameEventBus.emitAll(events)
  -> ClientRenderer.handleEvent(event)
  -> DOM / audio side effects
```

Event types (defined in `Net/GameEvent.ts`):

| Event              | Trigger                      | Renderer Effect                     |
|--------------------|------------------------------|--------------------------------------|
| BULLET_SPAWN       | Weapon fired                 | Acquire pool element, position it    |
| BULLET_REMOVED     | Bullet hit wall / out of bounds | Release pool element              |
| BULLET_HIT         | Bullet hit player            | Hit marker, damage number, flash     |
| PLAYER_DAMAGED     | Any damage source            | Health bar update, damage indicator   |
| PLAYER_KILLED      | Health reached 0             | Death effect, corpse marker, kill feed|
| PLAYER_RESPAWN     | Respawn timer elapsed        | Reset player element                 |
| GRENADE_SPAWN      | Grenade thrown               | Create grenade DOM element           |
| GRENADE_DETONATE   | Fuse expired / C4 triggered  | Explosion animation                  |
| GRENADE_BOUNCE     | Grenade hit wall             | Bounce sound                         |
| GRENADE_REMOVED    | Post-detonation cleanup      | Remove grenade DOM element           |
| EXPLOSION_HIT      | Player in blast radius       | Screen shake, damage                 |
| FLASH_EFFECT       | Flashbang detonation         | White overlay with fade              |
| SMOKE_DEPLOY       | Smoke grenade detonation     | Spawn smoke cloud                    |
| KILL_FEED          | Kill event                   | HUD kill feed entry                  |
| ROUND_START        | New round begins             | Clear corpses, reset state           |
| ROUND_END          | Round over                   | Show banner, update scoreboard       |
| RELOAD_START       | Player starts reloading      | Reload sound                         |
| RELOAD_COMPLETE    | Reload finished              | Update ammo count                    |
| FOOTSTEP           | Player moved                 | Footstep sound                       |

To add a new event: define its type in `Net/GameEvent.ts`, emit it from `AuthoritativeSimulation`, and handle it in `ClientRenderer`.

---

## How To: Add a New Weapon

1. **Define it** in `src/Combat/weapons.ts`:
   ```typescript
   // Add to WEAPON_DEFS
   LMG: {
     id: 'LMG',
     name: 'Light Machine Gun',
     damage: 18,
     fireRate: 80,        // ms between shots
     reloadTime: 4000,
     magSize: 100,
     bulletSpeed: 22,
     price: 4500,
     pellets: 1,
     spread: 4,
     cameraOffset: 60,
     recoilPattern: [{ x: 0, y: 1.5 }, { x: 0, y: 2 }, ...],
   }
   ```

2. **Add a sound** in `src/Audio/soundMap.ts` -- map `'LMG'` to an audio file.

3. **Allow it** in game modes -- add `'LMG'` to `allowedWeapons` in mode configs or `BASE_DEFAULTS`.

4. That's it. The simulation, rendering, buy menu, and AI weapon purchasing all read from `WEAPON_DEFS` dynamically.

## How To: Add a New Grenade Type

1. **Define it** in `src/Combat/grenades.ts` (add to `GRENADE_DEFS`).
2. **Add the type** to the `GrenadeType` union in `src/global.d.ts`.
3. **Handle detonation** in `src/simulation/gameSimulation.ts` `detonateGrenade()` -- add a case for the new type's effect.
4. **Add rendering** in `ClientRenderer` if it has a unique visual effect.
5. **Add a sound** in `soundMap.ts`.

## How To: Add a New Game Mode

1. **Add an entry** to `GAME_MODES` in `src/Config/modes/index.ts`:
   ```typescript
   { id: 'pistols', name: 'Pistols Only', partial: {
     weapons: { allowedWeapons: ['PISTOL'], startingWeapons: ['PISTOL'] },
     economy: { startingMoney: 0 },
   }}
   ```
2. The main menu reads from `GAME_MODES` automatically.

## How To: Add a New Map

1. **Create a map file** in `src/Maps/` (e.g. `warehouse.ts`) exporting a `MapData` object with `walls`, `teamSpawns`, and `patrolPoints`.
2. **Register it** in `src/Maps/helpers.ts` so `getActiveMap()` can resolve it.
3. Wall geometry is used for collision, raycasting, and rendering.

---

## Server Architecture (Online Multiplayer)

```
ws-server.ts
  |
  +-- rooms: Map<string, GameRoom>
  |     Rooms created on first player join, culled when empty.
  |
  +-- Global tick loop (16ms / 60hz)
        Calls room.tick() for every active room.

GameRoom
  |
  +-- phase: 'lobby' | 'starting' | 'playing'
  +-- players: Map<connId, RoomPlayer>
  +-- sim: AuthoritativeSimulation (same class as offline)
  |
  +-- onPlayerJoin()    Add to lobby or late-join into active game
  +-- onPlayerInput()   Route to sim.processInput()
  +-- onPlayerLeave()   Remove, reassign host, cull if empty
  +-- tick()            sim.tick() -> broadcast events + snapshots
```

**Message flow:**

```
Client                       Server
  |------ join (name) -------->|  onPlayerJoin()
  |                            |
  |<-------- welcome ----------|  (playerId, map, config, players)
  |                            |
  |<-------- lobby_state ------|  (player list, host, config)
  |                            |
  |------- start_game -------->|  startCountdown()
  |                            |
  |<-------- game_starting ----|  (3, 2, 1, 0)
  |                            |
  |---- input (MOVE/FIRE) ---->|  processGameInput()
  |                            |
  |<-------- events -----------|  (GameEvent[] batched per tick)
  |                            |
  |<-------- snapshot ---------|  (full state every 3 ticks)
  |                            |
  |<-------- input_ack --------|  (authoritative position for MOVE)
```

**Late joins:** A player joining during `phase === 'playing'` receives a `welcome` with the current player list and state snapshot. 

They spawn dead and enter the game at the next respawn or round start.

---

## Data Flow Diagram

```
 Keyboard/Mouse
       |
       v
 inputController.ts  (event listeners, grenade charge)
       |
       v
 gameLoop.ts  (collects input each frame)
       |
       v
 adapter.sendInput(PlayerInput)
       |
  +---------+---------------+
  |                         |
  v                         v
OfflineAdapter            WebSocketAdapter
  |                         |
  v                         v
AuthoritativeSimulation   Server (GameRoom + AuthSim)
  |                         |
  v                         v
GameEvent[]               WebSocket messages
  |                         |
  +----------+--------------+
             |
             v
       gameEventBus
             |
             v
      ClientRenderer
             |
      +------+------+
      |             |
      v             v
  DOM updates   Audio playback

 Per-frame rendering (not event-driven):
   gameLoop.ts -> renderPipeline.ts
                    |
       +------------+------------+
       |            |            |
       v            v            v
    Camera    Raycasting    Visibility
       |            |            |
       v            v            v
   scrollTo    clip-path    show/hide
```
