// @ts-nocheck
import { AuthoritativeSimulation } from '../src/Net/AuthoritativeSimulation.ts';
import { Arena } from '../src/Maps/arena.ts';
import { BASE_DEFAULTS } from '../src/Config/defaults.ts';
import { createDefaultWeapon } from '../src/Combat/weapons.ts';

export type Connection = {
    id: string;
    send(message: string): void;
    close(): void;
};

export class GameRoom {
    private sim: AuthoritativeSimulation;
    private players = new Map<string, { id: number; name: string; conn: Connection }>();
    private simPlayers: player_info[] = [];
    private tickId = 0;
    private lastSnapshotTick = 0;
    private nextPlayerId = 1;

    constructor(sim?: AuthoritativeSimulation) {
        this.sim = sim ?? new AuthoritativeSimulation();
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
    }

    onPlayerJoin(conn: Connection, name: string): void {
        const id = this.nextPlayerId++;
        this.players.set(conn.id, { id, name, conn });

        const team = id % 2 === 0 ? 2 : 1;
        const spawns = Arena.teamSpawns[team] ?? Arena.teamSpawns[1];
        const spawn = spawns[(id - 1) % spawns.length];

        const newPlayer: player_info = {
            id,
            name,
            team,
            dead: false,
            health: BASE_DEFAULTS.player.maxHealth,
            armour: BASE_DEFAULTS.player.startingArmor,
            current_position: {
                x: spawn.x,
                y: spawn.y,
                rotation: 0,
            },
            weapons: [createDefaultWeapon()],
            grenades: { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 },
        };

        this.simPlayers.push(newPlayer);
        this.sim.setPlayers(this.simPlayers);
        this.sim.initMatch(this.simPlayers.map((p) => p.id));

        conn.send(
            JSON.stringify({
                v: 1,
                t: 'welcome',
                playerId: id,
                mapData: {
                    version: 1,
                    name: 'Arena',
                    width: 3000,
                    height: 3000,
                    teamSpawns: Arena.teamSpawns,
                    patrolPoints: Arena.patrolPoints,
                    walls: Arena.walls.map((w) => ({ x: w.x, y: w.y, width: w.width, height: w.height, type: w.type })),
                },
                config: BASE_DEFAULTS,
                players: this.simPlayers.map((p) => ({
                    id: p.id,
                    name: p.name,
                    team: p.team,
                    x: p.current_position.x,
                    y: p.current_position.y,
                    rotation: p.current_position.rotation,
                    health: p.health,
                    armour: p.armour,
                    dead: p.dead,
                })),
            }),
        );

        this.broadcast({
            v: 1,
            t: 'player_joined',
            player: {
                id: newPlayer.id,
                name: newPlayer.name,
                team: newPlayer.team,
                x: newPlayer.current_position.x,
                y: newPlayer.current_position.y,
                rotation: newPlayer.current_position.rotation,
                health: newPlayer.health,
                armour: newPlayer.armour,
                dead: newPlayer.dead,
            },
        });
    }

    onPlayerInput(conn: Connection, msg: any): void {
        const player = this.players.get(conn.id);
        if (!player) return;
        if (msg?.t !== 'input' || !msg.input) return;

        const authoritativeInput = { ...msg.input, playerId: player.id };

        const events = this.sim.processInput(authoritativeInput, Date.now());
        if (events.length > 0) {
            this.broadcast({ v: 1, t: 'events', tick: this.tickId, events });
        }

        if (authoritativeInput.type === 'MOVE') {
            const local = this.sim.getPlayers().find((p) => p.id === player.id);
            if (local) {
                conn.send(JSON.stringify({ v: 1, t: 'input_ack', seq: msg.seq, x: local.current_position.x, y: local.current_position.y }));
            }
        }
    }

    onPlayerLeave(conn: Connection): void {
        const p = this.players.get(conn.id);
        this.players.delete(conn.id);
        if (!p) return;

        this.simPlayers = this.simPlayers.filter((sp) => sp.id !== p.id);
        this.sim.setPlayers(this.simPlayers);
        this.sim.initMatch(this.simPlayers.map((sp) => sp.id));

        this.broadcast({ v: 1, t: 'player_left', playerId: p.id });
    }

    tick(now = Date.now()): void {
        this.tickId++;
        const events = this.sim.tick(now);
        if (events.length > 0) {
            this.broadcast({ v: 1, t: 'events', tick: this.tickId, events });
        }

        if (this.tickId - this.lastSnapshotTick >= 10) {
            this.lastSnapshotTick = this.tickId;
            this.broadcast({
                v: 1,
                t: 'snapshot',
                tick: this.tickId,
                players: this.sim
                    .getPlayers()
                    .map((p) => ({
                        id: p.id,
                        name: p.name,
                        team: p.team,
                        x: p.current_position.x,
                        y: p.current_position.y,
                        rotation: p.current_position.rotation,
                        health: p.health,
                        armour: p.armour,
                        dead: p.dead,
                    })),
                projectiles: this.sim.simulation.getProjectiles(),
                grenades: this.sim.simulation.getGrenades(),
            });
        }
    }

    private broadcast(payload: unknown): void {
        const json = JSON.stringify(payload);
        for (const p of this.players.values()) {
            p.conn.send(json);
        }
    }
}
