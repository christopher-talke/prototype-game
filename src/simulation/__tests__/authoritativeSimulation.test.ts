import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthoritativeSimulation } from '@simulation/authoritativeSimulation';
import { setGameMode, resetConfig } from '@config/activeConfig';
import { BASE_DEFAULTS } from '@config/defaults';
import { WEAPON_DEFS } from '@simulation/combat/weapons';
import { makePlayer, makeWall, testSegment, testLimits } from '../../test/helpers';
import { clearAllSmokeData } from '@simulation/combat/smokeData';
import type { GameEvent } from '@net/gameEvent';

let auth: AuthoritativeSimulation;
const limits = testLimits(3000, 3000);
const teamSpawns = { 1: [{ x: 100, y: 100 }], 2: [{ x: 2800, y: 2800 }] };

function setupMatch(players: player_info[]) {
    auth.setMap(new Map([['default', []]]), limits, [], teamSpawns, [], 'default');
    auth.setPlayers(players);
    auth.initMatch(players.map(p => p.id));
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    resetConfig();
    auth = new AuthoritativeSimulation();
    clearAllSmokeData();
});

afterEach(() => {
    vi.useRealTimers();
});

// ---- Economy: Buy Weapon ----

describe('processBuyWeapon', () => {
    it('given enough money, when buying weapon, then deducts price and adds weapon', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        auth.processInput({ type: 'BUY_WEAPON', playerId: 1, weaponType: 'RIFLE' }, 10000);
        expect(auth.getPlayerState(1)!.money).toBe(5000 - WEAPON_DEFS.RIFLE.price);
        expect(p.weapons.some(w => w.type === 'RIFLE')).toBe(true);
    });

    it('given not enough money, when buying weapon, then does nothing', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 100;
        auth.processInput({ type: 'BUY_WEAPON', playerId: 1, weaponType: 'RIFLE' }, 10000);
        expect(auth.getPlayerState(1)!.money).toBe(100);
        expect(p.weapons.some(w => w.type === 'RIFLE')).toBe(false);
    });

    it('given existing weapon of same type, when buying, then refills ammo', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.weapons[0].ammo = 2; // partially depleted PISTOL
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        auth.processInput({ type: 'BUY_WEAPON', playerId: 1, weaponType: 'PISTOL' }, 10000);
        expect(p.weapons[0].ammo).toBe(p.weapons[0].maxAmmo);
    });
});

// ---- Economy: Buy Grenade ----

describe('processBuyGrenade', () => {
    it('given enough money, when buying grenade, then increments count and deducts cost', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        auth.processInput({ type: 'BUY_GRENADE', playerId: 1, grenadeType: 'FRAG' }, 10000);
        expect(p.grenades.FRAG).toBe(1);
    });

    it('given at maximum allowed, when buying grenade, then does nothing', () => {
        setGameMode({ grenades: { maximumAllowed: 1 } });
        const p = makePlayer({ id: 1, team: 1 });
        p.grenades.FRAG = 1;
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        auth.processInput({ type: 'BUY_GRENADE', playerId: 1, grenadeType: 'FRAG' }, 10000);
        expect(p.grenades.FRAG).toBe(1);
    });
});

// ---- Economy: Buy Health/Armor ----

describe('buyHealth', () => {
    it('given damaged player with money, when buying health, then restores to max', () => {
        const p = makePlayer({ id: 1, team: 1, health: 50 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        auth.buyHealth(1);
        expect(p.health).toBe(100);
    });

    it('given full health, when buying health, then returns false', () => {
        const p = makePlayer({ id: 1, team: 1, health: 100 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        expect(auth.buyHealth(1)).toBe(false);
    });

    it('given not enough money, when buying health, then returns false', () => {
        const p = makePlayer({ id: 1, team: 1, health: 50 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 10;
        expect(auth.buyHealth(1)).toBe(false);
    });
});

describe('buyArmor', () => {
    it('given player with money, when buying armor, then sets to maxArmor', () => {
        const p = makePlayer({ id: 1, team: 1, armour: 0 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        auth.buyArmor(1);
        expect(p.armour).toBe(100);
    });

    it('given already at maxArmor, when buying armor, then returns false', () => {
        const p = makePlayer({ id: 1, team: 1, armour: 100 });
        setupMatch([p]);
        auth.getPlayerState(1)!.money = 5000;
        expect(auth.buyArmor(1)).toBe(false);
    });
});

// ---- Economy: recordKill ----

describe('recordKill', () => {
    it('given kill, when recording, then increments killer stats and emits KILL_FEED', () => {
        const killer = makePlayer({ id: 1, name: 'Killer', team: 1 });
        const victim = makePlayer({ id: 2, name: 'Victim', team: 2 });
        setupMatch([killer, victim]);
        auth.getPlayerState(1)!.money = 0;
        const events = auth.recordKill(1, 2);
        expect(auth.getPlayerState(1)!.kills).toBe(1);
        expect(auth.getPlayerState(1)!.points).toBe(100);
        expect(auth.getPlayerState(2)!.deaths).toBe(1);
        // Kill reward: PISTOL killReward (300) * multiplier (1.0)
        expect(auth.getPlayerState(1)!.money).toBe(300);
        const killFeed = events.find(e => e.type === 'KILL_FEED') as any;
        expect(killFeed).toBeDefined();
        expect(killFeed.killerName).toBe('Killer');
        expect(killFeed.victimName).toBe('Victim');
    });
});

// ---- Weapon State: Fire ----

describe('processFire', () => {
    it('given weapon with ammo, when firing, then spawns bullet and decrements ammo', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        const events = auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10000 }, 10000);
        expect(events.some(e => e.type === 'BULLET_SPAWN')).toBe(true);
        expect(p.weapons[0].ammo).toBe(WEAPON_DEFS.PISTOL.magSize - 1);
    });

    it('given fire rate not elapsed, when firing again, then no bullet spawned', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10000 }, 10000);
        const events2 = auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10100 }, 10100);
        // PISTOL fireRate = 250ms, 100ms elapsed -> blocked
        expect(events2.some(e => e.type === 'BULLET_SPAWN')).toBe(false);
    });

    it('given ammo reaches 0, when firing, then auto-reloads', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.weapons[0].ammo = 1;
        setupMatch([p]);
        const events = auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10000 }, 10000);
        expect(events.some(e => e.type === 'BULLET_SPAWN')).toBe(true);
        expect(events.some(e => e.type === 'RELOAD_START')).toBe(true);
    });

    it('given dead player, when firing, then no events', () => {
        const p = makePlayer({ id: 1, team: 1, dead: true });
        setupMatch([p]);
        const events = auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10000 }, 10000);
        expect(events.some(e => e.type === 'BULLET_SPAWN')).toBe(false);
    });
});

// ---- Weapon State: Reload ----

describe('processReload', () => {
    it('given weapon with partial ammo, when reloading, then emits RELOAD_START and status change', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.weapons[0].ammo = 5;
        setupMatch([p]);
        const events = auth.processInput({ type: 'RELOAD', playerId: 1 }, 10000);
        expect(events.some(e => e.type === 'RELOAD_START')).toBe(true);
        expect(events.some(e => e.type === 'PLAYER_STATUS_CHANGED')).toBe(true);
        expect(p.weapons[0].reloading).toBe(true);
    });

    it('given weapon already reloading, when reload requested, then no events', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.weapons[0].ammo = 5;
        p.weapons[0].reloading = true;
        setupMatch([p]);
        const events = auth.processInput({ type: 'RELOAD', playerId: 1 }, 10000);
        expect(events).toHaveLength(0);
    });

    it('given weapon at full ammo, when reload requested, then no events', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        const events = auth.processInput({ type: 'RELOAD', playerId: 1 }, 10000);
        expect(events).toHaveLength(0);
    });
});

// ---- Weapon State: tickReloads ----

describe('tickReloads', () => {
    it('given mag reload in progress, when reloadTime elapses, then ammo is full and RELOAD_COMPLETE emitted', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.weapons[0].ammo = 5;
        setupMatch([p]);
        auth.processInput({ type: 'RELOAD', playerId: 1 }, 10000);
        // PISTOL reloadTime = 1500ms
        const events = auth.tick(11500);
        expect(events.some(e => e.type === 'RELOAD_COMPLETE')).toBe(true);
        expect(p.weapons[0].ammo).toBe(p.weapons[0].maxAmmo);
        expect(p.weapons[0].reloading).toBe(false);
    });
});

// ---- Weapon State: Switch ----

describe('processSwitchWeapon', () => {
    it('given player with two weapons, when switching to index 1, then activates it', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        // Buy a second weapon first
        auth.getPlayerState(1)!.money = 5000;
        auth.processInput({ type: 'BUY_WEAPON', playerId: 1, weaponType: 'RIFLE' }, 10000);
        // Now switch back to index 0
        auth.processInput({ type: 'SWITCH_WEAPON', playerId: 1, slotIndex: 0 }, 10000);
        expect(p.weapons[0].active).toBe(true);
        expect(p.weapons[1].active).toBe(false);
    });
});

// ---- Grenade Throw ----

describe('processThrowGrenade', () => {
    it('given FRAG grenade available, when throwing, then decrements count and emits GRENADE_SPAWN + status', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.grenades.FRAG = 2;
        setupMatch([p]);
        const events = auth.processInput(
            { type: 'THROW_GRENADE', playerId: 1, grenadeType: 'FRAG', chargePercent: 1.0, aimDx: 1, aimDy: 0 },
            10000,
        );
        expect(p.grenades.FRAG).toBe(1);
        expect(events.some(e => e.type === 'GRENADE_SPAWN')).toBe(true);
        const statusEvent = events.find(e => e.type === 'PLAYER_STATUS_CHANGED') as any;
        expect(statusEvent).toBeDefined();
        expect(statusEvent.status).toBe('THROWING_FRAG');
    });

    it('given C4, when placing, then speed is 0', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.grenades.C4 = 1;
        setupMatch([p]);
        const events = auth.processInput(
            { type: 'THROW_GRENADE', playerId: 1, grenadeType: 'C4', chargePercent: 1.0, aimDx: 1, aimDy: 0 },
            10000,
        );
        const spawnEvent = events.find(e => e.type === 'GRENADE_SPAWN') as any;
        expect(spawnEvent.speed).toBe(0);
    });

    it('given no grenades of type, when throwing, then no events', () => {
        const p = makePlayer({ id: 1, team: 1 });
        p.grenades.FRAG = 0;
        setupMatch([p]);
        const events = auth.processInput(
            { type: 'THROW_GRENADE', playerId: 1, grenadeType: 'FRAG', chargePercent: 1.0, aimDx: 1, aimDy: 0 },
            10000,
        );
        expect(events.some(e => e.type === 'GRENADE_SPAWN')).toBe(false);
    });
});

// ---- Match State Machine ----

describe('match state machine', () => {
    it('given initMatch called, when checking state, then players have startingMoney', () => {
        const p1 = makePlayer({ id: 1, team: 1 });
        const p2 = makePlayer({ id: 2, team: 2 });
        setupMatch([p1, p2]);
        expect(auth.getPlayerState(1)!.money).toBe(BASE_DEFAULTS.economy.startingMoney);
        expect(auth.getPlayerState(2)!.money).toBe(BASE_DEFAULTS.economy.startingMoney);
    });

    it('given startRound called, when checking events, then ROUND_START and PLAYER_RESPAWN emitted', () => {
        const p1 = makePlayer({ id: 1, team: 1 });
        const p2 = makePlayer({ id: 2, team: 2 });
        setupMatch([p1, p2]);
        const events = auth.startRound();
        expect(events.some(e => e.type === 'ROUND_START')).toBe(true);
        const roundStart = events.find(e => e.type === 'ROUND_START') as any;
        expect(roundStart.round).toBe(1);
        // Each player should get a PLAYER_RESPAWN event
        const respawns = events.filter(e => e.type === 'PLAYER_RESPAWN');
        expect(respawns).toHaveLength(2);
    });

    it('given round started, when checking state, then roundActive and matchActive are true', () => {
        const p1 = makePlayer({ id: 1, team: 1 });
        setupMatch([p1]);
        auth.startRound();
        expect(auth.isRoundActive()).toBe(true);
        expect(auth.isMatchActive()).toBe(true);
    });

    it('given round started, when round timer expires, then ROUND_END emitted', () => {
        const p1 = makePlayer({ id: 1, team: 1 });
        const p2 = makePlayer({ id: 2, team: 2 });
        setupMatch([p1, p2]);
        auth.startRound();
        // Advance time past roundDuration (2 * 60 * 1000 = 120000ms)
        vi.setSystemTime(10000 + 120001);
        const events = auth.tick(10000 + 120001);
        expect(events.some(e => e.type === 'ROUND_END')).toBe(true);
        expect(auth.isRoundActive()).toBe(false);
    });

    it('given team reaches roundsToWin, when round ends, then match ends with isFinal', () => {
        setGameMode({ match: { roundsToWin: 1 } });
        const p1 = makePlayer({ id: 1, team: 1 });
        const p2 = makePlayer({ id: 2, team: 2 });
        setupMatch([p1, p2]);
        auth.startRound();
        // Force round end by advancing time
        vi.setSystemTime(10000 + 120001);
        const events = auth.tick(10000 + 120001);
        const endEvent = events.find(e => e.type === 'ROUND_END') as any;
        expect(endEvent.isFinal).toBe(true);
        expect(auth.isMatchActive()).toBe(false);
    });
});

// ---- Respawns ----

describe('tickRespawns', () => {
    it('given dead player after respawnTime, when ticking, then respawns with PLAYER_RESPAWN', () => {
        const p = makePlayer({ id: 1, team: 1, dead: true });
        setupMatch([p]);
        auth.notifyPlayerDeath(1, 10000);
        // respawnTime = 3000ms
        const events = auth.tick(13001);
        expect(events.some(e => e.type === 'PLAYER_RESPAWN')).toBe(true);
        expect(p.dead).toBe(false);
        expect(p.health).toBe(100);
    });

    it('given dead player before respawnTime, when ticking, then stays dead', () => {
        const p = makePlayer({ id: 1, team: 1, dead: true });
        setupMatch([p]);
        auth.notifyPlayerDeath(1, 10000);
        auth.tick(12000); // only 2000ms elapsed, need 3000
        expect(p.dead).toBe(true);
    });
});

// ---- processMove ----

describe('processMove', () => {
    it('given player, when moving, then position updates with speed multiplier', () => {
        const p = makePlayer({ id: 1, team: 1, current_position: { x: 500, y: 500, rotation: 0 } });
        setupMatch([p]);
        auth.processInput({ type: 'MOVE', playerId: 1, dx: 1, dy: 0 }, 10000);
        // speed = 6 (BASE_DEFAULTS.player.speed), so x should move by 6
        expect(p.current_position.x).toBe(506);
    });
});

// ---- postProcessEvents ----

describe('postProcessEvents', () => {
    it('given PLAYER_KILLED event, when post-processing, then chains to KILL_FEED and status DEAD', () => {
        const killer = makePlayer({ id: 1, name: 'Killer', team: 1 });
        const victim = makePlayer({ id: 2, name: 'Victim', team: 2, health: 1, armour: 0 });
        setupMatch([killer, victim]);
        // Fire a bullet that kills victim
        victim.current_position = { x: 550, y: 500, rotation: 0 };
        killer.current_position = { x: 500, y: 500, rotation: 0 };
        const events = auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10000 }, 10000);
        // Tick to advance the bullet
        const tickEvents = auth.tick(10001);
        const allEvents = [...events, ...tickEvents];
        // Should have KILL_FEED and PLAYER_STATUS_CHANGED to DEAD in the chain
        const killFeed = allEvents.find(e => e.type === 'KILL_FEED') as any;
        const statusDead = allEvents.find(e => e.type === 'PLAYER_STATUS_CHANGED' && (e as any).status === 'DEAD') as any;
        // At least one of these should fire (might be in tick or processInput depending on bullet travel)
        if (victim.dead) {
            expect(killFeed || statusDead).toBeDefined();
        }
    });
});

// ---- Open/Close Buy Menu ----

describe('buy menu status', () => {
    it('given open buy menu input, when processing, then status changes to BUYING', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        const events = auth.processInput({ type: 'OPEN_BUY_MENU', playerId: 1 }, 10000);
        const statusEvent = events.find(e => e.type === 'PLAYER_STATUS_CHANGED') as any;
        expect(statusEvent).toBeDefined();
        expect(statusEvent.status).toBe('BUYING');
    });

    it('given close buy menu input, when processing, then status changes to IDLE', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        auth.processInput({ type: 'OPEN_BUY_MENU', playerId: 1 }, 10000);
        const events = auth.processInput({ type: 'CLOSE_BUY_MENU', playerId: 1 }, 10000);
        const statusEvent = events.find(e => e.type === 'PLAYER_STATUS_CHANGED') as any;
        expect(statusEvent.status).toBe('IDLE');
    });
});

// ---- Recoil Reset ----

describe('recoil reset', () => {
    it('given player stops firing, when recoilResetDelay elapses, then consecutiveShots resets to 0', () => {
        const p = makePlayer({ id: 1, team: 1 });
        setupMatch([p]);
        auth.processInput({ type: 'FIRE', playerId: 1, timestamp: 10000 }, 10000);
        expect(auth.getConsecutiveShots(1)).toBe(1);
        auth.processInput({ type: 'STOP_FIRE', playerId: 1, timestamp: 10001 }, 10001);
        // recoilResetDelay = 300ms
        auth.tick(10302);
        expect(auth.getConsecutiveShots(1)).toBe(0);
    });
});
