import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSimulation } from '@simulation/gameSimulation';
import { setGameMode, resetConfig } from '@config/activeConfig';
import { makePlayer, testSegment, testLimits } from '../../test/helpers';
import { HALF_HIT_BOX } from '../../constants';
import type { GameEvent } from '@net/gameEvent';

let sim: GameSimulation;

beforeEach(() => {
    resetConfig();
    sim = new GameSimulation();
    sim.setLimits(testLimits(3000, 3000));
});

// ---- applyDamage ----

describe('applyDamage', () => {
    it('given target with no armor, when dealing 26 damage, then health reduces by 26', () => {
        const target = makePlayer({ id: 1, health: 100, armour: 0 });
        const attacker = makePlayer({ id: 2, team: 2 });
        sim.applyDamage(target, 26, 2, [target, attacker]);
        expect(target.health).toBe(74);
    });

    it('given target with 100 armor and 0.5 absorption, when dealing 26 damage, then armor absorbs half', () => {
        const target = makePlayer({ id: 1, health: 100, armour: 100 });
        const attacker = makePlayer({ id: 2, team: 2 });
        sim.applyDamage(target, 26, 2, [target, attacker]);
        // absorbed = min(26 * 0.5, 100) = 13, remaining = 26 - 13 = 13
        expect(target.armour).toBe(87); // 100 - 13
        expect(target.health).toBe(87); // 100 - 13
    });

    it('given target with low armor, when damage exceeds armor capacity, then armor absorbs what it can', () => {
        const target = makePlayer({ id: 1, health: 100, armour: 5 });
        const attacker = makePlayer({ id: 2, team: 2 });
        sim.applyDamage(target, 26, 2, [target, attacker]);
        // absorbed = min(26 * 0.5, 5) = 5, remaining = 26 - 5 = 21
        expect(target.armour).toBe(0);
        expect(target.health).toBe(79); // 100 - 21
    });

    it('given damage applied, when checking events, then emits PLAYER_DAMAGED with correct payload', () => {
        const target = makePlayer({ id: 1, health: 100, armour: 0 });
        const attacker = makePlayer({ id: 2, team: 2 });
        const events = sim.applyDamage(target, 26, 2, [target, attacker]);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'PLAYER_DAMAGED',
            targetId: 1,
            attackerId: 2,
            damage: 26,
            newHealth: 74,
            newArmor: 0,
        });
    });

    it('given lethal damage, when health reaches 0, then emits PLAYER_DAMAGED then PLAYER_KILLED', () => {
        const target = makePlayer({ id: 1, health: 10, armour: 0 });
        const attacker = makePlayer({ id: 2, team: 2 });
        const events = sim.applyDamage(target, 50, 2, [target, attacker]);
        expect(target.dead).toBe(true);
        expect(target.health).toBe(0);
        expect(events).toHaveLength(2);
        expect(events[0].type).toBe('PLAYER_DAMAGED');
        expect(events[1]).toMatchObject({ type: 'PLAYER_KILLED', targetId: 1, killerId: 2 });
    });

    it('given already dead target, when applying damage, then returns empty', () => {
        const target = makePlayer({ id: 1, dead: true });
        const attacker = makePlayer({ id: 2, team: 2 });
        const events = sim.applyDamage(target, 50, 2, [target, attacker]);
        expect(events).toHaveLength(0);
    });

    it('given friendly fire disabled and same team, when applying damage, then returns empty', () => {
        setGameMode({ match: { friendlyFire: false } });
        const target = makePlayer({ id: 1, team: 1 });
        const attacker = makePlayer({ id: 2, team: 1 });
        const events = sim.applyDamage(target, 50, 2, [target, attacker]);
        expect(events).toHaveLength(0);
        expect(target.health).toBe(100);
    });

    it('given friendly fire enabled and same team, when applying damage, then damage applies', () => {
        setGameMode({ match: { friendlyFire: true } });
        const target = makePlayer({ id: 1, team: 1, health: 100, armour: 0 });
        const attacker = makePlayer({ id: 2, team: 1 });
        const events = sim.applyDamage(target, 26, 2, [target, attacker]);
        expect(target.health).toBe(74);
        expect(events).toHaveLength(1);
    });

    it('given damage calculation, when computing health, then rounds to integer', () => {
        const target = makePlayer({ id: 1, health: 100, armour: 100 });
        const attacker = makePlayer({ id: 2, team: 2 });
        sim.applyDamage(target, 33, 2, [target, attacker]);
        // absorbed = min(33 * 0.5, 100) = 16.5, remaining = 33 - 16.5 = 16.5
        // health = round(100 - 16.5) = 84, armor = round(100 - 16.5) = 84
        expect(Number.isInteger(target.health)).toBe(true);
        expect(Number.isInteger(target.armour)).toBe(true);
    });
});

// ---- spawnBullet ----

describe('spawnBullet', () => {
    it('given spawn parameters, when spawning bullet, then returns BULLET_SPAWN event', () => {
        const events = sim.spawnBullet(1, 100, 100, 1, 0, 18, 26, 'PISTOL');
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'BULLET_SPAWN',
            ownerId: 1,
            x: 100,
            y: 100,
            dx: 1,
            dy: 0,
            speed: 18,
            weaponType: 'PISTOL',
        });
    });

    it('given two spawns, when checking IDs, then increments bullet ID', () => {
        const e1 = sim.spawnBullet(1, 0, 0, 1, 0, 10, 10);
        const e2 = sim.spawnBullet(1, 0, 0, 1, 0, 10, 10);
        expect((e2[0] as any).bulletId).toBe((e1[0] as any).bulletId + 1);
    });

    it('given spawn, when checking projectiles list, then projectile is added', () => {
        sim.spawnBullet(1, 100, 100, 1, 0, 18, 26);
        expect(sim.getProjectiles()).toHaveLength(1);
    });
});

// ---- tickProjectiles ----

describe('tickProjectiles', () => {
    it('given bullet moving right, when ticking, then position updates by dx*speed', () => {
        sim.spawnBullet(1, 100, 100, 1, 0, 18, 26);
        sim.tickProjectiles([], []);
        const p = sim.getProjectiles();
        expect(p).toHaveLength(1);
        expect(p[0].x).toBeCloseTo(118, 5);
        expect(p[0].y).toBeCloseTo(100, 5);
    });

    it('given bullet hitting wall segment, when ticking, then emits BULLET_REMOVED', () => {
        sim.spawnBullet(1, 100, 100, 1, 0, 18, 26);
        // Vertical wall at x=110
        const wall = testSegment(110, 0, 110, 200);
        const events = sim.tickProjectiles([wall], []);
        expect(events.some(e => e.type === 'BULLET_REMOVED')).toBe(true);
        expect(sim.getProjectiles()).toHaveLength(0);
    });

    it('given bullet going out of bounds, when ticking, then emits BULLET_REMOVED', () => {
        sim.setLimits(testLimits(200, 200));
        sim.spawnBullet(1, 190, 100, 1, 0, 20, 26); // will go to 210 > 200
        const events = sim.tickProjectiles([], []);
        expect(events.some(e => e.type === 'BULLET_REMOVED')).toBe(true);
    });

    it('given bullet near player within HALF_HIT_BOX, when ticking, then hits player', () => {
        // Bullet at (100, 500+HALF_HIT_BOX) going right, player at (110, 500)
        // Player center: (110 + HALF_HIT_BOX, 500 + HALF_HIT_BOX)
        const player = makePlayer({ id: 2, current_position: { x: 110, y: 500, rotation: 0 }, team: 2 });
        sim.spawnBullet(1, 100, 500 + HALF_HIT_BOX, 1, 0, 20, 26);
        const events = sim.tickProjectiles([], [player]);
        expect(events.some(e => e.type === 'BULLET_HIT')).toBe(true);
        expect(events.some(e => e.type === 'PLAYER_DAMAGED')).toBe(true);
    });

    it('given bullet owned by player, when ticking past owner, then does not hit owner', () => {
        const owner = makePlayer({ id: 1, current_position: { x: 110, y: 500, rotation: 0 } });
        sim.spawnBullet(1, 100, 500 + HALF_HIT_BOX, 1, 0, 20, 26);
        const events = sim.tickProjectiles([], [owner]);
        expect(events.some(e => e.type === 'BULLET_HIT')).toBe(false);
    });

    it('given dead player in path, when ticking, then does not hit dead player', () => {
        const deadPlayer = makePlayer({ id: 2, current_position: { x: 110, y: 500, rotation: 0 }, dead: true, team: 2 });
        sim.spawnBullet(1, 100, 500 + HALF_HIT_BOX, 1, 0, 20, 26);
        const events = sim.tickProjectiles([], [deadPlayer]);
        expect(events.some(e => e.type === 'BULLET_HIT')).toBe(false);
    });

    it('given bullet kills player, when checking event, then BULLET_HIT has isKill=true', () => {
        const player = makePlayer({ id: 2, health: 1, armour: 0, current_position: { x: 110, y: 500, rotation: 0 }, team: 2 });
        sim.spawnBullet(1, 100, 500 + HALF_HIT_BOX, 1, 0, 20, 26);
        const events = sim.tickProjectiles([], [player]);
        const hitEvent = events.find(e => e.type === 'BULLET_HIT') as any;
        expect(hitEvent).toBeDefined();
        expect(hitEvent.isKill).toBe(true);
    });

    it('given bullet hits player, when ticking, then bullet is removed', () => {
        const player = makePlayer({ id: 2, current_position: { x: 110, y: 500, rotation: 0 }, team: 2 });
        sim.spawnBullet(1, 100, 500 + HALF_HIT_BOX, 1, 0, 20, 26);
        sim.tickProjectiles([], [player]);
        expect(sim.getProjectiles()).toHaveLength(0);
    });
});

// ---- throwGrenade ----

describe('throwGrenade', () => {
    it('given FRAG grenade, when throwing, then returns GRENADE_SPAWN with isC4=false', () => {
        const events = sim.throwGrenade('FRAG', 1, 100, 100, 1, 0, 30, 0);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'GRENADE_SPAWN',
            grenadeType: 'FRAG',
            isC4: false,
        });
    });

    it('given C4, when throwing, then returns GRENADE_SPAWN with isC4=true', () => {
        const events = sim.throwGrenade('C4', 1, 100, 100, 0, 0, 0, 0);
        expect((events[0] as any).isC4).toBe(true);
    });

    it('given throw, when checking grenades list, then grenade is added', () => {
        sim.throwGrenade('FRAG', 1, 100, 100, 1, 0, 30, 0);
        expect(sim.getGrenades()).toHaveLength(1);
    });
});

// ---- tickGrenades ----

describe('tickGrenades', () => {
    it('given moving grenade, when ticking, then speed decreases by friction', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 1, 0, 30, 0);
        sim.tickGrenades([], [], 100); // well before fuse (2000ms)
        const g = sim.getGrenades();
        expect(g).toHaveLength(1);
        expect(g[0].speed).toBeCloseTo(30 * 0.94, 2); // BASE_DEFAULTS.physics.grenadeFriction = 0.94
    });

    it('given grenade at MIN_GRENADE_SPEED threshold, when friction reduces below it, then speed set to 0', () => {
        // Speed just above 0.3, after friction (0.94) it drops below: 0.31 * 0.94 = 0.2914 < 0.3
        sim.throwGrenade('FRAG', 1, 500, 500, 1, 0, 0.31, 0);
        sim.tickGrenades([], [], 100);
        const g = sim.getGrenades();
        expect(g[0].speed).toBe(0);
    });

    it('given grenade hitting wall, when ticking, then bounces and emits GRENADE_BOUNCE', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 1, 0, 30, 0);
        const wall = testSegment(520, 400, 520, 600); // vertical wall at x=520
        const events = sim.tickGrenades([wall], [], 100);
        expect(events.some(e => e.type === 'GRENADE_BOUNCE')).toBe(true);
        const g = sim.getGrenades();
        // Speed should be reduced: 30 * 0.6 = 18, then friction -> 18 * 0.94
        expect(g[0].speed).toBeCloseTo(18 * 0.94, 1);
    });

    it('given FRAG grenade past fuse time, when ticking, then detonates', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0); // stationary
        const events = sim.tickGrenades([], [], 2000); // FRAG fuseTime = 2000
        expect(events.some(e => e.type === 'GRENADE_DETONATE')).toBe(true);
        const detEvent = events.find(e => e.type === 'GRENADE_DETONATE') as any;
        expect(detEvent.grenadeType).toBe('FRAG');
    });

    it('given C4 grenade, when ticking past any time, then does NOT auto-detonate', () => {
        sim.throwGrenade('C4', 1, 500, 500, 0, 0, 0, 0);
        const events = sim.tickGrenades([], [], 999999);
        expect(events.some(e => e.type === 'GRENADE_DETONATE')).toBe(false);
    });

    it('given FLASH detonation, when players in range, then emits FLASH_EFFECT events', () => {
        sim.throwGrenade('FLASH', 1, 500, 500, 0, 0, 0, 0);
        const player = makePlayer({ id: 2, current_position: { x: 500, y: 500, rotation: 0 } });
        const events = sim.tickGrenades([], [player], 1500); // FLASH fuseTime = 1500
        expect(events.some(e => e.type === 'FLASH_EFFECT')).toBe(true);
        const flashEvent = events.find(e => e.type === 'FLASH_EFFECT') as any;
        expect(flashEvent.targetId).toBe(2);
        expect(flashEvent.intensity).toBeGreaterThanOrEqual(0.2);
    });

    it('given SMOKE detonation, when fuse expires, then emits SMOKE_DEPLOY event', () => {
        sim.throwGrenade('SMOKE', 1, 500, 500, 0, 0, 0, 0);
        const events = sim.tickGrenades([], [], 1500); // SMOKE fuseTime = 1500
        expect(events.some(e => e.type === 'SMOKE_DEPLOY')).toBe(true);
        const smokeEvent = events.find(e => e.type === 'SMOKE_DEPLOY') as any;
        expect(smokeEvent.radius).toBe(120);
    });

    it('given detonated grenade, when ticking again, then GRENADE_REMOVED and grenade is removed', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0);
        sim.tickGrenades([], [], 2000); // detonates
        const events = sim.tickGrenades([], [], 2100); // next tick
        expect(events.some(e => e.type === 'GRENADE_REMOVED')).toBe(true);
        expect(sim.getGrenades()).toHaveLength(0);
    });
});

// ---- detonateC4 ----

describe('detonateC4', () => {
    it('given C4 placed by player 1, when detonating, then GRENADE_DETONATE event emitted', () => {
        sim.throwGrenade('C4', 1, 500, 500, 0, 0, 0, 0);
        const events = sim.detonateC4(1, []);
        expect(events.some(e => e.type === 'GRENADE_DETONATE')).toBe(true);
    });

    it('given no C4 for player, when detonating, then returns empty', () => {
        const events = sim.detonateC4(1, []);
        expect(events).toHaveLength(0);
    });
});

// ---- Explosion damage (through FRAG detonation) ----

describe('explosion damage', () => {
    it('given player at center of explosion, when detonating, then takes full damage', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0);
        // Player center at grenade position: (500 + HALF_HIT_BOX, 500 + HALF_HIT_BOX)
        // Grenade at (500, 500). Distance = sqrt(HALF_HIT_BOX^2 + HALF_HIT_BOX^2) ~ 31.1
        // But we want player AT the grenade. Place player so center = (500, 500)
        const player = makePlayer({
            id: 2, team: 2, health: 100, armour: 0,
            current_position: { x: 500 - HALF_HIT_BOX, y: 500 - HALF_HIT_BOX, rotation: 0 },
        });
        const events = sim.tickGrenades([], [player], 2000);
        const hitEvent = events.find(e => e.type === 'EXPLOSION_HIT') as any;
        expect(hitEvent).toBeDefined();
        // Distance 0 -> falloff = 1, damage = 100 * 1 = 100
        expect(hitEvent.damage).toBe(100);
    });

    it('given player at edge of explosion radius, when detonating, then takes reduced damage', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0);
        // FRAG radius = 150. Place player ~100px away.
        // Player center = (600 + HALF_HIT_BOX, 500) = (622, 500), grenade at (500,500), dist = 122
        const player = makePlayer({
            id: 2, team: 2, health: 100, armour: 0,
            current_position: { x: 600, y: 500 - HALF_HIT_BOX, rotation: 0 },
        });
        const events = sim.tickGrenades([], [player], 2000);
        const hitEvent = events.find(e => e.type === 'EXPLOSION_HIT') as any;
        expect(hitEvent).toBeDefined();
        expect(hitEvent.damage).toBeLessThan(100);
        expect(hitEvent.damage).toBeGreaterThan(0);
    });

    it('given player behind wall, when detonating, then takes no explosion damage', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0);
        const player = makePlayer({
            id: 2, team: 2, health: 100, armour: 0,
            current_position: { x: 600, y: 500 - HALF_HIT_BOX, rotation: 0 },
        });
        // Wide wall between grenade and player
        const wall = testSegment(550, 0, 550, 1000);
        const events = sim.tickGrenades([wall], [player], 2000);
        expect(events.some(e => e.type === 'EXPLOSION_HIT')).toBe(false);
    });

    it('given dead player in range, when detonating, then does not damage dead player', () => {
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0);
        const player = makePlayer({
            id: 2, team: 2, dead: true,
            current_position: { x: 500 - HALF_HIT_BOX, y: 500 - HALF_HIT_BOX, rotation: 0 },
        });
        const events = sim.tickGrenades([], [player], 2000);
        expect(events.some(e => e.type === 'EXPLOSION_HIT')).toBe(false);
    });
});

// ---- Shrapnel ----

describe('shrapnel', () => {
    it('given FRAG detonation, when checking events, then spawns shrapnelCount bullets', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        sim.throwGrenade('FRAG', 1, 500, 500, 0, 0, 0, 0);
        const events = sim.tickGrenades([], [], 2000);
        const bulletSpawns = events.filter(e => e.type === 'BULLET_SPAWN');
        expect(bulletSpawns).toHaveLength(30); // FRAG shrapnelCount = 30
        vi.restoreAllMocks();
    });
});

// ---- Flash effect ----

describe('flash effect', () => {
    it('given player at center, when flash detonates, then intensity is at least 0.2', () => {
        sim.throwGrenade('FLASH', 1, 500, 500, 0, 0, 0, 0);
        const player = makePlayer({
            id: 2, current_position: { x: 500 - HALF_HIT_BOX, y: 500 - HALF_HIT_BOX, rotation: 0 },
        });
        const events = sim.tickGrenades([], [player], 1500);
        const flashEvent = events.find(e => e.type === 'FLASH_EFFECT') as any;
        expect(flashEvent.intensity).toBeCloseTo(1.0, 1); // at center, max intensity
    });

    it('given dead player in range, when flash detonates, then no FLASH_EFFECT', () => {
        sim.throwGrenade('FLASH', 1, 500, 500, 0, 0, 0, 0);
        const player = makePlayer({
            id: 2, dead: true,
            current_position: { x: 500 - HALF_HIT_BOX, y: 500 - HALF_HIT_BOX, rotation: 0 },
        });
        const events = sim.tickGrenades([], [player], 1500);
        expect(events.some(e => e.type === 'FLASH_EFFECT')).toBe(false);
    });

    it('given player outside flash radius, when detonating, then no FLASH_EFFECT', () => {
        sim.throwGrenade('FLASH', 1, 500, 500, 0, 0, 0, 0);
        // FLASH radius = 600. Place player 700px away.
        const player = makePlayer({
            id: 2, current_position: { x: 1200, y: 500, rotation: 0 },
        });
        const events = sim.tickGrenades([], [player], 1500);
        expect(events.some(e => e.type === 'FLASH_EFFECT')).toBe(false);
    });
});
