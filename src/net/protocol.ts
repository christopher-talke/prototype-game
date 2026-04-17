/**
 * Wire-format type definitions for client-server communication.
 *
 * Net layer - all messages are JSON-serialized over WebSocket. Every message
 * carries a version field (`v: 1`) for future protocol evolution. Types here
 * are consumed by {@link WebSocketAdapter} on the client and by the game
 * server's message handler.
 */

import type { GameEvent, PlayerInput } from '@net/gameEvent';
import type { GameModeConfig, DeepPartial } from '@config/types';
import type { MapData, WallType } from '@shared/map/MapData';

/**
 * Serializable map definition sent from server to client in the welcome
 * message, and from host to server via `set_map`. Walls, spawn points, and
 * patrol points are all expressed in world coordinates.
 */
export type MapJSON = {
    version?: 1;
    name?: string;
    width?: number;
    height?: number;
    teamSpawns: Record<number, { x: number; y: number }[]>;
    patrolPoints: { x: number; y: number }[];
    walls: { x: number; y: number; width: number; height: number; type?: WallType; }[];
};

/**
 * Flattens a v1.5 {@link MapData} config into the legacy flat wire format.
 * Used by the host when relaying its active map to the server and to other
 * clients. Server-side sim still expects AABB walls; Phase 2a replaces this
 * with a per-floor physics compiler on the server.
 */
export function mapDataToMapJSON(map: MapData): MapJSON {
    const walls: MapJSON['walls'] = [];
    for (const layer of map.layers) {
        if (layer.type !== 'collision' && layer.type !== 'ceiling' && layer.type !== 'object') continue;
        for (const w of layer.walls) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const v of w.vertices) {
                if (v.x < minX) minX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.x > maxX) maxX = v.x;
                if (v.y > maxY) maxY = v.y;
            }
            walls.push({ x: minX, y: minY, width: maxX - minX, height: maxY - minY, type: w.wallType });
        }
    }

    const teamSpawns: Record<number, { x: number; y: number }[]> = {};
    for (const zone of map.zones) {
        if (zone.type !== 'spawn' || zone.team === undefined) continue;
        const teamNum = Number(zone.team);
        if (!Number.isFinite(teamNum)) continue;
        let sx = 0, sy = 0;
        for (const p of zone.polygon) { sx += p.x; sy += p.y; }
        const n = zone.polygon.length || 1;
        const c = { x: sx / n, y: sy / n };
        if (!teamSpawns[teamNum]) teamSpawns[teamNum] = [];
        teamSpawns[teamNum].push(c);
    }

    const patrolPoints = map.navHints.filter((h) => h.type === 'cover').map((h) => ({ x: h.position.x, y: h.position.y }));

    return {
        version: 1,
        name: map.meta.name,
        width: map.bounds.width,
        height: map.bounds.height,
        teamSpawns,
        patrolPoints,
        walls,
    };
}

/**
 * Snapshot of a single player's state, sent inside server snapshots and the
 * welcome message. Contains everything the client needs to render or
 * reconcile the player: position, health, inventory, and team.
 */
export type PlayerSnapshot = {
    id: number;
    name: string;
    team: number;
    x: number;
    y: number;
    rotation: number;
    health: number;
    armour: number;
    dead: boolean;
    money: number;
    weapons: PlayerWeapon[];
    grenades: Record<GrenadeType, number>;
    /** When true the server has fog-of-war filtered this player's real position. */
    hidden?: boolean;
};

/**
 * Snapshot of a single projectile, included in server tick snapshots so the
 * client can correct client-predicted bullet positions.
 */
export type SimProjectileSnapshot = {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    damage: number;
    ownerId: number;
    weaponType?: string;
};

/**
 * Snapshot of a single grenade, included in server tick snapshots so the
 * client can correct client-predicted grenade positions.
 */
export type SimGrenadeSnapshot = {
    id: number;
    type: GrenadeType;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    ownerId: number;
    spawnTime: number;
    detonated: boolean;
};

/**
 * Lobby-phase representation of a connected player, used in the
 * `lobby_state` server message to populate the lobby UI.
 */
export type LobbyPlayer = {
    id: number;
    name: string;
    team: number;
    ready: boolean;
    isHost: boolean;
};

/**
 * Union of all messages the client can send to the server.
 * Discriminated on the `t` (type) field.
 */
export type ClientMessage =
    | { v: 1; t: 'join'; name: string }
    | { v: 1; t: 'input'; seq: number; input: PlayerInput }
    | { v: 1; t: 'leave' }
    | { v: 1; t: 'set_config'; config: DeepPartial<GameModeConfig> }
    | { v: 1; t: 'set_map'; mapName: string; mapJSON?: MapJSON }
    | { v: 1; t: 'move_player'; playerId: number; team: number }
    | { v: 1; t: 'start_game' }
    | { v: 1; t: 'ready'; ready: boolean };

/**
 * Union of all messages the server can send to a client.
 * Discriminated on the `t` (type) field.
 */
export type ServerMessage =
    | { v: 1; t: 'welcome'; playerId: number; mapData: MapJSON; config: GameModeConfig; players: PlayerSnapshot[]; isHost?: boolean; phase?: string; }
    | { v: 1; t: 'player_joined'; player: PlayerSnapshot }
    | { v: 1; t: 'player_left'; playerId: number }
    | { v: 1; t: 'events'; tick: number; events: GameEvent[] }
    | { v: 1; t: 'snapshot'; tick: number; players: PlayerSnapshot[]; projectiles: SimProjectileSnapshot[]; grenades: SimGrenadeSnapshot[]; timeRemaining: number; }
    | { v: 1; t: 'input_ack'; seq: number; x: number; y: number }
    | { v: 1; t: 'lobby_state'; host: number; players: LobbyPlayer[]; config: GameModeConfig; mapName: string; started: boolean; }
    | { v: 1; t: 'game_starting'; countdown: number };
