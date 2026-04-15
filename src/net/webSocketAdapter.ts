/**
 * Online adapter - connects to a remote authoritative server over WebSocket.
 *
 * Net layer - implements {@link NetAdapter} with client-side prediction,
 * server reconciliation, remote player interpolation, and input throttling.
 * Projectiles and grenades are predicted locally and corrected by server
 * snapshots each tick.
 */

import type { NetAdapter } from '@net/netAdapter';
import type { EventHandler, GameEvent, PlayerInput } from '@net/gameEvent';
import type { ClientMessage, ServerMessage, PlayerSnapshot } from '@net/protocol';
import { gameEventBus } from './gameEvent';
import { getPlayerInfo, getAllPlayers } from '@simulation/player/playerRegistry';

import { getConfig } from '@config/activeConfig';
import { setLocalPlayerId, updateLobbyState, showCountdown, hideLobbyScreen } from '@ui/lobby/lobbyScreen';
import { setActiveMap } from '@maps/helpers';
import type { DeepPartial, GameModeConfig } from '@config/types';
import { moveWithCollisionPure, getWallAABBs } from '@simulation/player/collision';
import { environment } from '@simulation/environment/environment';
import { addSmokeData } from '@simulation/combat/smokeData';

/** An input awaiting server acknowledgement, keyed by sequence number. */
type PendingInput = { seq: number; input: PlayerInput };

/** Client-predicted bullet state for rendering between server snapshots. */
type LocalBullet = { id: number; x: number; y: number; dx: number; dy: number; speed: number };

/** Client-predicted grenade state for rendering between server snapshots. */
type LocalGrenade = { id: number; x: number; y: number; dx: number; dy: number; speed: number; detonated: boolean };

/** Target position/rotation for interpolating a remote player. */
type InterpTarget = { x: number; y: number; rotation: number };

/** Max rate for sending MOVE inputs - matches the 60 fps frame rate. */
const MOVE_SEND_INTERVAL = 1000 / 60;

/**
 * WebSocket-based implementation of {@link NetAdapter}.
 *
 * Handles the full online lifecycle: connection, lobby actions, game-start
 * signaling, input sending with throttling, client-side movement prediction,
 * server reconciliation via input_ack, remote player interpolation, and
 * local projectile/grenade prediction corrected by server snapshots.
 */
class WebSocketAdapter implements NetAdapter {
    readonly mode = 'online' as const;

    private ws: WebSocket | null = null;
    private inputSeq = 0;
    private pendingInputs: PendingInput[] = [];
    private localPlayerId: number | null = null;
    private connected = false;
    private _roundActive = false;
    private _matchActive = false;
    private _matchTimeRemaining = 0;
    private _playerStates = new Map<number, PlayerGameState>();
    private _teamRoundWins: Record<number, number> = {};
    private _currentRound = 0;
    private _onGameStart: (() => void) | null = null;

    private _localBullets = new Map<number, LocalBullet>();
    private _localGrenades = new Map<number, LocalGrenade>();

    private _interpTargets = new Map<number, InterpTarget>();

    private _lastMoveSendTime = 0;
    private _pendingMove: { dx: number; dy: number } | null = null;

    private _lastRotationSendTime = 0;
    private _pendingRotation: number | null = null;

    private _reconTarget: { x: number; y: number } | null = null;

    private _lateJoinPlayers: PlayerSnapshot[] | null = null;

    /**
     * Register a callback that fires once when the server signals game start.
     * @param cb - Callback to invoke, or null to clear.
     */
    set onGameStart(cb: (() => void) | null) {
        this._onGameStart = cb;
    }

    /**
     * Opens a WebSocket connection and sends a join message.
     * Resolves once the server responds with a welcome message.
     * @param url - WebSocket server URL.
     * @param name - Display name for this player.
     */
    async connect(url = 'ws://localhost:8080/room/local', name = 'Player'): Promise<void> {
        if (this.connected) return;

        await new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(url);
            this.ws = ws;

            ws.addEventListener('open', () => {
                const joinMsg: ClientMessage = { v: 1, t: 'join', name };
                ws.send(JSON.stringify(joinMsg));
            });

            ws.addEventListener('message', (event) => {
                this.handleMessage(event.data);
                if (this.connected) {
                    resolve();
                }
            });

            ws.addEventListener('close', () => {
                this.connected = false;
                this.pendingInputs = [];
                this.localPlayerId = null;
            });

            ws.addEventListener('error', () => {
                reject(new Error('WebSocket connection failed'));
            });
        });
    }

    /** Sends a leave message, closes the socket, and resets all local state. */
    disconnect(): void {
        if (!this.ws) return;
        if (this.ws.readyState === WebSocket.OPEN) {
            const leaveMsg: ClientMessage = { v: 1, t: 'leave' };
            this.ws.send(JSON.stringify(leaveMsg));
        }
        this.ws.close();
        this.ws = null;
        this.connected = false;
        this.pendingInputs = [];
        this.localPlayerId = null;
        this._playerStates.clear();
        this._teamRoundWins = {};
        this._currentRound = 0;
        this._roundActive = false;
        this._matchActive = false;
        this._localBullets.clear();
        this._localGrenades.clear();
        this._interpTargets.clear();
        this._pendingMove = null;
        this._lateJoinPlayers = null;
    }

    /** Returns the server-assigned player ID, or null before welcome. */
    getLocalPlayerId(): number | null {
        return this.localPlayerId;
    }

    /**
     * Returns and consumes the late-join player snapshot array.
     * Non-null only when the client joined a match already in progress.
     * @returns Player snapshots, or null if none are pending.
     */
    getLateJoinPlayers(): PlayerSnapshot[] | null {
        const data = this._lateJoinPlayers;
        this._lateJoinPlayers = null;
        return data;
    }

    /**
     * Callback invoked when a new player joins the room.
     * Set by the orchestration layer to spawn the player's visual.
     */
    onPlayerJoined: ((player: PlayerSnapshot) => void) | null = null;

    /**
     * Returns an existing PlayerGameState or creates a zeroed one.
     * @param playerId - Player to look up or create state for.
     */
    private ensurePlayerState(playerId: number): PlayerGameState {
        let state = this._playerStates.get(playerId);
        if (!state) {
            state = { playerId, kills: 0, deaths: 0, money: 0, points: 0 };
            this._playerStates.set(playerId, state);
        }
        return state;
    }

    /** @inheritdoc */
    onEvent(callback: EventHandler): void {
        gameEventBus.subscribe(callback);
    }

    /**
     * Sends an input to the server. MOVE and ROTATE inputs are throttled -
     * they are buffered and flushed in {@link tick}. Other input types are
     * sent immediately with a sequence number.
     * @param input - The player input to send.
     */
    sendInput(input: PlayerInput): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        if (input.type === 'MOVE') {
            this.applyLocalPrediction(input);
            this._pendingMove = { dx: input.dx, dy: input.dy };
            return;
        }

        if (input.type === 'ROTATE') {
            this._pendingRotation = input.rotation;
            return;
        }

        const seq = this.inputSeq++;
        const msg: ClientMessage = { v: 1, t: 'input', seq, input };
        this.ws.send(JSON.stringify(msg));
    }

    /**
     * Per-frame update. Flushes throttled move/rotation inputs, advances
     * client-predicted projectiles and grenades, smooths the local player
     * toward the reconciled position, and interpolates remote players.
     * @param _segments - Unused (wall segments provided by environment).
     * @param _players - Unused (players accessed via registry).
     * @param _timestamp - Unused (timing handled internally).
     */
    tick(_segments: WallSegment[], _players: player_info[], _timestamp: number): void {
        if (this._pendingMove && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const now = performance.now();
            if (now - this._lastMoveSendTime >= MOVE_SEND_INTERVAL) {
                this._lastMoveSendTime = now;
                const id = this.localPlayerId ?? 0;
                const seq = this.inputSeq++;
                const moveInput: PlayerInput = { type: 'MOVE', playerId: id, dx: this._pendingMove.dx, dy: this._pendingMove.dy };
                const msg: ClientMessage = { v: 1, t: 'input', seq, input: moveInput };
                this.ws.send(JSON.stringify(msg));
                this.pendingInputs.push({ seq, input: moveInput });
                this._pendingMove = null;
            }
        }

        if (this._pendingRotation !== null && this.ws && this.ws.readyState === WebSocket.OPEN) {
            const now = performance.now();
            if (now - this._lastRotationSendTime >= MOVE_SEND_INTERVAL) {
                this._lastRotationSendTime = now;
                const id = this.localPlayerId ?? 0;
                const seq = this.inputSeq++;
                const rotInput: PlayerInput = { type: 'ROTATE', playerId: id, rotation: this._pendingRotation };
                const msg: ClientMessage = { v: 1, t: 'input', seq, input: rotInput };
                this.ws.send(JSON.stringify(msg));
                this._pendingRotation = null;
            }
        }

        for (const [id, b] of this._localBullets) {
            b.x += b.dx * b.speed;
            b.y += b.dy * b.speed;
            if (b.x < 0 || b.x > environment.limits.right || b.y < 0 || b.y > environment.limits.bottom) {
                this._localBullets.delete(id);
            }
        }

        const friction = getConfig().physics.grenadeFriction;
        for (const [, g] of this._localGrenades) {
            if (g.detonated) continue;
            g.x += g.dx * g.speed;
            g.y += g.dy * g.speed;
            g.speed *= friction;
            if (g.speed < 0.3) g.speed = 0;
        }

        if (this._reconTarget && this.localPlayerId !== null) {
            const player = getPlayerInfo(this.localPlayerId);
            if (player) {
                const dx = this._reconTarget.x - player.current_position.x;
                const dy = this._reconTarget.y - player.current_position.y;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                    player.current_position.x = this._reconTarget.x;
                    player.current_position.y = this._reconTarget.y;
                    this._reconTarget = null;
                }

                else {
                    player.current_position.x += dx * 0.3;
                    player.current_position.y += dy * 0.3;
                }
            }
        }

        for (const [playerId, target] of this._interpTargets) {
            if (playerId === this.localPlayerId) continue;

            const player = getPlayerInfo(playerId);
            if (!player) continue;

            const dx = target.x - player.current_position.x;
            const dy = target.y - player.current_position.y;
            const dr = this.angleLerp(player.current_position.rotation, target.rotation, 1);

            if (dx * dx + dy * dy < 0.01 && dr * dr < 0.01) continue;
            const lerpFactor = 0.5;

            player.current_position.x += dx * lerpFactor;
            player.current_position.y += dy * lerpFactor;
            player.current_position.rotation += dr * lerpFactor;
        }
    }

    /**
     * Returns the shortest-arc angular difference scaled by t.
     * @param current - Current angle in degrees.
     * @param target - Target angle in degrees.
     * @param t - Interpolation factor (0-1).
     */
    private angleLerp(current: number, target: number, t: number): number {
        let diff = target - current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return diff * t;
    }

    /** @inheritdoc */
    isRoundActive(): boolean {
        return this._roundActive;
    }

    /** @inheritdoc */
    isMatchActive(): boolean {
        return this._matchActive;
    }

    /** @inheritdoc */
    getMatchTimeRemaining(): number {
        return this._matchTimeRemaining;
    }

    /** @inheritdoc */
    getPlayerState(playerId: number): PlayerGameState | undefined {
        return this._playerStates.get(playerId);
    }

    /** @inheritdoc */
    getAllPlayerStates(): PlayerGameState[] {
        return [...this._playerStates.values()];
    }

    /** @inheritdoc */
    getTeamRoundWins(): Record<number, number> {
        return { ...this._teamRoundWins };
    }

    /** @inheritdoc */
    getCurrentRound(): number {
        return this._currentRound;
    }

    /** @inheritdoc */
    getProjectiles() {
        return [...this._localBullets.values()];
    }

    /** @inheritdoc */
    getGrenades() {
        return [...this._localGrenades.values()];
    }

    /** @inheritdoc */
    getConsecutiveShots(_playerId: number): number {
        return 0;
    }

    /**
     * Sends a ready-state toggle to the server.
     * @param ready - Whether this player is ready to start.
     */
    sendReady(ready: boolean): void {
        this.send({ v: 1, t: 'ready', ready });
    }

    /**
     * Asks the server to move a player to a different team in the lobby.
     * @param playerId - Player to move.
     * @param team - Target team number.
     */
    sendMovePlayer(playerId: number, team: number): void {
        this.send({ v: 1, t: 'move_player', playerId, team });
    }

    /**
     * Sends updated game mode configuration overrides to the server.
     * @param config - Partial config to merge on the server.
     */
    sendSetConfig(config: DeepPartial<GameModeConfig>): void {
        this.send({ v: 1, t: 'set_config', config });
    }

    /**
     * Tells the server to switch to a different map.
     * @param mapName - Map identifier to load.
     */
    sendSetMap(mapName: string): void {
        this.send({ v: 1, t: 'set_map', mapName });
    }

    /** Tells the server the host wants to start the game. */
    sendStartGame(): void {
        this.send({ v: 1, t: 'start_game' });
    }

    /**
     * Sends a message to the server if the socket is open.
     * @param msg - Fully formed client message.
     */
    private send(msg: ClientMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    /**
     * Parses and dispatches a raw server message by type.
     * Handles welcome, events, input_ack, snapshot, lobby_state,
     * game_starting, player_joined, and player_left.
     * @param raw - Raw data from the WebSocket message event.
     */
    private handleMessage(raw: unknown): void {
        const text = typeof raw === 'string' ? raw : String(raw);
        let msg: ServerMessage;
        try {
            msg = JSON.parse(text) as ServerMessage;
        }
        catch {
            return;
        }

        switch (msg.t) {
            case 'welcome':
                this.connected = true;
                this.localPlayerId = msg.playerId;
                setLocalPlayerId(msg.playerId);
                if ((msg as any).phase === 'playing' && msg.players.length > 0) {
                    this._lateJoinPlayers = msg.players;
                    this._matchActive = true;
                    this._roundActive = true;
                    hideLobbyScreen();
                    if (this._onGameStart) {
                        this._onGameStart();
                        this._onGameStart = null;
                    }
                }
                break;
            case 'events':
                console.log('[CLIENT] events received:', msg.events.length, msg.events.map((e: any) => e.type));
                this.eventHandler(msg.events);
                break;
            case 'input_ack':
                this.reconcileInputAck(msg.seq, msg.x, msg.y);
                break;
            case 'snapshot':
                this.applySnapshot(msg.players);
                if (msg.timeRemaining !== undefined) {
                    this._matchTimeRemaining = msg.timeRemaining;
                }
                if (msg.projectiles) {
                    for (const sp of msg.projectiles) {
                        const existing = this._localBullets.get(sp.id);
                        if (existing) {
                            existing.x = sp.x;
                            existing.y = sp.y;
                            existing.dx = sp.dx ?? existing.dx;
                            existing.dy = sp.dy ?? existing.dy;
                            existing.speed = sp.speed ?? existing.speed;
                        }
                    }
                }
                if (msg.grenades) {
                    for (const sg of msg.grenades as any[]) {
                        const existing = this._localGrenades.get(sg.id);
                        if (existing) {
                            existing.x = sg.x;
                            existing.y = sg.y;
                            if (sg.detonated) existing.detonated = true;
                        }
                    }
                }
                break;
            case 'lobby_state':
                setActiveMap(msg.mapName);
                updateLobbyState({
                    host: msg.host,
                    players: msg.players,
                    config: msg.config,
                    mapName: msg.mapName,
                    started: msg.started,
                });
                break;
            case 'game_starting':
                console.log('[CLIENT] game_starting countdown:', msg.countdown, 'hasOnGameStart:', !!this._onGameStart);
                if (msg.countdown > 0) {
                    showCountdown(msg.countdown);
                }

                else {
                    console.log('[CLIENT] countdown=0, firing onGameStart');
                    this._matchActive = true;
                    this._roundActive = true;
                    hideLobbyScreen();
                    if (this._onGameStart) {
                        this._onGameStart();
                        this._onGameStart = null;
                    }

                    else {
                        console.warn('[CLIENT] onGameStart callback was null!');
                    }
                }
                break;
            case 'player_joined':
                if (msg.player && this.onPlayerJoined) {
                    this.onPlayerJoined(msg.player);
                }
                break;
            case 'player_left':
                break;
        }
    }

    /**
     * Processes an array of authoritative game events from the server.
     * Updates local match/round state, player health/inventory, and
     * client-predicted projectile/grenade maps, then emits all events
     * onto the {@link gameEventBus}.
     * @param events - Events from a server 'events' message.
     */
    private eventHandler(events: GameEvent[]): void {
        console.log('[CLIENT] events received:', events.length, events.map((e: any) => e.type));
        for (const event of events) {
            switch (event.type) {
                case 'ROUND_START':
                    this._roundActive = true;
                    this._matchActive = true;
                    this._currentRound = event.round;
                    this._localBullets.clear();
                    this._localGrenades.clear();
                    break;

                case 'ROUND_END':
                    this._roundActive = false;
                    if (event.teamWins) {
                        this._teamRoundWins = { ...event.teamWins };
                    }
                    if (event.isFinal) this._matchActive = false;
                    break;

                case 'PLAYER_KILLED':
                    const killer = this.ensurePlayerState(event.killerId);
                    const victim = this.ensurePlayerState(event.targetId);
                    killer.kills++;
                    killer.points += 100;
                    victim.deaths++;
                    const deadPlayer = getPlayerInfo(event.targetId);
                    if (deadPlayer) {
                        deadPlayer.dead = true;
                        deadPlayer.health = 0;
                    }
                    break;

                case 'PLAYER_DAMAGED':
                    const damaged = getPlayerInfo(event.targetId);
                    if (damaged) {
                        damaged.health = event.newHealth;
                        damaged.armour = event.newArmor;
                    }
                    break;

                case 'PLAYER_RESPAWN':
                    this.ensurePlayerState(event.playerId);
                    const respawned = getPlayerInfo(event.playerId);
                    if (respawned) {
                        respawned.dead = false;
                        respawned.health = getConfig().player.maxHealth;
                        respawned.armour = getConfig().player.startingArmor;
                        respawned.current_position.x = event.x;
                        respawned.current_position.y = event.y;
                        respawned.current_position.rotation = event.rotation;
                    }
                    break;

                case 'RELOAD_START':
                    const reloadingPlayer = getPlayerInfo(event.playerId);
                    if (reloadingPlayer) {
                        const weapon = reloadingPlayer.weapons.find((w: PlayerWeapon) => w.active);
                        if (weapon) weapon.reloading = true;
                    }
                    break;

                case 'RELOAD_COMPLETE':
                    const reloadPlayer = getPlayerInfo(event.playerId);
                    if (reloadPlayer) {
                        const weapon = reloadPlayer.weapons.find((w: PlayerWeapon) => w.active);
                        if (weapon) {
                            weapon.ammo = event.ammo;
                            weapon.reloading = false;
                        }
                    }
                    break;

                case 'BULLET_SPAWN':
                    this._localBullets.set(event.bulletId, {
                        id: event.bulletId,
                        x: event.x,
                        y: event.y,
                        dx: event.dx ?? 0,
                        dy: event.dy ?? 0,
                        speed: event.speed ?? 0,
                    });
                    break;

                case 'BULLET_REMOVED':
                case 'BULLET_HIT':
                    this._localBullets.delete(event.bulletId);
                    break;

                case 'GRENADE_SPAWN':
                    this._localGrenades.set(event.grenadeId, {
                        id: event.grenadeId,
                        x: event.x,
                        y: event.y,
                        dx: event.dx ?? 0,
                        dy: event.dy ?? 0,
                        speed: event.speed ?? 0,
                        detonated: false,
                    });
                    break;

                case 'GRENADE_DETONATE':
                case 'GRENADE_REMOVED':
                    const gId = event.grenadeId;
                    const g = this._localGrenades.get(gId);
                    if (g) g.detonated = true;
                    if (event.type === 'GRENADE_REMOVED') this._localGrenades.delete(gId);
                    break;

                case 'PLAYER_STATUS_CHANGED':
                    const statusPlayer = getPlayerInfo(event.playerId);
                    if (statusPlayer) statusPlayer.status = event.status;
                    break;

                case 'SMOKE_DEPLOY':
                    addSmokeData(event.x, event.y, event.radius, event.duration, performance.now());
                    break;
            }
        }

        gameEventBus.emitAll(events);
    }

    /**
     * Applies client-side movement prediction for the local player so
     * movement feels instant despite network latency.
     * @param input - The MOVE input being predicted.
     */
    private applyLocalPrediction(input: Extract<PlayerInput, { type: 'MOVE' }>): void {
        const id = this.localPlayerId ?? input.playerId;
        const player = getPlayerInfo(id);
        if (!player) return;

        const speed = getConfig().player.speed;
        const result = moveWithCollisionPure(
            player.current_position.x,
            player.current_position.y,
            input.dx * speed,
            input.dy * speed,
            getWallAABBs(),
            environment.limits,
            id,
            getAllPlayers(),
        );
        player.current_position.x = result.x;
        player.current_position.y = result.y;
    }

    /**
     * Reconciles the local player's position after a server input_ack.
     * Replays all unacknowledged inputs on top of the server position to
     * compute the correct predicted position. Snaps if far away (teleport
     * or respawn), otherwise smoothly blends via {@link _reconTarget}.
     * @param seq - Sequence number acknowledged by the server.
     * @param x - Server-authoritative X position at that sequence.
     * @param y - Server-authoritative Y position at that sequence.
     */
    private reconcileInputAck(seq: number, x: number, y: number): void {
        if (this.localPlayerId === null) return;

        const player = getPlayerInfo(this.localPlayerId);
        if (!player) return;

        let reconX = x;
        let reconY = y;

        this.pendingInputs = this.pendingInputs.filter((p) => p.seq > seq);
        const speed = getConfig().player.speed;
        for (const pending of this.pendingInputs) {
            if (pending.input.type !== 'MOVE') continue;
            const result = moveWithCollisionPure(reconX, reconY, pending.input.dx * speed, pending.input.dy * speed, getWallAABBs(), environment.limits, this.localPlayerId ?? 0, getAllPlayers());
            reconX = result.x;
            reconY = result.y;
        }

        const dx = reconX - player.current_position.x;
        const dy = reconY - player.current_position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 50) {
            player.current_position.x = reconX;
            player.current_position.y = reconY;
            this._reconTarget = null;
        }

        else if (dist > 1) {
            this._reconTarget = { x: reconX, y: reconY };
        }

        else {
            this._reconTarget = null;
        }
    }

    /**
     * Applies a server snapshot to all players. For the local player only
     * non-position state is synced (position is handled by input_ack
     * reconciliation). Remote players get interpolation targets set.
     * @param players - Player snapshots from the server.
     */
    private applySnapshot(players: PlayerSnapshot[]): void {
        for (const snapshot of players) {
            const player = getPlayerInfo(snapshot.id);

            if (snapshot.id === this.localPlayerId) {
                if (player) {
                    player.health = snapshot.health;
                    player.armour = snapshot.armour;
                    player.dead = snapshot.dead;
                    player.weapons = snapshot.weapons;
                    player.grenades = snapshot.grenades;
                    this.syncTeam(player, snapshot.team);
                }
                const state = this.ensurePlayerState(snapshot.id);
                state.money = snapshot.money;
                continue;
            }

            if (snapshot.hidden) {
                this._interpTargets.set(snapshot.id, {
                    x: snapshot.x,
                    y: snapshot.y,
                    rotation: snapshot.rotation,
                });
                continue;
            }

            this._interpTargets.set(snapshot.id, {
                x: snapshot.x,
                y: snapshot.y,
                rotation: snapshot.rotation,
            });

            if (player) {
                player.health = snapshot.health;
                player.armour = snapshot.armour;
                player.dead = snapshot.dead;
                player.weapons = snapshot.weapons;
                player.grenades = snapshot.grenades;
                this.syncTeam(player, snapshot.team);
            }
            const state = this.ensurePlayerState(snapshot.id);
            state.money = snapshot.money;
        }
    }

    /**
     * Emits a TEAM_CHANGED event if the server's team for a player differs
     * from the local value, then updates the local value.
     * @param player - Local player_info to check and update.
     * @param serverTeam - Team number from the server snapshot.
     */
    private syncTeam(player: player_info, serverTeam: number): void {
        if (player.team === serverTeam) return;
        const oldTeam = player.team;
        player.team = serverTeam;
        gameEventBus.emit({ type: 'TEAM_CHANGED', playerId: player.id, oldTeam, newTeam: serverTeam });
    }
}

export const webSocketAdapter = new WebSocketAdapter();
