# Implementation Plans: Multiplayer Migration & Map Editor



---



## Phase 1 -- Multiplayer Migration with Thin Network Gateway Adapters



### Context



The game already has a clean NetAdapter/GameSimulation/ClientRenderer/GameEvent architecture designed for this migration. `GameSimulation` is DOM-free, `ClientRenderer` is event-driven, and inputs flow through `NetAdapter.sendInput()`. The main gaps are:



1. `GameSimulation` only manages projectiles and grenades -- player movement, weapon fire, reloading, buying, and match state are handled in `OfflineAdapter` and scattered combat modules with DOM coupling.

2. `RoundEndEvent.teamWins` uses `Map<number, number>` which isn't JSON-serializable.

3. `THROW_GRENADE` input lacks aim direction -- it relies on the client's mouse position.



### Step 1: Consolidate game logic into AuthoritativeSimulation



Create `src/Net/AuthoritativeSimulation.ts` that wraps `GameSimulation` and absorbs all game-logic currently in `OfflineAdapter.sendInput()`, but without DOM deps.



**What moves in:**

- Player movement: call `moveWithCollision()` (already pure -- takes x, y, dx, dy, returns {x, y}). Pass `wallAABBs` and `limits` as constructor params so it doesn't import the environment singleton.

- Weapon fire: extract pure fire logic from `src/Combat/shooting.ts` (fire rate check, ammo decrement, recoil angle calc, bullet spawn) into a `processFireInput(player, timestamp)` method. Leave DOM-coupled parts (audio, muzzle flash) in ClientRenderer.

- Reload: pure timer tracking (set reloading flag, track start time, complete after reloadTime). Currently uses `setTimeout` in shooting.ts -- replace with tick-based check.

- Weapon switch: trivial -- set `active` flags on weapons array.

- Grenade throw: move direction calculation server-side. Add `aimDx`/`aimDy` fields to `THROW_GRENADE` input.

- Buy weapon/grenade: extract pure economy logic from `src/Combat/gameState.ts` (money check, deduct, add weapon/grenade).

- Match/round state: extract from `gameState.ts` into AuthoritativeSimulation. Round timer, kill tracking, round win conditions. Currently uses `setTimeout` for intermission -- replace with tick-based timers.



**Key files to modify:**

- `src/Net/GameEvent.ts:161` -- change `teamWins: Map<number, number>` to `teamWins: Record<number, number>`

- `src/Net/GameEvent.ts:180` -- add `aimDx: number; aimDy: number` to THROW_GRENADE input

- `src/Player/interactivity.ts` -- update THROW_GRENADE input construction to include aim direction

- `src/Combat/gameState.ts` -- extract pure logic, leave DOM-coupled UI updates as event handlers in ClientRenderer



**OfflineAdapter becomes thin:**

```typescript

class OfflineAdapter implements NetAdapter {

    private sim: AuthoritativeSimulation;



    sendInput(input: PlayerInput) {

        const events = this.sim.processInput(input);

        gameEventBus.emitAll(events);

    }



    tick(segments, players, timestamp) {

        const events = this.sim.tick(timestamp);

        gameEventBus.emitAll(events);

    }

}

```



### Step 2: Define message protocol



All messages are JSON with a `v` (version) field and `t` (type) field.



**Client -> Server:**

```typescript

type ClientMessage =

    | { v: 1; t: 'join'; name: string }

    | { v: 1; t: 'input'; seq: number; input: PlayerInput }

    | { v: 1; t: 'leave' };

```



**Server -> Client:**

```typescript

type ServerMessage =

    | { v: 1; t: 'welcome'; playerId: number; mapData: MapJSON; config: GameModeConfig; players: PlayerSnapshot[] }

    | { v: 1; t: 'player_joined'; player: PlayerSnapshot }

    | { v: 1; t: 'player_left'; playerId: number }

    | { v: 1; t: 'events'; tick: number; events: GameEvent[] }

    | { v: 1; t: 'snapshot'; tick: number; players: PlayerSnapshot[]; projectiles: SimProjectile[]; grenades: SimGrenade[] }

    | { v: 1; t: 'input_ack'; seq: number; x: number; y: number };



type PlayerSnapshot = {

    id: number; name: string; team: number;

    x: number; y: number; rotation: number;

    health: number; armour: number; dead: boolean;

};

```



- `events` sent every server tick (50ms / 20Hz) with that tick's GameEvents

- `snapshot` sent every ~500ms for full state reconciliation

- `input_ack` sent per movement input for client-side prediction reconciliation



### Step 3: Create WebSocketAdapter (client-side)



New file: `src/Net/WebSocketAdapter.ts`



```typescript

class WebSocketAdapter implements NetAdapter {

    readonly mode = 'online' as const;

    private ws: WebSocket;

    private inputSeq = 0;

    private pendingInputs: { seq: number; input: PlayerInput }[] = [];



    async connect(): Promise<void> { /* open WS, wait for 'welcome' */ }



    sendInput(input: PlayerInput) {

        const seq = this.inputSeq++;

        this.ws.send(JSON.stringify({ v: 1, t: 'input', seq, input }));

        // For MOVE inputs: apply locally (prediction) and buffer

        if (input.type === 'MOVE') {

            this.applyLocalPrediction(input);

            this.pendingInputs.push({ seq, input });

        }

    }



    // On 'input_ack': reconcile predicted position with server position

    // On 'events': emit to gameEventBus

    // On 'snapshot': update all remote player positions (interpolate)

}

```



**Client prediction strategy:**

- Movement only -- apply MOVE inputs locally, buffer with sequence number

- On `input_ack`, discard inputs up to acked seq, re-apply remaining from server position

- Fire, grenades, buy -- wait for server events (latency-tolerant actions)

- Remote players: interpolate between two most recent snapshot positions



### Step 4: Server-side GameRoom (shared logic)



New file: `server/GameRoom.ts` -- used by BOTH adapter targets.



```typescript

class GameRoom {

    private sim: AuthoritativeSimulation;

    private players: Map<string, { id: number; conn: Connection }>;

    private tickInterval: number; // 50ms (20Hz)



    onPlayerJoin(conn: Connection, name: string): void;

    onPlayerInput(conn: Connection, msg: ClientMessage): void;

    onPlayerLeave(conn: Connection): void;

    tick(): void; // run sim.tick(), broadcast events + periodic snapshots

}

```



`Connection` is an interface with `send(msg: string): void` and `close(): void` -- each adapter implements it.



### Step 5: WebSocket server adapter (Node.js)



New file: `server/ws-server.ts`



```typescript

import { WebSocketServer } from 'ws';

import { GameRoom } from './GameRoom';



const wss = new WebSocketServer({ port: 8080 });

const rooms = new Map<string, GameRoom>();



wss.on('connection', (ws, req) => {

    const roomId = parseRoomFromUrl(req.url);

    const room = rooms.get(roomId) ?? createRoom(roomId);

    // Wrap ws as Connection, call room.onPlayerJoin()

    ws.on('message', (data) => room.onPlayerInput(conn, JSON.parse(data)));

    ws.on('close', () => room.onPlayerLeave(conn));

});

```



~50 lines. Thin: just maps WebSocket events to GameRoom methods.



### Step 6: Cloudflare Workers + Durable Objects adapter



New file: `server/cf-worker.ts`



```typescript

export class GameRoomDO implements DurableObject {

    private room: GameRoom;

    private sessions = new Map<WebSocket, Connection>();



    async fetch(request: Request) {

        const { 0: client, 1: server } = new WebSocketPair();

        this.room ??= new GameRoom(/* config */);

        server.accept();

        // Wrap server WebSocket as Connection

        server.addEventListener('message', (e) => this.room.onPlayerInput(conn, JSON.parse(e.data)));

        server.addEventListener('close', () => this.room.onPlayerLeave(conn));

        this.room.onPlayerJoin(conn, name);

        return new Response(null, { status: 101, webSocket: client });

    }

}



export default {

    async fetch(request, env) {

        // Route /room/:id to Durable Object

        const id = env.GAME_ROOMS.idFromName(roomId);

        const stub = env.GAME_ROOMS.get(id);

        return stub.fetch(request);

    }

};

```



~40 lines. Thin: just maps Durable Object WebSocket to GameRoom.



### Step 7: Lobby / room management



**Room lifecycle:**

- Room created when host clicks "Create Room", destroyed when empty

- Client connects to `ws://host/room/{roomId}` (or `https://worker.dev/room/{roomId}` for CF)

- Main menu gets a "Multiplayer" option: create room (become host) or join room (enter code)

- No matchmaking -- room codes shared out-of-band

- `welcome` message includes current map, config, player list, and `isHost` flag



**Host screen (lobby phase):**

The first player to create a room is the host. While in lobby (before game starts), the host sees a config screen:



- **Player list:** Shows all connected players with their names and team assignments. Host can drag/click players between Team 1 and Team 2 (or Unassigned).

- **Game mode selector:** Dropdown/cards to pick game mode (reuses `GAME_MODES` from `src/Config/modes/index.ts`). Shows mode description and settings.

- **Config overrides:** Editable fields for key settings (round duration, rounds to win, friendly fire, starting money, respawn time). Non-host players cannot edit.

- **Map selector:** Pick from built-in maps or custom maps (loaded from localStorage via map editor).

- **Start button:** Only visible to host. Sends `start_game` message to server. Server validates and begins the match.



**Non-host player screen (lobby phase):**

- Sees the same player list and current config (read-only)

- "Ready" toggle button

- Waiting message until host starts



**Additional protocol messages:**



```typescript

// Client -> Server (host only)

| { v: 1; t: 'set_config'; config: Partial<GameModeConfig> }

| { v: 1; t: 'set_map'; mapName: string; mapJSON?: MapJSON }

| { v: 1; t: 'move_player'; playerId: number; team: number }

| { v: 1; t: 'start_game' }



// Client -> Server (any player)

| { v: 1; t: 'ready'; ready: boolean }



// Server -> Client

| { v: 1; t: 'lobby_state'; host: number; players: LobbyPlayer[]; config: GameModeConfig; mapName: string; started: boolean }

| { v: 1; t: 'game_starting'; countdown: number }



type LobbyPlayer = { id: number; name: string; team: number; ready: boolean; isHost: boolean };

```



- `lobby_state` broadcast whenever anything changes (player join/leave, config change, team move, ready toggle)

- Server validates that only the host can send `set_config`, `set_map`, `move_player`, `start_game`

- If host disconnects, host transfers to next player (by join order)



**Lobby UI location:** New file `src/Net/LobbyScreen.ts` -- renders as a DOM overlay (same pattern as MainMenu). Shown after connecting to a room, hidden when game starts.



### Step 8: Migration path



1. **Refactor first (no networking):** Create AuthoritativeSimulation, refactor OfflineAdapter to use it. Verify single-player still works identically.

2. **Add protocol types:** Define ClientMessage/ServerMessage types in shared `src/Net/Protocol.ts`.

3. **Build GameRoom:** Server-side room using AuthoritativeSimulation.

4. **Build WebSocketAdapter:** Client-side adapter with prediction.

5. **Build Node.js adapter:** Thin ws-server.ts.

6. **Build CF adapter:** Thin cf-worker.ts.

7. **Add multiplayer UI:** Room creation/join in main menu.



### New files



| File | Purpose | ~Lines |

|------|---------|--------|

| `src/Net/AuthoritativeSimulation.ts` | Consolidated server-runnable simulation | 200-250 |

| `src/Net/Protocol.ts` | Shared message type definitions | 50 |

| `src/Net/WebSocketAdapter.ts` | Client-side online adapter with prediction | 150 |

| `server/GameRoom.ts` | Shared server room logic | 150 |

| `server/ws-server.ts` | Node.js WebSocket thin adapter | 50 |

| `server/cf-worker.ts` | Cloudflare Workers thin adapter | 40 |

| `src/Net/LobbyScreen.ts` | Host/player lobby UI with config, teams, ready | 200 |



### Verification



- Single-player: run `pnpm dev`, play a match with bots. Movement, shooting, grenades, rounds, economy must work identically after AuthoritativeSimulation refactor.

- Multiplayer (Node.js): run `node server/ws-server.js`, open two browser tabs, verify both see each other move and shoot.

- Multiplayer (CF): deploy worker, open two tabs on different devices, verify gameplay.


---

## Old Notes for Multiplayer Migration, may be relevant for work


## Phase 6: Online Multiplayer Implementation

### Server

- Node.js + WebSocket (ws library)
- Runs `GameSimulation` as authority
- Receives `PlayerInput` from clients, validates, ticks simulation at fixed 60Hz
- Broadcasts `GameEvent[]` to all clients each tick
- Handles: connection, disconnection, late join (sends snapshot)
- AI runs server-side for online matches (clients only render)

### What stays client-only (never networked)

- FOV/raycast rendering (clip-path)
- Camera/viewport
- HUD rendering
- Audio playback
- Aim line visualization
- Last-known position markers
- Crosshair


---



## Phase 2 -- Map Editor with Exportable Config



### Context



Maps are hardcoded TypeScript (`src/Maps/arena.ts`). The `MapData` type is `{ teamSpawns: Record<number, coordinates[]>, patrolPoints: coordinates[], walls: wall_info[] }`. The game processes maps through `generateEnvironment()` which extracts wall segments and corners, and `createWall()` which builds DOM elements and registers collision AABBs. A map editor should export JSON matching this structure so the game can load custom maps alongside hardcoded ones.



### Step 1: Define MapJSON format



New file: `src/Maps/MapSchema.ts`



```typescript

type MapJSON = {

    version: 1;

    name: string;

    width: number;   // default 3000

    height: number;   // default 3000

    teamSpawns: Record<number, { x: number; y: number }[]>;

    patrolPoints: { x: number; y: number }[];

    walls: {

        x: number;

        y: number;

        width: number;

        height: number;

        type?: WallType;

    }[];

};



function validateMapJSON(json: unknown): { valid: boolean; errors: string[] };

function mapJSONToMapData(json: MapJSON): MapData;

```



- `version` field for forward compatibility

- `width`/`height` replace hardcoded `MAP_SIZE = 3000`

- Validation checks: walls within bounds, at least 1 spawn per team, no zero-size walls, spawns not inside walls



### Step 2: Game import support



Modify `src/Maps/helpers.ts`:



```typescript

const BUILTIN_MAPS: Record<string, MapData> = { Arena };

const customMaps: Record<string, MapData> = {};



export function loadCustomMap(json: MapJSON): string {

    const { valid, errors } = validateMapJSON(json);

    if (!valid) throw new Error(errors.join(', '));

    customMaps[json.name] = mapJSONToMapData(json);

    return json.name;

}



export function getMapNames(): string[] {

    return [...Object.keys(BUILTIN_MAPS), ...Object.keys(customMaps)];

}

```



Modify `src/Environment/environment.ts` and `src/constants.ts`: accept variable map size from MapData instead of hardcoded `MAP_SIZE = 3000`. Pass `width`/`height` from the active map to `generateEnvironment()` and use it for bounds.



### Step 3: Editor architecture and navigation



Separate Vite entry point: `editor.html` + `src/Editor/main.ts`.



Create `vite.config.ts` (doesn't exist yet):

```typescript

export default defineConfig({

    build: {

        rollupOptions: {

            input: {

                main: 'index.html',

                editor: 'editor.html',

            },

        },

    },

});

```



**Navigation between game and editor:**



The main menu (`src/MainMenu/MainMenu.ts`) already has a "Map Editor" button (line 93) with `disabled` class and "COMING SOON" tag. Changes:



1. Remove `disabled` class and "COMING SOON" tag from the Map Editor button

2. Give it an id: `id="btn-editor"`

3. Wire click handler in `wireEvents()`:

   ```typescript

   menuEl.querySelector('#btn-editor')?.addEventListener('click', () => {

       window.location.href = '/editor.html';

   });

   ```

4. In the editor's toolbar, add a "Back to Game" button that navigates to `/index.html` (or just `/`)



Also while we're at it, the "Online" button (line 88) should get an id `btn-online` and be wired up in Phase 1 (multiplayer). For now it stays disabled.



**Dev server:** Vite's dev server serves both entry points. `http://localhost:5173/` for the game, `http://localhost:5173/editor.html` for the editor. Navigation between them is a simple page navigation -- no SPA routing needed.



### Step 4: Editor UI and tools



**File structure:**

```

src/Editor/

    main.ts          -- Entry point, toolbar setup

    EditorState.ts   -- Map state, undo/redo stack

    Renderer.ts      -- DOM-based rendering (reuses game's wall styles)

    Tools.ts         -- Tool implementations (mouse event handlers)

    Toolbar.ts       -- HTML toolbar UI

    Export.ts        -- JSON export/import + validation

    editor.css       -- Editor-specific styles (toolbar, grid, handles)

```



**DOM-based rendering** -- matches the game's actual rendering output:

- Editor viewport is a positioned `<div>` with the same dimensions as the map (scrollable, zoomable via CSS `transform: scale()`)

- Walls rendered as `<div class="wall" data-wall-type="...">` using the same `wall.css` styles from the game -- true WYSIWYG

- Reuse `createWall()` rendering logic (or a stripped-down version without collision registration) so editor walls look identical to in-game walls

- CSS grid overlay via `background-image: repeating-linear-gradient` on the viewport (configurable: 10px, 25px, 50px)

- Spawn points as positioned `<div>` elements with team-colored styling

- Patrol points as positioned `<div>` markers

- Selected items get a CSS outline + absolute-positioned resize handle `<div>` elements at corners/edges



**Pan & zoom:**

- Scroll to pan (same as the game's `window.scrollTo` approach)

- Ctrl+scroll to zoom via CSS `transform: scale()` on the map container

- Minimap optional: small fixed `<div>` showing scaled-down wall layout



**Tools:**

| Tool | Behavior |

|------|----------|

| **Select** | Click wall/spawn `<div>` to select (event delegation). Drag to move via `transform` update. Corner handle divs for resize. Delete key to remove. |

| **Wall** | `mousedown` sets start point, `mousemove` shows preview div, `mouseup` creates wall div. Type picker in toolbar. Snaps to grid. |

| **Spawn** | Click on viewport to place spawn `<div>`. Team selector in toolbar. |

| **Patrol** | Click to place patrol point `<div>`. |

| **Erase** | Click any element to delete it. |



**EditorState:**

```typescript

class EditorState {

    walls: wall_info[] = [];

    teamSpawns: Record<number, coordinates[]> = { 1: [], 2: [] };

    patrolPoints: coordinates[] = [];

    mapWidth = 3000;

    mapHeight = 3000;

    mapName = 'Untitled';



    private undoStack: EditorAction[] = [];

    private redoStack: EditorAction[] = [];



    apply(action: EditorAction): void;  // push to undo, clear redo

    undo(): void;

    redo(): void;

}



type EditorAction =

    | { type: 'ADD_WALL'; wall: wall_info }

    | { type: 'REMOVE_WALL'; index: number; wall: wall_info }

    | { type: 'MOVE_WALL'; index: number; from: { x: number; y: number }; to: { x: number; y: number } }

    | { type: 'RESIZE_WALL'; index: number; from: wall_info; to: wall_info }

    | { type: 'ADD_SPAWN'; team: number; point: coordinates }

    | { type: 'REMOVE_SPAWN'; team: number; index: number; point: coordinates }

    | { type: 'ADD_PATROL'; point: coordinates }

    | { type: 'REMOVE_PATROL'; index: number; point: coordinates };

```



### Step 5: Export / import flow



**Export:**

- Toolbar "Export" button

- Runs `validateMapJSON()` -- shows errors inline if invalid

- On success: triggers JSON file download (`Blob` + `URL.createObjectURL`)



**Import:**

- Toolbar "Import" button with `<input type="file" accept=".json">`

- Parses JSON, validates with `validateMapJSON()`

- On success: loads into EditorState, re-renders canvas



**Auto-save to localStorage:**

- Editor auto-saves the current EditorState to `localStorage` on every change (debounced ~500ms)

- Key: `sightline-editor-maps` -- stores a `Record<string, MapJSON>` of all saved maps keyed by name

- Key: `sightline-editor-active` -- stores the name of the last-edited map

- On editor load: restore from localStorage if present, otherwise start with blank map

- Toolbar shows a "Maps" dropdown listing all saved maps, with options to rename, duplicate, or delete

- "New Map" button clears the editor and creates a fresh entry



**Quick test:**

- Toolbar "Test" button

- Stores the current MapJSON in `localStorage` under `sightline-editor-test`

- Opens game URL with `?customMap=1` query param

- Game checks for query param on load, reads from `sightline-editor-test` in localStorage, calls `loadCustomMap()`



**Export/Import still available:**

- "Export" downloads the JSON file (for sharing, backup, or use in multiplayer lobby)

- "Import" loads a JSON file into the editor and saves it to localStorage



### Step 6: Validation rules



**Errors (block export):**

- Map size < 500 or > 10000

- Any wall with width or height <= 0

- Any wall partially outside map bounds

- Fewer than 1 spawn point per team

- Any spawn point inside a wall



**Warnings (allow export, show in UI):**

- No patrol points defined

- Spawn points very close to map edge (< 50px)

- Very large number of walls (> 500) -- performance warning



### New files



| File | Purpose | ~Lines |

|------|---------|--------|

| `editor.html` | Editor entry HTML | 20 |

| `vite.config.ts` | Multi-page Vite config | 15 |

| `src/Maps/MapSchema.ts` | MapJSON type, validation, conversion | 80 |

| `src/Editor/main.ts` | Editor bootstrap | 50 |

| `src/Editor/EditorState.ts` | State + undo/redo | 100 |

| `src/Editor/Renderer.ts` | DOM-based rendering (reuses game wall styles) | 150 |

| `src/Editor/editor.css` | Editor-specific styles (toolbar, grid, handles) | 80 |

| `src/Editor/Tools.ts` | Tool implementations | 200 |

| `src/Editor/Toolbar.ts` | HTML toolbar | 80 |

| `src/Editor/Export.ts` | Import/export/validation UI | 60 |



### Files to modify



| File | Change |

|------|--------|

| `src/Maps/helpers.ts` | Add `loadCustomMap()`, split builtin vs custom maps |

| `src/constants.ts` | Make MAP_SIZE variable or accept from map data |

| `src/Environment/environment.ts` | Accept width/height params |

| `src/main.ts` | Check `?customMap` query param, load from localStorage |



### Verification



- Create a simple map in editor (4 boundary walls, 2 spawns per team, a few crates)

- Export JSON, verify it matches MapJSON schema

- Import JSON back into editor, verify round-trip fidelity

- Click "Test", verify game loads the custom map and plays correctly

- Load Arena in editor via import of its data, verify it renders correctly

