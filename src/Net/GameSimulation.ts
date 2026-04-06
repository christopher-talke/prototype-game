// GameSimulation: authoritative game state with NO DOM dependencies.
// All methods return GameEvent arrays. Callers (or the renderer) handle visuals/audio.

import type { GameEvent } from './GameEvent';
import { raySegmentIntersect, isLineBlocked } from '../Player/Raycast/rayGeometry';
import { HALF_HIT_BOX, MAP_SIZE } from '../constants';
import { getGrenadeDef } from '../Combat/grenades';
import { getActiveMap } from '../Maps/helpers';
import { createDefaultWeapon } from '../Combat/weapons';
import { getConfig } from '../Config/activeConfig';
import { getPlayerInfo } from '../Globals/Players';

// -- Simulation-only projectile state (no DOM) --
export type SimProjectile = {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    damage: number;
    ownerId: number;
    alive: boolean;
    weaponType?: string;
};

// -- Simulation-only grenade state (no DOM) --
export type SimGrenade = {
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

const MIN_GRENADE_SPEED = 0.3;

export class GameSimulation {
    private projectiles: SimProjectile[] = [];
    private grenadesList: SimGrenade[] = [];
    private nextProjectileId = 0;
    private nextGrenadeId = 0;

    // -- Damage --

    applyDamage(target: player_info, rawDamage: number, attackerId: number): GameEvent[] {
        if (target.dead) return [];

        const isFriendly = target.team === getPlayerInfo(attackerId)?.team;
        const friendlyFireEnabled = getConfig().match.friendlyFire;
        if (!friendlyFireEnabled && isFriendly) return [];

        const events: GameEvent[] = [];
        let remaining = rawDamage;

        if (target.armour > 0) {
            const absorbed = Math.min(rawDamage * getConfig().player.armorAbsorption, target.armour);
            target.armour = Math.round(target.armour - absorbed);
            remaining = rawDamage - absorbed;
        }

        target.health = Math.round(target.health - remaining);

        if (target.health <= 0) {
            target.health = 0;
            target.dead = true;
            events.push({
                type: 'PLAYER_DAMAGED',
                targetId: target.id,
                attackerId,
                damage: rawDamage,
                newHealth: 0,
                newArmor: target.armour,
            });
            events.push({
                type: 'PLAYER_KILLED',
                targetId: target.id,
                killerId: attackerId,
            });
        } else {
            events.push({
                type: 'PLAYER_DAMAGED',
                targetId: target.id,
                attackerId,
                damage: rawDamage,
                newHealth: target.health,
                newArmor: target.armour,
            });
        }

        return events;
    }

    // -- Respawn --

    respawnPlayer(target: player_info): GameEvent[] {
        const teamSpawns = getActiveMap().teamSpawns;
        const spawnPoints = teamSpawns[target.team] ?? Object.values(teamSpawns).flat();
        const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

        target.health = getConfig().player.maxHealth;
        target.armour = getConfig().player.startingArmor;
        target.dead = false;
        target.current_position.x = spawn.x;
        target.current_position.y = spawn.y;

        target.weapons = [createDefaultWeapon()];
        target.grenades = { FRAG: 0, FLASH: 0, SMOKE: 0, C4: 0 };

        return [
            {
                type: 'PLAYER_RESPAWN',
                playerId: target.id,
                x: spawn.x,
                y: spawn.y,
                rotation: target.current_position.rotation,
            },
        ];
    }

    // -- Projectiles --

    spawnBullet(ownerId: number, x: number, y: number, dx: number, dy: number, speed: number, damage: number, weaponType?: string): GameEvent[] {
        const id = this.nextProjectileId++;
        this.projectiles.push({
            id,
            x,
            y,
            dx,
            dy,
            speed,
            damage,
            ownerId,
            alive: true,
            weaponType,
        });
        return [
            {
                type: 'BULLET_SPAWN',
                bulletId: id,
                ownerId,
                x,
                y,
                dx,
                dy,
                speed,
                weaponType,
            },
        ];
    }

    tickProjectiles(segments: WallSegment[], players: player_info[]): GameEvent[] {
        const events: GameEvent[] = [];

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.alive) continue;

            const newX = p.x + p.dx * p.speed;
            const newY = p.y + p.dy * p.speed;

            // Wall collision
            for (const seg of segments) {
                const t = raySegmentIntersect(p.x, p.y, p.dx, p.dy, seg.x1, seg.y1, seg.x2, seg.y2);
                if (t !== null && t >= 0 && t <= p.speed) {
                    p.alive = false;
                    events.push({ type: 'BULLET_REMOVED', bulletId: p.id });
                    break;
                }
            }

            // Player collision
            if (p.alive) {
                for (const player of players) {
                    if (player.id === p.ownerId) continue;
                    if (player.dead) continue;

                    const pcx = player.current_position.x + HALF_HIT_BOX;
                    const pcy = player.current_position.y + HALF_HIT_BOX;

                    const ox = pcx - p.x;
                    const oy = pcy - p.y;
                    const t = Math.max(0, Math.min(p.speed, ox * p.dx + oy * p.dy));
                    const closestX = p.x + p.dx * t;
                    const closestY = p.y + p.dy * t;
                    const distX = closestX - pcx;
                    const distY = closestY - pcy;
                    const distSq = distX * distX + distY * distY;

                    if (distSq < HALF_HIT_BOX * HALF_HIT_BOX) {
                        const wasAlive = !player.dead;
                        const dmgEvents = this.applyDamage(player, p.damage, p.ownerId);
                        events.push(...dmgEvents);
                        const isKill = wasAlive && player.dead;

                        events.push({
                            type: 'BULLET_HIT',
                            bulletId: p.id,
                            targetId: player.id,
                            attackerId: p.ownerId,
                            damage: p.damage,
                            x: closestX,
                            y: closestY,
                            isKill,
                            bulletDx: p.dx,
                            bulletDy: p.dy,
                        });

                        p.alive = false;
                        events.push({ type: 'BULLET_REMOVED', bulletId: p.id });
                        break;
                    }
                }
            }

            // Bounds check
            if (p.alive && (newX < 0 || newX > MAP_SIZE || newY < 0 || newY > MAP_SIZE)) {
                p.alive = false;
                events.push({ type: 'BULLET_REMOVED', bulletId: p.id });
            }

            if (p.alive) {
                p.x = newX;
                p.y = newY;
            } else {
                // swap-and-pop
                const last = this.projectiles.length - 1;
                if (i !== last) this.projectiles[i] = this.projectiles[last];
                this.projectiles.length = last;
            }
        }

        return events;
    }

    getProjectiles(): readonly SimProjectile[] {
        return this.projectiles;
    }

    // -- Grenades --

    throwGrenade(type: GrenadeType, ownerId: number, x: number, y: number, dx: number, dy: number, speed: number, timestamp: number): GameEvent[] {
        const id = this.nextGrenadeId++;
        this.grenadesList.push({
            id,
            type,
            x,
            y,
            dx,
            dy,
            speed,
            ownerId,
            spawnTime: timestamp,
            detonated: false,
        });
        return [
            {
                type: 'GRENADE_SPAWN',
                grenadeId: id,
                grenadeType: type,
                ownerId,
                x,
                y,
                dx,
                dy,
                speed,
                isC4: type === 'C4',
            },
        ];
    }

    detonateC4(playerId: number, segments: WallSegment[]): GameEvent[] {
        for (const g of this.grenadesList) {
            if (g.type === 'C4' && g.ownerId === playerId && !g.detonated) {
                // Manual C4 detonation: no explosion damage to players, only shrapnel
                return this.detonateGrenade(g, [], segments);
            }
        }
        return [];
    }

    hasPlacedC4(playerId: number): boolean {
        return this.grenadesList.some((g) => g.type === 'C4' && g.ownerId === playerId && !g.detonated);
    }

    tickGrenades(segments: WallSegment[], allPlayers: player_info[], timestamp: number): GameEvent[] {
        const events: GameEvent[] = [];

        for (let i = this.grenadesList.length - 1; i >= 0; i--) {
            const g = this.grenadesList[i];
            if (g.detonated) {
                events.push({ type: 'GRENADE_REMOVED', grenadeId: g.id });
                const last = this.grenadesList.length - 1;
                if (i !== last) this.grenadesList[i] = this.grenadesList[last];
                this.grenadesList.length = last;
                continue;
            }

            // Move with friction
            if (g.speed > MIN_GRENADE_SPEED) {
                const newX = g.x + g.dx * g.speed;
                const newY = g.y + g.dy * g.speed;

                // Wall bounce
                let bounced = false;
                for (const seg of segments) {
                    const t = raySegmentIntersect(g.x, g.y, g.dx, g.dy, seg.x1, seg.y1, seg.x2, seg.y2);
                    if (t !== null && t >= 0 && t <= g.speed) {
                        const sx = seg.x2 - seg.x1;
                        const sy = seg.y2 - seg.y1;
                        const len = Math.sqrt(sx * sx + sy * sy);
                        const nx = -sy / len;
                        const ny = sx / len;

                        const dot = g.dx * nx + g.dy * ny;
                        g.dx = g.dx - 2 * dot * nx;
                        g.dy = g.dy - 2 * dot * ny;
                        g.speed *= 0.6;

                        g.x = g.x + g.dx * t * 0.9;
                        g.y = g.y + g.dy * t * 0.9;
                        bounced = true;

                        events.push({ type: 'GRENADE_BOUNCE', grenadeId: g.id, x: g.x, y: g.y });
                        break;
                    }
                }

                if (!bounced) {
                    g.x = newX;
                    g.y = newY;
                }

                g.speed *= getConfig().physics.grenadeFriction;
                if (g.speed <= MIN_GRENADE_SPEED) g.speed = 0;
            }

            // Fuse check (not C4)
            const def = getGrenadeDef(g.type);
            if (g.type !== 'C4' && def.fuseTime > 0) {
                if (timestamp - g.spawnTime >= def.fuseTime) {
                    events.push(...this.detonateGrenade(g, allPlayers, segments));
                }
            }

            // Bounds clamp
            g.x = Math.max(0, Math.min(MAP_SIZE, g.x));
            g.y = Math.max(0, Math.min(MAP_SIZE, g.y));
        }

        return events;
    }

    getGrenades(): readonly SimGrenade[] {
        return this.grenadesList;
    }

    private detonateGrenade(g: SimGrenade, allPlayers: player_info[], segments: WallSegment[]): GameEvent[] {
        g.detonated = true;
        const def = getGrenadeDef(g.type);
        const events: GameEvent[] = [];

        events.push({
            type: 'GRENADE_DETONATE',
            grenadeId: g.id,
            grenadeType: g.type,
            x: g.x,
            y: g.y,
            ownerId: g.ownerId,
            radius: def.radius,
        });

        switch (g.type) {
            case 'FRAG':
            case 'C4':
                events.push(...this.applyExplosionDamage(g, def, allPlayers, segments));
                events.push(...this.spawnShrapnel(g.x, g.y, g.ownerId, def));
                break;
            case 'FLASH':
                events.push(...this.applyFlashEffect(g, def, allPlayers));
                break;
            case 'SMOKE':
                events.push({
                    type: 'SMOKE_DEPLOY',
                    x: g.x,
                    y: g.y,
                    radius: def.radius,
                    duration: def.effectDuration,
                });
                break;
        }

        return events;
    }

    private applyExplosionDamage(g: SimGrenade, def: GrenadeDef, allPlayers: player_info[], segments: WallSegment[]): GameEvent[] {
        const events: GameEvent[] = [];

        for (const player of allPlayers) {
            if (player.dead) continue;

            const pcx = player.current_position.x + HALF_HIT_BOX;
            const pcy = player.current_position.y + HALF_HIT_BOX;
            const dx = pcx - g.x;
            const dy = pcy - g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > def.radius) continue;
            if (isLineBlocked(g.x, g.y, pcx, pcy, segments)) continue;

            const falloff = 1 - dist / def.radius;
            const damage = Math.round(def.damage * falloff);

            const wasAlive = !player.dead;
            const dmgEvents = this.applyDamage(player, damage, g.ownerId);
            events.push(...dmgEvents);
            const isKill = wasAlive && player.dead;

            events.push({
                type: 'EXPLOSION_HIT',
                targetId: player.id,
                attackerId: g.ownerId,
                damage,
                x: pcx,
                y: pcy,
                isKill,
            });
        }

        return events;
    }

    private applyFlashEffect(g: SimGrenade, def: GrenadeDef, allPlayers: player_info[]): GameEvent[] {
        const events: GameEvent[] = [];

        for (const player of allPlayers) {
            if (player.dead) continue;

            const pcx = player.current_position.x + HALF_HIT_BOX;
            const pcy = player.current_position.y + HALF_HIT_BOX;
            const dx = pcx - g.x;
            const dy = pcy - g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > def.radius) continue;

            const intensity = Math.max(0.2, 1 - dist / def.radius);
            const duration = def.effectDuration * intensity;

            events.push({
                type: 'FLASH_EFFECT',
                targetId: player.id,
                intensity,
                duration,
            });
        }

        return events;
    }

    private spawnShrapnel(x: number, y: number, ownerId: number, def: GrenadeDef): GameEvent[] {
        if (!def.shrapnelCount || !def.shrapnelDamage || !def.shrapnelSpeed) return [];

        const events: GameEvent[] = [];
        const angleStep = 360 / def.shrapnelCount;

        for (let i = 0; i < def.shrapnelCount; i++) {
            const angleDeg = angleStep * i + (Math.random() - 0.5) * angleStep * 0.6;
            const rad = (angleDeg * Math.PI) / 180;
            const dx = Math.cos(rad);
            const dy = Math.sin(rad);
            events.push(...this.spawnBullet(ownerId, x, y, dx, dy, def.shrapnelSpeed, def.shrapnelDamage, 'SHRAPNEL'));
        }

        return events;
    }
}

// Singleton simulation instance
export const simulation = new GameSimulation();
