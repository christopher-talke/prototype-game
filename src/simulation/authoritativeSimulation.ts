// AuthoritativeSimulation: fully authoritative game state with NO DOM dependencies.
// Consolidates all game logic: movement, weapons, grenades, projectiles, match state, respawns.
// Can run on client (offline) or server (online).

import type { GameEvent, PlayerInput, PlayerStatusChangedEvent } from '@net/gameEvent';
import { PlayerStatus } from './player/playerData';
import { GameSimulation } from './gameSimulation';
import { getWeaponDef, createDefaultWeapon } from '@simulation/combat/weapons';
import { getGrenadeDef, createDefaultGrenades } from '@simulation/combat/grenades';
import { getConfig } from '@config/activeConfig';
import { HALF_HIT_BOX, ROTATION_OFFSET } from '../constants';
import { moveWithCollisionPure } from './player/collision';

// Per-player weapon state tracked by the simulation (no setTimeout)
type PlayerWeaponState = {
    lastFireTime: number;
    consecutiveShots: number;
    recoilResetTime: number; // timestamp when consecutive shots reset (0 = no pending reset)
    reloadStartTime: number; // 0 = not reloading via tick
    nextShellTime: number; // for shell-by-shell reload (0 = not active)
};

// Per-player respawn tracking
type PlayerRespawnState = {
    deathTime: number; // 0 = alive
};

// Match state
type MatchState = {
    active: boolean;
    roundActive: boolean;
    currentRound: number;
    roundStartTime: number;
    intermissionEndTime: number; // 0 = no pending intermission
    matchWinner: number | null;
    teamRoundWins: Record<number, number>;
    roundKills: Record<number, number>;
    playerStates: Map<number, PlayerGameState>;
};

// Collision AABB
type AABB = { x: number; y: number; w: number; h: number };

// Bounds limits
type Limits = { left: number; right: number; top: number; bottom: number };

export class AuthoritativeSimulation {
    readonly simulation: GameSimulation;
    private wallAABBs: AABB[] = [];
    private limits: Limits = { left: 0, right: 3000, top: 0, bottom: 3000 };
    private segments: WallSegment[] = [];
    private players: player_info[] = [];
    private playerMap = new Map<number, player_info>(); // O(1) lookup for processInput
    private teamSpawns: Record<number, coordinates[]> = {};
    patrolPoints: coordinates[] = [];

    private weaponStates = new Map<number, PlayerWeaponState>();
    private respawnStates = new Map<number, PlayerRespawnState>();
    private match: MatchState = {
        active: false,
        roundActive: false,
        currentRound: 0,
        roundStartTime: 0,
        intermissionEndTime: 0,
        matchWinner: null,
        teamRoundWins: {},
        roundKills: {},
        playerStates: new Map(),
    };

    constructor() {
        this.simulation = new GameSimulation();
    }

    // -- Setup --

    setMap(wallAABBs: AABB[], limits: Limits, segments: WallSegment[], teamSpawns: Record<number, coordinates[]>, patrolPoints: coordinates[]) {
        this.wallAABBs = wallAABBs;
        this.limits = limits;
        this.segments = segments;
        this.teamSpawns = teamSpawns;
        this.patrolPoints = patrolPoints;
    }

    setPlayers(players: player_info[]) {
        this.players = players;
        this.playerMap.clear();
        for (const p of players) {
            this.playerMap.set(p.id, p);
            if (!this.weaponStates.has(p.id)) {
                this.weaponStates.set(p.id, {
                    lastFireTime: 0,
                    consecutiveShots: 0,
                    recoilResetTime: 0,
                    reloadStartTime: 0,
                    nextShellTime: 0,
                });
            }
            if (!this.respawnStates.has(p.id)) {
                this.respawnStates.set(p.id, { deathTime: 0 });
            }
        }
    }

    addPlayer(player: player_info) {
        this.players.push(player);
        this.playerMap.set(player.id, player);
        this.weaponStates.set(player.id, {
            lastFireTime: 0,
            consecutiveShots: 0,
            recoilResetTime: 0,
            reloadStartTime: 0,
            nextShellTime: 0,
        });
        this.respawnStates.set(player.id, { deathTime: 0 });
        if (this.match.active) {
            this.match.playerStates.set(player.id, {
                playerId: player.id,
                kills: 0,
                deaths: 0,
                money: getConfig().economy.startingMoney,
                points: 0,
            });
            if (!this.match.teamRoundWins[player.team]) {
                this.match.teamRoundWins[player.team] = 0;
            }
        }
    }

    getPlayers(): player_info[] {
        return this.players;
    }

    getSegments(): WallSegment[] {
        return this.segments;
    }

    getMatchState(): MatchState {
        return this.match;
    }

    getPlayerState(playerId: number): PlayerGameState | undefined {
        return this.match.playerStates.get(playerId);
    }

    getAllPlayerStates(): PlayerGameState[] {
        return Array.from(this.match.playerStates.values());
    }

    getConsecutiveShots(playerId: number): number {
        return this.weaponStates.get(playerId)?.consecutiveShots ?? 0;
    }

    // -- Collision (delegates to shared pure functions) --

    private moveWithCollision(currentX: number, currentY: number, dx: number, dy: number, playerId?: number): { x: number; y: number } {
        return moveWithCollisionPure(currentX, currentY, dx, dy, this.wallAABBs, this.limits, playerId, this.players);
    }

    // -- Status change helper --

    private emitStatusChange(player: player_info, newStatus: PlayerStatus): PlayerStatusChangedEvent {
        const prev = player.status;
        player.status = newStatus;
        return { type: 'PLAYER_STATUS_CHANGED', playerId: player.id, status: newStatus, previousStatus: prev };
    }

    // -- Input processing --

    processInput(input: PlayerInput, timestamp: number): GameEvent[] {
        const player = this.playerMap.get(input.playerId);
        if (!player) return [];

        let events: GameEvent[];
        switch (input.type) {
            case 'MOVE':
                events = this.processMove(player, input.dx, input.dy);
                break;
            case 'ROTATE':
                player.current_position.rotation = input.rotation;
                events = [];
                break;
            case 'FIRE':
                events = this.processFire(player, timestamp);
                break;
            case 'STOP_FIRE':
                this.notifyStopFiring(player.id, timestamp);
                events = [];
                break;
            case 'RELOAD':
                events = this.processReload(player, timestamp);
                break;
            case 'SWITCH_WEAPON':
                events = this.processSwitchWeapon(player, input.slotIndex);
                break;
            case 'THROW_GRENADE':
                events = this.processThrowGrenade(player, input.grenadeType, input.chargePercent, input.aimDx, input.aimDy, timestamp);
                break;
            case 'DETONATE_C4':
                events = this.simulation.detonateC4(input.playerId, this.segments);
                break;
            case 'BUY_WEAPON':
                events = this.processBuyWeapon(player, input.weaponType);
                break;
            case 'BUY_GRENADE':
                events = this.processBuyGrenade(player, input.grenadeType);
                break;
            case 'BUY_HEALTH':
                this.buyHealth(input.playerId);
                events = [];
                break;
            case 'BUY_ARMOR':
                this.buyArmor(input.playerId);
                events = [];
                break;
            case 'OPEN_BUY_MENU':
                events = [this.emitStatusChange(player, PlayerStatus.BUYING)];
                break;
            case 'CLOSE_BUY_MENU':
                events = [this.emitStatusChange(player, PlayerStatus.IDLE)];
                break;
        }
        return this.postProcessEvents(events, timestamp);
    }

    private processMove(player: player_info, dx: number, dy: number): GameEvent[] {
        const config = getConfig();
        const result = this.moveWithCollision(
            player.current_position.x,
            player.current_position.y,
            dx * config.player.speed,
            dy * config.player.speed,
            player.id,
        );
        player.current_position.x = result.x;
        player.current_position.y = result.y;
        return [];
    }

    private processFire(player: player_info, timestamp: number): GameEvent[] {
        if (player.dead) return [];

        const weapon = player.weapons.find((w) => w.active);
        if (!weapon) return [];

        const ws = this.weaponStates.get(player.id)!;
        const weaponDef = getWeaponDef(weapon.type);

        // Shell-by-shell reload can be interrupted by firing
        const interruptEvents: GameEvent[] = [];
        if (weapon.reloading) {
            if (weaponDef.shellReloadTime && weapon.ammo > 0) {
                weapon.reloading = false;
                ws.nextShellTime = 0;
                interruptEvents.push(this.emitStatusChange(player, PlayerStatus.IDLE));
            } else {
                return [];
            }
        }

        if (timestamp - ws.lastFireTime < weaponDef.fireRate) return interruptEvents;
        if (weapon.ammo <= 0) {
            return [...interruptEvents, ...this.processReload(player, timestamp)];
        }

        ws.lastFireTime = timestamp;
        weapon.ammo--;

        // Recoil
        const patternIndex = Math.min(ws.consecutiveShots, weaponDef.recoilPattern.length - 1);
        const recoil = weaponDef.recoilPattern[patternIndex];
        player.current_position.rotation += recoil.y;
        ws.consecutiveShots++;
        ws.recoilResetTime = 0; // reset pending timer since we're still firing

        // Calculate bullet direction
        const centerX = player.current_position.x + HALF_HIT_BOX;
        const centerY = player.current_position.y + HALF_HIT_BOX;
        const aimAngle = player.current_position.rotation - ROTATION_OFFSET;
        const events: GameEvent[] = [];

        for (let p = 0; p < weaponDef.pellets; p++) {
            let bulletAngle = aimAngle;
            if (weaponDef.spread > 0) {
                bulletAngle += (Math.random() - 0.5) * weaponDef.spread;
            }
            const rad = (Math.PI / 180) * bulletAngle;
            const dx = Math.cos(rad);
            const dy = Math.sin(rad);
            events.push(...this.simulation.spawnBullet(player.id, centerX, centerY, dx, dy, weaponDef.bulletSpeed, weaponDef.damage, weaponDef.id));
        }

        // Auto-reload on empty
        if (weapon.ammo <= 0) {
            events.push(...this.processReload(player, timestamp));
        }

        return [...interruptEvents, ...events];
    }

    private processReload(player: player_info, timestamp: number): GameEvent[] {
        const weapon = player.weapons.find((w) => w.active);
        if (!weapon || weapon.reloading) return [];
        if (weapon.ammo >= weapon.maxAmmo) return [];

        const weaponDef = getWeaponDef(weapon.type);
        weapon.reloading = true;

        const ws = this.weaponStates.get(player.id)!;

        if (weaponDef.shellReloadTime) {
            ws.nextShellTime = timestamp + weaponDef.shellReloadTime;
        } else {
            ws.reloadStartTime = timestamp;
        }

        return [
            { type: 'RELOAD_START', playerId: player.id },
            this.emitStatusChange(player, PlayerStatus.RELOADING),
        ];
    }

    private processSwitchWeapon(player: player_info, index: number): GameEvent[] {
        if (index < 0 || index >= player.weapons.length) return [];

        const currentWeapon = player.weapons.find((w) => w.active);
        if (currentWeapon) {
            currentWeapon.reloading = false;
            currentWeapon.active = false;
        }

        const ws = this.weaponStates.get(player.id)!;
        ws.nextShellTime = 0;
        ws.reloadStartTime = 0;
        ws.consecutiveShots = 0;

        player.weapons[index].active = true;
        return [];
    }

    private static readonly GRENADE_STATUS_MAP: Record<GrenadeType, PlayerStatus> = {
        FRAG: PlayerStatus.THROWING_FRAG,
        FLASH: PlayerStatus.THROWING_FLASH,
        SMOKE: PlayerStatus.THROWING_SMOKE,
        C4: PlayerStatus.PLACING_C4,
    };

    private processThrowGrenade(player: player_info, type: GrenadeType, chargePercent: number, aimDx: number, aimDy: number, timestamp: number): GameEvent[] {
        if (player.grenades[type] <= 0) return [];
        player.grenades[type]--;

        const def = getGrenadeDef(type);
        const cx = player.current_position.x + HALF_HIT_BOX;
        const cy = player.current_position.y + HALF_HIT_BOX;

        const minFraction = getConfig().grenades.minThrowFraction;
        const chargeFraction = minFraction + (1 - minFraction) * Math.max(0, Math.min(1, chargePercent));

        let dx = 0;
        let dy = 0;
        let speed = 0;

        if (type === 'C4') {
            speed = 0;
        } else {
            dx = aimDx;
            dy = aimDy;
            speed = def.throwSpeed * chargeFraction;
        }

        const events = this.simulation.throwGrenade(type, player.id, cx, cy, dx, dy, speed, timestamp);
        events.push(this.emitStatusChange(player, AuthoritativeSimulation.GRENADE_STATUS_MAP[type]));
        return events;
    }

    private processBuyWeapon(player: player_info, weaponType: string): GameEvent[] {
        const weaponDef = getWeaponDef(weaponType);
        const state = this.match.playerStates.get(player.id);
        if (!state || state.money < weaponDef.price) return [];
        state.money -= weaponDef.price;

        const existing = player.weapons.find((w) => w.type === weaponType);
        if (existing) {
            existing.ammo = existing.maxAmmo;
            return [];
        }

        player.weapons.forEach((w) => (w.active = false));
        player.weapons.push({
            id: player.weapons.length + 1,
            active: true,
            type: weaponType,
            ammo: weaponDef.magSize,
            maxAmmo: weaponDef.magSize,
            firing_rate: weaponDef.fireRate,
            reloading: false,
        });
        return [];
    }

    private processBuyGrenade(player: player_info, type: GrenadeType): GameEvent[] {
        const def = getGrenadeDef(type);
        if (player.grenades[type] >= 1) return [];
        const state = this.match.playerStates.get(player.id);
        if (!state || state.money < def.price) return [];
        state.money -= def.price;
        player.grenades[type]++;
        return [];
    }

    // -- Buy armor/health (called from HUD, not PlayerInput yet) --

    buyArmor(playerId: number): boolean {
        const player = this.players.find((p) => p.id === playerId);
        if (!player) return false;
        const config = getConfig();
        if (player.armour >= config.player.maxArmor) return false;
        const state = this.match.playerStates.get(playerId);
        if (!state || state.money < config.economy.armorCost) return false;
        state.money -= config.economy.armorCost;
        player.armour = config.player.maxArmor;
        return true;
    }

    buyHealth(playerId: number): boolean {
        const player = this.players.find((p) => p.id === playerId);
        if (!player) return false;
        const config = getConfig();
        if (player.health >= config.player.maxHealth) return false;
        const state = this.match.playerStates.get(playerId);
        if (!state || state.money < config.economy.healthCost) return false;
        state.money -= config.economy.healthCost;
        player.health = config.player.maxHealth;
        return true;
    }

    // -- Match management --

    initMatch(playerIds: number[]) {
        this.match.playerStates.clear();
        this.match.teamRoundWins = {};
        this.match.roundKills = {};
        this.match.matchWinner = null;
        this.match.currentRound = 0;
        this.match.active = false;
        this.match.roundActive = false;
        this.match.intermissionEndTime = 0;

        const teams = new Set(this.players.map((p) => p.team));
        for (const team of teams) {
            this.match.teamRoundWins[team] = 0;
        }

        for (const id of playerIds) {
            this.match.playerStates.set(id, {
                playerId: id,
                kills: 0,
                deaths: 0,
                money: getConfig().economy.startingMoney,
                points: 0,
            });
        }
    }

    startRound(): GameEvent[] {
        this.match.currentRound++;
        this.match.roundStartTime = Date.now();
        this.match.roundActive = true;
        this.match.active = true;
        this.match.intermissionEndTime = 0;

        this.match.roundKills = {};
        for (const team of Object.keys(this.match.teamRoundWins)) {
            this.match.roundKills[Number(team)] = 0;
        }

        this.resetAllPlayers();

        // Reset money for the new round
        for (const [, state] of this.match.playerStates) {
            state.money = getConfig().economy.startingMoney;
        }

        const events: GameEvent[] = [{ type: 'ROUND_START', round: this.match.currentRound }];

        // Emit respawn events for all players so ClientRenderer updates DOM positions
        for (const player of this.players) {
            events.push({
                type: 'PLAYER_RESPAWN',
                playerId: player.id,
                x: player.current_position.x,
                y: player.current_position.y,
                rotation: player.current_position.rotation,
            });
        }

        return events;
    }

    recordKill(killerId: number, victimId: number): GameEvent[] {
        const killerState = this.match.playerStates.get(killerId);
        const victimState = this.match.playerStates.get(victimId);
        const events: GameEvent[] = [];

        if (killerState) {
            killerState.kills++;
            killerState.points += 100;
            const killerInfo = this.players.find((p) => p.id === killerId);
            const activeWeapon = killerInfo?.weapons.find((w) => w.active);
            const weaponType = activeWeapon?.type || 'PISTOL';
            const weaponDef = getWeaponDef(weaponType);
            killerState.money += Math.round(weaponDef.killReward * getConfig().economy.killRewardMultiplier);

            if (killerInfo) {
                this.match.roundKills[killerInfo.team] = (this.match.roundKills[killerInfo.team] ?? 0) + 1;
            }

            const victimInfo = this.players.find((p) => p.id === victimId);
            if (killerInfo && victimInfo) {
                events.push({
                    type: 'KILL_FEED',
                    killerName: killerInfo.name,
                    victimName: victimInfo.name,
                    weaponType,
                });
            }
        }

        if (victimState) {
            victimState.deaths++;
        }

        return events;
    }

    private postProcessEvents(events: GameEvent[], timestamp: number): GameEvent[] {
        const extra: GameEvent[] = [];
        for (const event of events) {
            if (event.type === 'PLAYER_KILLED') {
                extra.push(...this.recordKill(event.killerId, event.targetId));
                this.notifyPlayerDeath(event.targetId, timestamp);
                const victim = this.playerMap.get(event.targetId);
                if (victim) extra.push(this.emitStatusChange(victim, PlayerStatus.DEAD));
            }
        }
        if (extra.length > 0) events.push(...extra);
        return events;
    }

    endMatch() {
        this.match.roundActive = false;
        this.match.active = false;
        this.match.intermissionEndTime = 0;
    }

    isMatchActive(): boolean {
        return this.match.active;
    }

    isRoundActive(): boolean {
        return this.match.roundActive;
    }

    getCurrentRound(): number {
        return this.match.currentRound;
    }

    getTeamRoundWins(): Record<number, number> {
        return this.match.teamRoundWins;
    }

    getMatchWinner(): number | null {
        return this.match.matchWinner;
    }

    getMatchTimeRemaining(): number {
        if (!this.match.roundActive) return 0;
        return Math.max(0, getConfig().match.roundDuration - (Date.now() - this.match.roundStartTime));
    }

    spendMoney(playerId: number, amount: number): boolean {
        const state = this.match.playerStates.get(playerId);
        if (!state || state.money < amount) return false;
        state.money -= amount;
        return true;
    }

    // -- Tick: advances simulation each frame --

    tick(timestamp: number): GameEvent[] {
        const events: GameEvent[] = [];

        // Helper: push sub-tick results only when non-empty to avoid spread of empty arrays
        const pushAll = (sub: GameEvent[]) => { if (sub.length > 0) events.push(...sub); };

        pushAll(this.simulation.tickProjectiles(this.segments, this.players));
        pushAll(this.simulation.tickGrenades(this.segments, this.players, timestamp));
        pushAll(this.tickReloads(timestamp));
        this.tickRecoilResets(timestamp);
        pushAll(this.tickRespawns(timestamp));
        pushAll(this.tickMatchTimer());
        pushAll(this.tickIntermission());

        return this.postProcessEvents(events, timestamp);
    }

    private tickReloads(timestamp: number): GameEvent[] {
        const events: GameEvent[] = [];
        for (const player of this.players) {
            const ws = this.weaponStates.get(player.id);
            if (!ws) continue;
            // Inline active weapon lookup to avoid .find() per player per frame
            let weapon: typeof player.weapons[0] | undefined;
            for (let i = 0; i < player.weapons.length; i++) {
                if (player.weapons[i].active) { weapon = player.weapons[i]; break; }
            }
            if (!weapon || !weapon.reloading) continue;

            const weaponDef = getWeaponDef(weapon.type);

            if (weaponDef.shellReloadTime) {
                // Shell-by-shell reload
                if (ws.nextShellTime > 0 && timestamp >= ws.nextShellTime) {
                    weapon.ammo++;
                    if (weapon.ammo < weapon.maxAmmo) {
                        ws.nextShellTime = timestamp + weaponDef.shellReloadTime;
                    } else {
                        weapon.reloading = false;
                        ws.nextShellTime = 0;
                        events.push({ type: 'RELOAD_COMPLETE', playerId: player.id, ammo: weapon.ammo });
                        events.push(this.emitStatusChange(player, PlayerStatus.IDLE));
                    }
                }
            } else {
                // Full magazine reload
                if (ws.reloadStartTime > 0 && timestamp >= ws.reloadStartTime + weaponDef.reloadTime) {
                    weapon.ammo = weapon.maxAmmo;
                    weapon.reloading = false;
                    ws.reloadStartTime = 0;
                    events.push({ type: 'RELOAD_COMPLETE', playerId: player.id, ammo: weapon.ammo });
                    events.push(this.emitStatusChange(player, PlayerStatus.IDLE));
                }
            }
        }
        return events;
    }

    private tickRecoilResets(timestamp: number) {
        for (const [, ws] of this.weaponStates) {
            if (ws.recoilResetTime > 0 && timestamp >= ws.recoilResetTime) {
                ws.consecutiveShots = 0;
                ws.recoilResetTime = 0;
            }
        }
    }

    // Called when player stops firing (from input layer)
    notifyStopFiring(playerId: number, timestamp: number) {
        const ws = this.weaponStates.get(playerId);
        if (ws) {
            ws.recoilResetTime = timestamp + getConfig().shooting.recoilResetDelay;
        }
    }

    private tickRespawns(timestamp: number): GameEvent[] {
        const events: GameEvent[] = [];
        const config = getConfig();

        for (const player of this.players) {
            const rs = this.respawnStates.get(player.id);
            if (!rs || rs.deathTime === 0 || !player.dead) continue;

            if (timestamp >= rs.deathTime + config.player.respawnTime) {
                rs.deathTime = 0;
                events.push(...this.respawnPlayer(player));
            }
        }

        return events;
    }

    // Called when a player is killed (to start respawn timer)
    notifyPlayerDeath(playerId: number, timestamp: number) {
        const rs = this.respawnStates.get(playerId);
        if (rs) {
            rs.deathTime = timestamp;
        }
    }

    private respawnPlayer(player: player_info): GameEvent[] {
        const spawnPoints = this.teamSpawns[player.team] ?? Object.values(this.teamSpawns).flat();
        const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

        player.health = getConfig().player.maxHealth;
        player.armour = getConfig().player.startingArmor;
        player.dead = false;
        player.current_position.x = spawn.x;
        player.current_position.y = spawn.y;
        player.weapons = [createDefaultWeapon()];
        player.grenades = createDefaultGrenades();

        return [
            {
                type: 'PLAYER_RESPAWN',
                playerId: player.id,
                x: spawn.x,
                y: spawn.y,
                rotation: player.current_position.rotation,
            },
            this.emitStatusChange(player, PlayerStatus.IDLE),
        ];
    }

    private tickMatchTimer(): GameEvent[] {
        if (!this.match.roundActive) return [];
        if (this.getMatchTimeRemaining() <= 0) {
            return this.endRound();
        }
        return [];
    }

    private tickIntermission(): GameEvent[] {
        if (this.match.intermissionEndTime > 0 && Date.now() >= this.match.intermissionEndTime) {
            this.match.intermissionEndTime = 0;
            return this.startRound();
        }
        return [];
    }

    private endRound(): GameEvent[] {
        this.match.roundActive = false;

        let bestTeam = 1;
        let bestKills = -1;
        for (const team of Object.keys(this.match.roundKills)) {
            const kills = this.match.roundKills[Number(team)];
            if (kills > bestKills) {
                bestKills = kills;
                bestTeam = Number(team);
            }
        }

        this.match.teamRoundWins[bestTeam] = (this.match.teamRoundWins[bestTeam] ?? 0) + 1;
        const wins = this.match.teamRoundWins[bestTeam];

        const isFinal = wins >= getConfig().match.roundsToWin;
        if (isFinal) {
            this.match.active = false;
            this.match.matchWinner = bestTeam;
        }

        const events: GameEvent[] = [
            {
                type: 'ROUND_END',
                winningTeam: bestTeam,
                teamWins: { ...this.match.teamRoundWins },
                isFinal,
            },
        ];

        if (!isFinal) {
            this.match.intermissionEndTime = Date.now() + getConfig().match.roundIntermission;
        }

        return events;
    }

    private resetAllPlayers() {
        const teamCounters: Record<number, number> = {};

        for (const player of this.players) {
            teamCounters[player.team] = teamCounters[player.team] ?? 0;
            const spawns = this.teamSpawns[player.team] ?? Object.values(this.teamSpawns).flat();
            const spawn = spawns[teamCounters[player.team] % spawns.length];
            teamCounters[player.team]++;

            player.health = getConfig().player.maxHealth;
            player.armour = getConfig().player.startingArmor;
            player.dead = false;
            player.status = PlayerStatus.IDLE;
            player.current_position.x = spawn.x;
            player.current_position.y = spawn.y;
            player.weapons = [createDefaultWeapon()];
            player.grenades = createDefaultGrenades();

            // Reset weapon state
            const ws = this.weaponStates.get(player.id);
            if (ws) {
                ws.lastFireTime = 0;
                ws.consecutiveShots = 0;
                ws.recoilResetTime = 0;
                ws.reloadStartTime = 0;
                ws.nextShellTime = 0;
            }

            // Reset respawn state
            const rs = this.respawnStates.get(player.id);
            if (rs) rs.deathTime = 0;
        }
    }
}
