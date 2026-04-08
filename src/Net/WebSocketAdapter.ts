import type { NetAdapter } from './NetAdapter';
import type { EventHandler, GameEvent, PlayerInput } from './GameEvent';
import type { ClientMessage, ServerMessage, PlayerSnapshot } from './Protocol';
import { gameEventBus } from './GameEvent';
import { getPlayerInfo, getPlayerElement, getAllPlayers } from '../Globals/Players';
import { getConfig } from '../Config/activeConfig';
import { setLocalPlayerId, updateLobbyState, showCountdown, hideLobbyScreen } from './LobbyScreen';
import type { DeepPartial, GameModeConfig } from '../Config/types';
import { moveWithCollision } from '../Player/collision';

type PendingInput = { seq: number; input: PlayerInput };

type LocalBullet = { id: number; x: number; y: number; dx: number; dy: number; speed: number };
type LocalGrenade = { id: number; x: number; y: number; dx: number; dy: number; speed: number; detonated: boolean };

// Interpolation target for remote players
type InterpTarget = { x: number; y: number; rotation: number };

const MOVE_SEND_INTERVAL = 1000 / 60; // 60 inputs/sec - match frame rate so prediction speed equals server speed

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

    // Client-side projectile/grenade tracking
    private _localBullets = new Map<number, LocalBullet>();
    private _localGrenades = new Map<number, LocalGrenade>();

    // Player interpolation targets (remote players only)
    private _interpTargets = new Map<number, InterpTarget>();

    // Move input throttling
    private _lastMoveSendTime = 0;
    private _pendingMove: { dx: number; dy: number } | null = null;

    // Rotation throttling
    private _lastRotationSendTime = 0;
    private _pendingRotation: number | null = null;

    // Smoothed reconciliation target for local player
    private _reconTarget: { x: number; y: number } | null = null;

    // Late-join snapshot data (populated when joining a playing game)
    private _lateJoinPlayers: PlayerSnapshot[] | null = null;

    /** Register a callback that fires once when the server signals game start. */
    set onGameStart(cb: (() => void) | null) {
        this._onGameStart = cb;
    }

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

    getLocalPlayerId(): number | null {
        return this.localPlayerId;
    }

    getLateJoinPlayers(): PlayerSnapshot[] | null {
        const data = this._lateJoinPlayers;
        this._lateJoinPlayers = null;
        return data;
    }

    onPlayerJoined: ((player: PlayerSnapshot) => void) | null = null;

    private ensurePlayerState(playerId: number): PlayerGameState {
        let state = this._playerStates.get(playerId);
        if (!state) {
            state = { playerId, kills: 0, deaths: 0, money: 0, points: 0 };
            this._playerStates.set(playerId, state);
        }
        return state;
    }

    onEvent(callback: EventHandler): void {
        gameEventBus.subscribe(callback);
    }

    sendInput(input: PlayerInput): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        if (input.type === 'MOVE') {
            // Throttle move inputs to ~30/sec; apply prediction immediately
            this.applyLocalPrediction(input);
            this._pendingMove = { dx: input.dx, dy: input.dy };
            return;
        }

        if (input.type === 'ROTATE') {
            // Throttle rotation inputs
            this._pendingRotation = input.rotation;
            return;
        }

        const seq = this.inputSeq++;
        const msg: ClientMessage = { v: 1, t: 'input', seq, input };
        this.ws.send(JSON.stringify(msg));
    }

    tick(_segments: WallSegment[], _players: player_info[], _timestamp: number): void {
        // Flush throttled move input
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

        // Flush throttled rotation input
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

        // Advance local bullets
        for (const [id, b] of this._localBullets) {
            b.x += b.dx * b.speed;
            b.y += b.dy * b.speed;
            if (b.x < 0 || b.x > 3000 || b.y < 0 || b.y > 3000) {
                this._localBullets.delete(id);
            }
        }

        // Advance local grenades
        const friction = getConfig().physics.grenadeFriction;
        for (const [, g] of this._localGrenades) {
            if (g.detonated) continue;
            g.x += g.dx * g.speed;
            g.y += g.dy * g.speed;
            g.speed *= friction;
            if (g.speed < 0.3) g.speed = 0;
        }

        // Smooth local player toward reconciled position
        if (this._reconTarget && this.localPlayerId !== null) {
            const player = getPlayerInfo(this.localPlayerId);
            if (player) {
                const dx = this._reconTarget.x - player.current_position.x;
                const dy = this._reconTarget.y - player.current_position.y;
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                    player.current_position.x = this._reconTarget.x;
                    player.current_position.y = this._reconTarget.y;
                    this._reconTarget = null;
                } else {
                    player.current_position.x += dx * 0.3;
                    player.current_position.y += dy * 0.3;
                }
            }
        }

        // Interpolate remote players toward their targets
        for (const [playerId, target] of this._interpTargets) {
            if (playerId === this.localPlayerId) continue;
            const player = getPlayerInfo(playerId);
            if (!player) continue;
            const lerpFactor = 0.5;
            player.current_position.x += (target.x - player.current_position.x) * lerpFactor;
            player.current_position.y += (target.y - player.current_position.y) * lerpFactor;
            player.current_position.rotation += this.angleLerp(player.current_position.rotation, target.rotation, lerpFactor);
        }
    }

    private angleLerp(current: number, target: number, t: number): number {
        let diff = target - current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return diff * t;
    }

    isRoundActive(): boolean {
        return this._roundActive;
    }

    isMatchActive(): boolean {
        return this._matchActive;
    }

    getMatchTimeRemaining(): number {
        return this._matchTimeRemaining;
    }

    getPlayerState(playerId: number): PlayerGameState | undefined {
        return this._playerStates.get(playerId);
    }

    getAllPlayerStates(): PlayerGameState[] {
        return [...this._playerStates.values()];
    }

    getTeamRoundWins(): Record<number, number> {
        return { ...this._teamRoundWins };
    }

    getCurrentRound(): number {
        return this._currentRound;
    }

    getProjectiles() {
        return [...this._localBullets.values()];
    }

    getGrenades() {
        return [...this._localGrenades.values()];
    }

    // ---- Lobby actions ----

    sendReady(ready: boolean): void {
        this.send({ v: 1, t: 'ready', ready });
    }

    sendMovePlayer(playerId: number, team: number): void {
        this.send({ v: 1, t: 'move_player', playerId, team });
    }

    sendSetConfig(config: DeepPartial<GameModeConfig>): void {
        this.send({ v: 1, t: 'set_config', config });
    }

    sendStartGame(): void {
        this.send({ v: 1, t: 'start_game' });
    }

    private send(msg: ClientMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private handleMessage(raw: unknown): void {
        const text = typeof raw === 'string' ? raw : String(raw);
        let msg: ServerMessage;
        try {
            msg = JSON.parse(text) as ServerMessage;
        } catch {
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
                } else {
                    console.log('[CLIENT] countdown=0, firing onGameStart');
                    this._matchActive = true;
                    this._roundActive = true;
                    hideLobbyScreen();
                    if (this._onGameStart) {
                        this._onGameStart();
                        this._onGameStart = null;
                    } else {
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
            }
        }
        
        gameEventBus.emitAll(events);
    }

    private applyLocalPrediction(input: Extract<PlayerInput, { type: 'MOVE' }>): void {
        const id = this.localPlayerId ?? input.playerId;
        const player = getPlayerInfo(id);
        if (!player) return;

        const speed = getConfig().player.speed;
        const result = moveWithCollision(
            player.current_position.x,
            player.current_position.y,
            input.dx * speed,
            input.dy * speed,
            id,
            getAllPlayers(),
        );
        player.current_position.x = result.x;
        player.current_position.y = result.y;
    }

    private reconcileInputAck(seq: number, x: number, y: number): void {
        if (this.localPlayerId === null) return;

        const player = getPlayerInfo(this.localPlayerId);
        if (!player) return;

        // Compute where we should be: server pos + replay unacked inputs
        let reconX = x;
        let reconY = y;

        this.pendingInputs = this.pendingInputs.filter((p) => p.seq > seq);
        const speed = getConfig().player.speed;
        for (const pending of this.pendingInputs) {
            if (pending.input.type !== 'MOVE') continue;
            const result = moveWithCollision(reconX, reconY, pending.input.dx * speed, pending.input.dy * speed, this.localPlayerId ?? 0, getAllPlayers());
            reconX = result.x;
            reconY = result.y;
        }

        // If far away, snap immediately (teleport/respawn); otherwise blend
        const dx = reconX - player.current_position.x;
        const dy = reconY - player.current_position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 50) {
            player.current_position.x = reconX;
            player.current_position.y = reconY;
            this._reconTarget = null;
        } else if (dist > 1) {
            this._reconTarget = { x: reconX, y: reconY };
        } else {
            this._reconTarget = null;
        }
    }

    private applySnapshot(players: PlayerSnapshot[]): void {
        for (const snapshot of players) {
            const player = getPlayerInfo(snapshot.id);

            if (snapshot.id === this.localPlayerId) {
                // For local player: only sync non-position state (position handled by input_ack)
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

            // Remote players: interpolate position, snap other state
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

    private syncTeam(player: player_info, serverTeam: number): void {
        if (player.team === serverTeam) return;
        const oldTeam = player.team;
        player.team = serverTeam;
        const el = getPlayerElement(player.id);
        if (el) {
            el.classList.remove(`team-${oldTeam}`);
            el.classList.add(`team-${serverTeam}`);
            el.setAttribute('data-player-team', `${serverTeam}`);
        }
    }
}

export const webSocketAdapter = new WebSocketAdapter();
