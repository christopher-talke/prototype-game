// @ts-nocheck
import { AuthoritativeSimulation } from '../src/Net/AuthoritativeSimulation.ts';
import { Arena } from '../src/Maps/arena.ts';
import { BASE_DEFAULTS } from '../src/Config/defaults.ts';
import { createDefaultWeapon } from '../src/Combat/weapons.ts';

type Connection = {
    id: string;
    send(message: string): void;
    close(): void;
};

type RoomPlayer = {
    id: number;
    name: string;
    team: number;
    ready: boolean;
    conn: Connection;
};

type Phase = 'lobby' | 'starting' | 'playing';

export class GameRoom {
    private sim: AuthoritativeSimulation;
    private players = new Map<string, RoomPlayer>();
    private tickId = 0;
    private lastSnapshotTick = 0;
    private nextPlayerId = 1;
    private hostConnId: string | null = null;
    private phase: Phase = 'lobby';
    private config = { ...BASE_DEFAULTS };
    private mapName = 'Arena';
    private countdownTimer: ReturnType<typeof setInterval> | null = null;
    private pendingEvents: any[] = [];

    constructor(sim?: AuthoritativeSimulation) {
        this.sim = sim ?? new AuthoritativeSimulation();
    }

    onPlayerJoin(conn: Connection, name: string): void {
        const id = this.nextPlayerId++;
        const team = id % 2 === 0 ? 2 : 1;

        const player: RoomPlayer = { id, name, team, ready: false, conn };
        this.players.set(conn.id, player);

        // First player becomes host
        if (!this.hostConnId) {
            this.hostConnId = conn.id;
        }

        if (this.phase === 'playing') {
            // Late join: add player to sim as dead, send full game state
            const spawns = Arena.teamSpawns[team] ?? Arena.teamSpawns[1];
            const spawn = spawns[(id - 1) % spawns.length];
            const playerInfo: player_info = {
                id,
                name,
                team,
                dead: true,
                health: 0,
                armour: 0,
                current_position: { x: spawn.x, y: spawn.y, rotation: 0 },
                weapons: [createDefaultWeapon()],
                grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
            };
            this.sim.addPlayer(playerInfo);

            // Send welcome with current player list
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
                    width: 3000,
                    height: 3000,
                    teamSpawns: Arena.teamSpawns,
                    patrolPoints: Arena.patrolPoints,
                    walls: Arena.walls.map((w) => ({ x: w.x, y: w.y, width: w.width, height: w.height, type: w.type })),
                },
                config: this.config,
                players: currentPlayers,
                isHost: false,
                phase: this.phase,
            }));

            // Notify existing players
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

        // Send welcome
        conn.send(JSON.stringify({
            v: 1,
            t: 'welcome',
            playerId: id,
            mapData: {
                version: 1,
                name: this.mapName,
                width: 3000,
                height: 3000,
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

    onPlayerInput(conn: Connection, msg: any): void {
        const player = this.players.get(conn.id);
        if (!player) return;

        switch (msg?.t) {
            case 'ready':
                if (this.phase === 'lobby') {
                    player.ready = !!msg.ready;
                    this.broadcastLobbyState();
                }
                break;

            case 'move_player':
                if (this.phase === 'lobby' && conn.id === this.hostConnId) {
                    const target = this.findPlayerById(msg.playerId);
                    if (target && (msg.team === 1 || msg.team === 2)) {
                        target.team = msg.team;
                        this.broadcastLobbyState();
                    }
                }
                break;

            case 'set_config':
                if (this.phase === 'lobby' && conn.id === this.hostConnId && msg.config) {
                    if (msg.config.match) {
                        if (typeof msg.config.match.roundsToWin === 'number') {
                            this.config.match.roundsToWin = Math.max(1, Math.min(30, msg.config.match.roundsToWin));
                        }
                        if (typeof msg.config.match.roundDuration === 'number') {
                            this.config.match.roundDuration = Math.max(20000, Math.min(1200000, msg.config.match.roundDuration));
                        }
                    }
                    this.broadcastLobbyState();
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

    onPlayerLeave(conn: Connection): void {
        const p = this.players.get(conn.id);
        this.players.delete(conn.id);
        if (!p) return;

        this.broadcast({ v: 1, t: 'player_left', playerId: p.id });

        // Reassign host if host left
        if (conn.id === this.hostConnId) {
            const first = this.players.values().next();
            this.hostConnId = first.done ? null : first.value.conn.id ? [...this.players.keys()][0] : null;
        }

        if (this.phase === 'lobby' || this.phase === 'starting') {
            this.broadcastLobbyState();
        }
    }

    isEmpty(): boolean {
        return this.players.size === 0;
    }

    destroy(): void {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

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
            this.broadcast({
                v: 1,
                t: 'snapshot',
                tick: this.tickId,
                players: this.sim
                    .getPlayers()
                    .map((p) => {
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
                    }),
                projectiles: this.sim.simulation.getProjectiles(),
                grenades: this.sim.simulation.getGrenades(),
                timeRemaining: this.sim.getMatchTimeRemaining(),
            });
        }
    }

    // ---- Private ----

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

    private beginGame(): void {
        console.log('[SERVER] beginGame called, players:', this.players.size);
        this.phase = 'playing';

        // Build sim players from lobby state
        const simPlayers: player_info[] = [];
        for (const p of this.players.values()) {
            const spawns = Arena.teamSpawns[p.team] ?? Arena.teamSpawns[1];
            const spawn = spawns[(p.id - 1) % spawns.length];
            simPlayers.push({
                id: p.id,
                name: p.name,
                team: p.team,
                dead: false,
                health: this.config.player.maxHealth,
                armour: this.config.player.startingArmor,
                current_position: { x: spawn.x, y: spawn.y, rotation: 0 },
                weapons: [createDefaultWeapon()],
                grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
            });
        }

        this.sim.setMap(
            Arena.walls.map((w) => ({ x: w.x, y: w.y, w: w.width, h: w.height })),
            { left: 0, right: 3000, top: 0, bottom: 3000 },
            Arena.walls.flatMap((w) => [
                { x1: w.x, y1: w.y, x2: w.x + w.width, y2: w.y },
                { x1: w.x + w.width, y1: w.y, x2: w.x + w.width, y2: w.y + w.height },
                { x1: w.x + w.width, y1: w.y + w.height, x2: w.x, y2: w.y + w.height },
                { x1: w.x, y1: w.y + w.height, x2: w.x, y2: w.y },
            ]),
            Arena.teamSpawns,
            Arena.patrolPoints,
        );
        this.sim.setPlayers(simPlayers);
        this.sim.initMatch(simPlayers.map((p) => p.id));

        const events = this.sim.startRound();
        console.log('[SERVER] startRound produced', events.length, 'events:', events.map(e => e.type));
        if (events.length > 0) {
            this.broadcast({ v: 1, t: 'events', tick: this.tickId, events });
        }
    }

    private processGameInput(conn: Connection, player: RoomPlayer, msg: any): void {
        const authoritativeInput = { ...msg.input, playerId: player.id };

        const events = this.sim.processInput(authoritativeInput, Date.now());
        if (events.length > 0) {
            this.pendingEvents.push(...events);
        }

        if (authoritativeInput.type === 'MOVE') {
            const local = this.sim.getPlayers().find((p) => p.id === player.id);
            if (local) {
                conn.send(JSON.stringify({ v: 1, t: 'input_ack', seq: msg.seq, x: local.current_position.x, y: local.current_position.y }));
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

    private broadcast(payload: unknown): void {
        const json = JSON.stringify(payload);
        for (const p of this.players.values()) {
            p.conn.send(json);
        }
    }
}
