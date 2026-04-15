import { AuthoritativeSimulation } from '@simulation/authoritativeSimulation';
import { Arena } from '@maps/arena';
import { Shipment } from '@maps/shipment';
import { BASE_DEFAULTS } from '@config/defaults';
import { createDefaultWeapon } from '@simulation/combat/weapons';
import { PlayerStatus } from '@simulation/player/playerData';
import { isLineBlocked } from '@simulation/detection/rayGeometry';
import { HALF_HIT_BOX } from '../src/constants';
import type { GameEvent, PlayerInput } from '@simulation/events';

const MAX_NAME_LENGTH = 24;
const VALID_GRENADE_TYPES = ['FRAG', 'FLASH', 'SMOKE', 'C4'];
const VALID_INPUT_TYPES = [
    'MOVE', 'ROTATE', 'FIRE', 'STOP_FIRE', 'RELOAD',
    'SWITCH_WEAPON', 'THROW_GRENADE', 'DETONATE_C4',
    'BUY_WEAPON', 'BUY_GRENADE', 'BUY_HEALTH', 'BUY_ARMOR',
    'OPEN_BUY_MENU', 'CLOSE_BUY_MENU',
];

/**
 * Sanitizes a player-supplied name from untrusted input.
 *
 * Strips control characters and zero-width Unicode codepoints, trims whitespace,
 * and truncates to {@link MAX_NAME_LENGTH}. Falls back to `'Player'` when the
 * result would be empty.
 *
 * @param raw - The raw value received from the client (may be any type).
 * @returns A printable, length-capped display name.
 */
export function sanitizeName(raw: unknown): string {
    if (typeof raw !== 'string' || raw.trim().length === 0) return 'Player';
    // Strip control characters and zero-width chars, keep printable content
    const cleaned = raw.replace(/[\x00-\x1f\x7f\u200b-\u200f\u2028-\u202f\ufeff]/g, '').trim();
    if (cleaned.length === 0) return 'Player';
    return cleaned.slice(0, MAX_NAME_LENGTH);
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
}

/**
 * Validates and normalises a raw client message into a typed {@link PlayerInput}.
 *
 * Type-checks every field required by the input variant, clamps numeric ranges,
 * and whitelists enum strings. Returns `null` for any malformed or unrecognised
 * message so callers can safely discard it.
 *
 * @param msg - The parsed JSON object from the client.
 * @param playerId - The server-assigned numeric id to stamp onto the result.
 * @returns A validated {@link PlayerInput}, or `null` if the message is invalid.
 */
function validatePlayerInput(msg: Record<string, unknown>, playerId: number): PlayerInput | null {
    if (typeof msg !== 'object' || msg === null) return null;
    const type = msg.type;
    if (typeof type !== 'string' || !VALID_INPUT_TYPES.includes(type)) return null;

    switch (type) {
        case 'MOVE':
            if (typeof msg.dx !== 'number' || typeof msg.dy !== 'number') return null;
            return { type, playerId, dx: clamp(msg.dx, -1, 1), dy: clamp(msg.dy, -1, 1) };
        case 'ROTATE':
            if (typeof msg.rotation !== 'number') return null;
            return { type, playerId, rotation: msg.rotation % 360 };
        case 'FIRE':
        case 'STOP_FIRE':
            return { type, playerId, timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now() };
        case 'RELOAD':
        case 'DETONATE_C4':
        case 'BUY_HEALTH':
        case 'BUY_ARMOR':
        case 'OPEN_BUY_MENU':
        case 'CLOSE_BUY_MENU':
            return { type, playerId };
        case 'SWITCH_WEAPON':
            if (typeof msg.slotIndex !== 'number' || !Number.isInteger(msg.slotIndex)) return null;
            return { type, playerId, slotIndex: clamp(msg.slotIndex, 0, 9) };
        case 'THROW_GRENADE':
            if (typeof msg.grenadeType !== 'string' || !VALID_GRENADE_TYPES.includes(msg.grenadeType)) return null;
            if (typeof msg.chargePercent !== 'number' || typeof msg.aimDx !== 'number' || typeof msg.aimDy !== 'number') return null;
            return { type, playerId, grenadeType: msg.grenadeType as GrenadeType, chargePercent: clamp(msg.chargePercent, 0, 1), aimDx: clamp(msg.aimDx, -1, 1), aimDy: clamp(msg.aimDy, -1, 1) };
        case 'BUY_WEAPON':
            if (typeof msg.weaponType !== 'string' || msg.weaponType.length > 32) return null;
            return { type, playerId, weaponType: msg.weaponType };
        case 'BUY_GRENADE':
            if (typeof msg.grenadeType !== 'string' || !VALID_GRENADE_TYPES.includes(msg.grenadeType)) return null;
            return { type, playerId, grenadeType: msg.grenadeType as GrenadeType };
        default:
            return null;
    }
}

/** Minimal interface the room requires from a transport connection. */
type Connection = {
    id: string;
    send(message: string): void;
    close(): void;
};

/** Room-level player record combining lobby state with the active connection. */
type RoomPlayer = {
    id: number;
    name: string;
    team: number;
    ready: boolean;
    conn: Connection;
};

/** Lifecycle phase of a room. */
type Phase = 'lobby' | 'starting' | 'playing';

/**
 * Manages one multiplayer room from lobby formation through active gameplay.
 *
 * Owns the {@link AuthoritativeSimulation} instance, drives the tick loop,
 * validates player inputs, and broadcasts FOW-filtered snapshots. Lifecycle is
 * controlled by the WebSocket server: create the room, call {@link tick} from a
 * shared interval, and call {@link destroy} when the room becomes empty.
 *
 * Layer: server orchestration.
 */
export class GameRoom {
    private sim: AuthoritativeSimulation;
    private players = new Map<string, RoomPlayer>();
    private tickId = 0;
    private lastSnapshotTick = 0;
    private nextPlayerId = 1;
    private hostConnId: string | null = null;
    private phase: Phase = 'lobby';
    private config = { ...BASE_DEFAULTS };
    private mapName = 'arena';
    private countdownTimer: ReturnType<typeof setInterval> | null = null;
    private pendingEvents: GameEvent[] = [];
    private lastKnownPositions = new Map<string, { x: number; y: number; rotation: number }>();

    /**
     * @param sim - Optional pre-constructed simulation instance. Defaults to a
     *   new {@link AuthoritativeSimulation}.
     */
    constructor(sim?: AuthoritativeSimulation) {
        this.sim = sim ?? new AuthoritativeSimulation();
    }

    /**
     * Registers a new connection in the room.
     *
     * If the room is already in the `playing` phase the player is spawned
     * immediately into the running simulation; otherwise they enter the lobby.
     * The first connection becomes host.
     *
     * @param conn - The transport connection for this player.
     * @param name - Pre-sanitized display name.
     */
    onPlayerJoin(conn: Connection, name: string): void {
        const id = this.nextPlayerId++;
        const team = id % 2 === 0 ? 2 : 1;

        const player: RoomPlayer = { id, name, team, ready: false, conn };
        this.players.set(conn.id, player);

        if (!this.hostConnId) {
            this.hostConnId = conn.id;
        }

        if (this.phase === 'playing') {
            const spawns = Arena.teamSpawns[team] ?? Arena.teamSpawns[1];
            const spawn = spawns[(id - 1) % spawns.length];
            const playerInfo: player_info = {
                id,
                name,
                team,
                dead: true,
                health: 0,
                armour: 0,
                status: PlayerStatus.DEAD,
                current_position: { x: spawn.x, y: spawn.y, rotation: 0 },
                weapons: [createDefaultWeapon()],
                grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
            };
            this.sim.addPlayer(playerInfo);

            const currentPlayers = this.sim.getPlayers().map((p) => {
                const state = this.sim.getPlayerState(p.id);
                return {
                    id: p.id,
                    name: p.name,
                    team: p.team,
                    x: p.current_position.x,
                    y: p.current_position.y,
                    rotation: p.current_position.rotation,
                    health: p.health,
                    armour: p.armour,
                    dead: p.dead,
                    money: state?.money ?? 0,
                    weapons: p.weapons,
                    grenades: p.grenades,
                };
            });

            conn.send(JSON.stringify({
                v: 1,
                t: 'welcome',
                playerId: id,
                mapData: {
                    version: 1,
                    name: this.mapName,
                    width: this.getMapData().bounds?.width ?? 3000,
                    height: this.getMapData().bounds?.height ?? 3000,
                    teamSpawns: Arena.teamSpawns,
                    patrolPoints: Arena.patrolPoints,
                    walls: Arena.walls.map((w) => ({ x: w.x, y: w.y, width: w.width, height: w.height, type: w.type })),
                },
                config: this.config,
                players: currentPlayers,
                isHost: false,
                phase: this.phase,
            }));

            this.broadcast({ v: 1, t: 'player_joined', player: {
                id,
                name,
                team,
                x: spawn.x,
                y: spawn.y,
                rotation: 0,
                health: 0,
                armour: 0,
                dead: true,
                money: 0,
                weapons: playerInfo.weapons,
                grenades: playerInfo.grenades,
            } });
            return;
        }

        conn.send(JSON.stringify({
            v: 1,
            t: 'welcome',
            playerId: id,
            mapData: {
                version: 1,
                name: this.mapName,
                width: this.getMapData().bounds?.width ?? 3000,
                height: this.getMapData().bounds?.height ?? 3000,
                teamSpawns: Arena.teamSpawns,
                patrolPoints: Arena.patrolPoints,
                walls: Arena.walls.map((w) => ({ x: w.x, y: w.y, width: w.width, height: w.height, type: w.type })),
            },
            config: this.config,
            players: [],
            isHost: conn.id === this.hostConnId,
        }));

        // Broadcast lobby state to everyone
        this.broadcastLobbyState();
    }

    /**
     * Dispatches a lobby or in-game message from a connected player.
     *
     * Lobby messages (`ready`, `move_player`, `set_config`, `set_map`,
     * `start_game`) are host-gated where appropriate. The `input` type is only
     * processed during the `playing` phase and passes through
     * {@link validatePlayerInput} before being forwarded to the simulation.
     *
     * @param conn - The sender's connection.
     * @param msg - The parsed JSON message object.
     */
    onPlayerInput(conn: Connection, msg: Record<string, unknown>): void {
        const player = this.players.get(conn.id);
        if (!player) return;

        switch (msg.t) {
            case 'ready':
                if (this.phase === 'lobby') {
                    player.ready = !!msg.ready;
                    this.broadcastLobbyState();
                }
                break;

            case 'move_player':
                if (this.phase === 'lobby' && conn.id === this.hostConnId) {
                    const playerId = msg.playerId;
                    const team = msg.team;
                    if (typeof playerId !== 'number' || typeof team !== 'number') break;
                    const target = this.findPlayerById(playerId);
                    if (target && (team === 1 || team === 2)) {
                        target.team = team;
                        this.broadcastLobbyState();
                    }
                }
                break;

            case 'set_config':
                if (this.phase === 'lobby' && conn.id === this.hostConnId && msg.config) {
                    const config = msg.config as Record<string, unknown>;
                    const match = config.match as Record<string, unknown> | undefined;
                    if (match) {
                        if (typeof match.roundsToWin === 'number') {
                            this.config.match.roundsToWin = Math.max(1, Math.min(30, match.roundsToWin));
                        }
                        if (typeof match.roundDuration === 'number') {
                            this.config.match.roundDuration = Math.max(20000, Math.min(1200000, match.roundDuration));
                        }
                    }
                    this.broadcastLobbyState();
                }
                break;

            case 'set_map':
                if (this.phase === 'lobby' && conn.id === this.hostConnId) {
                    const mapName = msg.mapName;
                    if (typeof mapName !== 'string') break;
                    const valid = ['arena', 'shipment'];
                    if (valid.includes(mapName)) {
                        this.mapName = mapName;
                        this.broadcastLobbyState();
                    }
                }
                break;

            case 'start_game':
                console.log('[SERVER] start_game received. phase:', this.phase, 'isHost:', conn.id === this.hostConnId);
                if (this.phase === 'lobby' && conn.id === this.hostConnId) {
                    this.startCountdown();
                }
                break;

            case 'input':
                if (this.phase === 'playing' && msg.input) {
                    this.processGameInput(conn, player, msg);
                }
                break;
        }
    }

    /**
     * Removes a player from the room, cleaning up simulation state, last-known
     * positions, and host assignment.
     *
     * Broadcasts a `player_left` event and, if the room is still in lobby or
     * starting phase, re-broadcasts the updated lobby state.
     *
     * @param conn - The connection that disconnected.
     */
    onPlayerLeave(conn: Connection): void {
        const p = this.players.get(conn.id);
        this.players.delete(conn.id);
        if (!p) return;

        // Clean up last-known position entries for the departing player
        for (const key of this.lastKnownPositions.keys()) {
            if (key.startsWith(`${p.id}-`) || key.endsWith(`-${p.id}`)) {
                this.lastKnownPositions.delete(key);
            }
        }

        this.broadcast({ v: 1, t: 'player_left', playerId: p.id });

        // Reassign host if host left
        if (conn.id === this.hostConnId) {
            const first = this.players.keys().next();
            this.hostConnId = first.done ? null : first.value;
        }

        if (this.phase === 'lobby' || this.phase === 'starting') {
            this.broadcastLobbyState();
        }
    }

    /** Returns `true` when no connections remain in the room. */
    isEmpty(): boolean {
        return this.players.size === 0;
    }

    /** Cancels the countdown timer. Call before discarding the room. */
    destroy(): void {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    /**
     * Advances the simulation by one server tick.
     *
     * Collects events from the simulation, flushes them in a single broadcast,
     * and sends per-player FOW-filtered snapshots every 3 ticks (~48 ms at
     * 60 Hz). No-ops when the phase is not `playing`.
     *
     * @param now - Current epoch time in milliseconds. Defaults to `Date.now()`.
     */
    tick(now = Date.now()): void {
        if (this.phase !== 'playing') return;

        this.tickId++;
        const events = this.sim.tick(now);
        if (events.length > 0) {
            this.pendingEvents.push(...events);
        }

        // Flush all batched events in one message per tick
        if (this.pendingEvents.length > 0) {
            this.broadcast({ v: 1, t: 'events', tick: this.tickId, events: this.pendingEvents });
            this.pendingEvents = [];
        }

        if (this.tickId - this.lastSnapshotTick >= 3) {
            this.lastSnapshotTick = this.tickId;
            this.sendFilteredSnapshots();
        }
    }

    private startCountdown(): void {
        console.log('[SERVER] startCountdown called');
        this.phase = 'starting';
        let remaining = 3;

        this.broadcast({ v: 1, t: 'game_starting', countdown: remaining });

        this.countdownTimer = setInterval(() => {
            remaining--;
            this.broadcast({ v: 1, t: 'game_starting', countdown: remaining });

            if (remaining <= 0) {
                if (this.countdownTimer) clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                this.beginGame();
            }
        }, 1000);
    }

    private getMapData() {
        return this.mapName === 'shipment' ? Shipment : Arena;
    }

    /**
     * Transitions the room to the `playing` phase.
     *
     * Builds sim player records from lobby state, calls
     * {@link AuthoritativeSimulation.setMap} with wall geometry derived from
     * the selected map, initialises the match, and broadcasts the opening
     * round events to all connections.
     */
    private beginGame(): void {
        console.log('[SERVER] beginGame called, players:', this.players.size);
        this.phase = 'playing';

        const mapData = this.getMapData();

        // Build sim players from lobby state
        const simPlayers: player_info[] = [];
        for (const p of this.players.values()) {
            const spawns = mapData.teamSpawns[p.team] ?? mapData.teamSpawns[1];
            const spawn = spawns[(p.id - 1) % spawns.length];
            simPlayers.push({
                id: p.id,
                name: p.name,
                team: p.team,
                dead: false,
                health: this.config.player.maxHealth,
                armour: this.config.player.startingArmor,
                status: PlayerStatus.IDLE,
                current_position: { x: spawn.x, y: spawn.y, rotation: 0 },
                weapons: [createDefaultWeapon()],
                grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
            });
        }

        this.sim.setMap(
            mapData.walls.map((w) => ({ x: w.x, y: w.y, w: w.width, h: w.height })),
            { left: 0, right: mapData.bounds?.width ?? 3000, top: 0, bottom: mapData.bounds?.height ?? 3000 },
            mapData.walls.flatMap((w) => {
                const l = w.x, r = w.x + w.width, t = w.y, b = w.y + w.height;
                return [
                    { x1: l, y1: t, x2: r, y2: t, minX: l, minY: t, maxX: r, maxY: t },
                    { x1: r, y1: t, x2: r, y2: b, minX: r, minY: t, maxX: r, maxY: b },
                    { x1: r, y1: b, x2: l, y2: b, minX: l, minY: b, maxX: r, maxY: b },
                    { x1: l, y1: b, x2: l, y2: t, minX: l, minY: t, maxX: l, maxY: b },
                ];
            }),
            mapData.teamSpawns,
            mapData.patrolPoints,
        );
        this.sim.setPlayers(simPlayers);
        this.sim.initMatch(simPlayers.map((p) => p.id));
        this.lastKnownPositions.clear();

        const events = this.sim.startRound();
        console.log('[SERVER] startRound produced', events.length, 'events:', events.map(e => e.type));
        if (events.length > 0) {
            this.broadcast({ v: 1, t: 'events', tick: this.tickId, events });
        }
    }

    /**
     * Validates and applies a single in-game input message.
     *
     * Passes the raw input field through {@link validatePlayerInput}; discards
     * invalid messages silently. Acknowledges `MOVE` inputs to the sender with
     * an authoritative position correction.
     *
     * @param conn - The sender's connection (used for ACK).
     * @param player - The room player record for the sender.
     * @param msg - The full wrapper message containing the `input` field.
     */
    private processGameInput(conn: Connection, player: RoomPlayer, msg: Record<string, unknown>): void {
        const input = msg.input;
        if (typeof input !== 'object' || input === null) return;
        const authoritativeInput = validatePlayerInput(input as Record<string, unknown>, player.id);
        if (!authoritativeInput) return;

        const events = this.sim.processInput(authoritativeInput, Date.now());
        if (events.length > 0) {
            this.pendingEvents.push(...events);
        }

        if (authoritativeInput.type === 'MOVE') {
            const local = this.sim.getPlayers().find((p) => p.id === player.id);
            if (local) {
                const seq = typeof msg.seq === 'number' ? msg.seq : 0;
                conn.send(JSON.stringify({ v: 1, t: 'input_ack', seq, x: local.current_position.x, y: local.current_position.y }));
            }
        }
    }

    private broadcastLobbyState(): void {
        const host = this.hostConnId ? this.players.get(this.hostConnId) : null;
        const lobbyPlayers = [...this.players.values()].map((p) => ({
            id: p.id,
            name: p.name,
            team: p.team,
            ready: p.ready,
            isHost: p.conn.id === this.hostConnId,
        }));

        this.broadcast({
            v: 1,
            t: 'lobby_state',
            host: host?.id ?? 0,
            players: lobbyPlayers,
            config: this.config,
            mapName: this.mapName,
            started: this.phase !== 'lobby',
        });
    }

    private findPlayerById(id: number): RoomPlayer | undefined {
        for (const p of this.players.values()) {
            if (p.id === id) return p;
        }
        return undefined;
    }

    /**
     * Builds and sends a per-receiver FOW-filtered snapshot to every connected
     * player.
     *
     * For each receiver, enemy players that are not in line-of-sight have their
     * health, weapons, and money stripped and their last-known position
     * substituted. Projectiles and grenades owned by the enemy team are
     * similarly culled unless they are within LOS. Dead players and observers
     * always receive full data (spectating rules).
     */
    private sendFilteredSnapshots(): void {
        const allPlayers = this.sim.getPlayers();
        const segments = this.sim.getSegments();
        const allProjectiles = this.sim.simulation.getProjectiles();
        const allGrenades = this.sim.simulation.getGrenades();
        const timeRemaining = this.sim.getMatchTimeRemaining();

        // Build player_info lookup by id
        const playerById = new Map<number, player_info>();
        for (const p of allPlayers) playerById.set(p.id, p);

        // Pre-compute full snapshots
        const fullSnapshots = allPlayers.map((p) => {
            const state = this.sim.getPlayerState(p.id);
            return {
                id: p.id,
                name: p.name,
                team: p.team,
                x: p.current_position.x,
                y: p.current_position.y,
                rotation: p.current_position.rotation,
                health: p.health,
                armour: p.armour,
                dead: p.dead,
                money: state?.money ?? 0,
                weapons: p.weapons,
                grenades: p.grenades,
            };
        });

        for (const receiver of this.players.values()) {
            const observer = playerById.get(receiver.id);
            if (!observer) continue;

            const filteredPlayers = fullSnapshots.map(snapshot => {
                // Self: always full data
                if (snapshot.id === receiver.id) return snapshot;

                const target = playerById.get(snapshot.id);
                if (!target) return snapshot;

                // Same team: always full data
                if (target.team === observer.team) return snapshot;

                // Dead targets: always visible (no competitive info to leak)
                if (snapshot.dead) return snapshot;

                // Dead observers: full data (spectating)
                if (observer.dead) return snapshot;

                const key = `${observer.id}-${target.id}`;
                const canSee = this.canPlayerSee(observer, target);

                if (canSee) {
                    this.lastKnownPositions.set(key, {
                        x: snapshot.x,
                        y: snapshot.y,
                        rotation: snapshot.rotation,
                    });
                    return snapshot;
                }

                // Not visible: send last-known position, strip sensitive data
                const lastKnown = this.lastKnownPositions.get(key);
                return {
                    id: snapshot.id,
                    name: snapshot.name,
                    team: snapshot.team,
                    x: lastKnown?.x ?? snapshot.x,
                    y: lastKnown?.y ?? snapshot.y,
                    rotation: lastKnown?.rotation ?? snapshot.rotation,
                    health: 0,
                    armour: 0,
                    dead: false,
                    money: 0,
                    weapons: [] as PlayerWeapon[],
                    grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 } as Record<GrenadeType, number>,
                    hidden: true,
                };
            });

            // Filter projectiles: include if owned by same team or within LOS
            const ox = observer.current_position.x + HALF_HIT_BOX;
            const oy = observer.current_position.y + HALF_HIT_BOX;

            const filteredProjectiles = observer.dead ? allProjectiles : allProjectiles.filter(proj => {
                const owner = playerById.get(proj.ownerId);
                if (owner && owner.team === observer.team) return true;
                return !isLineBlocked(ox, oy, proj.x, proj.y, segments);
            });

            const filteredGrenades = observer.dead ? allGrenades : allGrenades.filter(g => {
                const owner = playerById.get(g.ownerId);
                if (owner && owner.team === observer.team) return true;
                return !isLineBlocked(ox, oy, g.x, g.y, segments);
            });

            receiver.conn.send(JSON.stringify({
                v: 1,
                t: 'snapshot',
                tick: this.tickId,
                players: filteredPlayers,
                projectiles: filteredProjectiles,
                grenades: filteredGrenades,
                timeRemaining,
            }));
        }
    }

    /**
     * Returns `true` when `observer` has an unobstructed line of sight to
     * `target`.
     *
     * Dead observers always return `false` (they cannot spot enemies).
     * Uses center-of-hitbox positions for both parties.
     *
     * @param observer - The player performing the visibility check.
     * @param target - The player being checked.
     */
    private canPlayerSee(observer: player_info, target: player_info): boolean {
        if (observer.dead) return false;
        const segments = this.sim.getSegments();
        const ox = observer.current_position.x + HALF_HIT_BOX;
        const oy = observer.current_position.y + HALF_HIT_BOX;
        const tx = target.current_position.x + HALF_HIT_BOX;
        const ty = target.current_position.y + HALF_HIT_BOX;
        return !isLineBlocked(ox, oy, tx, ty, segments);
    }

    /**
     * Serialises `payload` to JSON and sends it to every connected player.
     *
     * @param payload - Any JSON-serialisable value.
     */
    private broadcast(payload: unknown): void {
        const json = JSON.stringify(payload);
        for (const p of this.players.values()) {
            p.conn.send(json);
        }
    }
}
