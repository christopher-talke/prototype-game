/**
 * Game simulation module responsible for handling core game mechanics such as movement, combat, and grenades.
 * This module is designed to be used by both the authoritative server simulation and the client-side prediction.
 * It operates on simple data structures and pure functions to ensure consistency across different environments.
 */

import type { GameEvent } from '@simulation/events';
import { raySegmentIntersect, isLineBlocked } from './detection/rayGeometry';
import { HALF_HIT_BOX } from '../constants';
import { getGrenadeDef } from '@simulation/combat/grenades';
import { getConfig } from '@config/activeConfig';

type SimProjectile = {
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

type SimGrenade = {
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

type Limits = { left: number; right: number; top: number; bottom: number };

const MIN_GRENADE_SPEED = 0.3;

export class GameSimulation {
    private limits: Limits = { left: 0, right: 3000, top: 0, bottom: 3000 };

    setLimits(limits: Limits) {
        this.limits = limits;
    }
    private projectiles: SimProjectile[] = [];
    private grenadesList: SimGrenade[] = [];
    private nextProjectileId = 0;
    private nextGrenadeId = 0;

    applyDamage(target: player_info, rawDamage: number, attackerId: number, players: player_info[]): GameEvent[] {
        if (target.dead) return [];

        const attacker = players.find(p => p.id === attackerId);
        const isFriendly = attacker !== undefined && target.team === attacker.team;
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
        } 
        
        else {
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

    spawnBullet(ownerId: number, x: number, y: number, dx: number, dy: number, speed: number, damage: number, weaponType?: string): GameEvent[] {
        const id = this.nextProjectileId++;
        this.projectiles.push({ id, x, y, dx, dy, speed, damage, ownerId, alive: true, weaponType});

        return [ 
            { type: 'BULLET_SPAWN', bulletId: id, ownerId, x, y, dx, dy, speed, weaponType }
        ];
    }

    tickProjectiles(segments: WallSegment[], players: player_info[]): GameEvent[] {
        const events: GameEvent[] = [];

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (!p.alive) continue;

            const newX = p.x + p.dx * p.speed;
            const newY = p.y + p.dy * p.speed;
            
            const bMinX = p.x < newX ? p.x : newX;
            const bMinY = p.y < newY ? p.y : newY;
            const bMaxX = p.x > newX ? p.x : newX;
            const bMaxY = p.y > newY ? p.y : newY;
            for (const seg of segments) {
                if (seg.maxX < bMinX || seg.minX > bMaxX || seg.maxY < bMinY || seg.minY > bMaxY) continue;
                const t = raySegmentIntersect(p.x, p.y, p.dx, p.dy, seg.x1, seg.y1, seg.x2, seg.y2);
                if (t !== null && t >= 0 && t <= p.speed) {
                    p.alive = false;
                    events.push({ type: 'BULLET_REMOVED', bulletId: p.id });
                    break;
                }
            }

            if (p.alive) {
                for (const player of players) { // Detect if we are hitting a player
                    if (player.id === p.ownerId) continue;
                    if (player.dead) continue;

                    const pcx = player.current_position.x + HALF_HIT_BOX;
                    const pcy = player.current_position.y + HALF_HIT_BOX;

                    // Scary math time... 
                    // Find closest point on bullet path to player center, and check if it's within hitbox radius
                    const ox = pcx - p.x;
                    const oy = pcy - p.y;
                    const t = Math.max(0, Math.min(p.speed, ox * p.dx + oy * p.dy));
                    const closestX = p.x + p.dx * t;
                    const closestY = p.y + p.dy * t;
                    const distX = closestX - pcx;
                    const distY = closestY - pcy;
                    const distSq = distX * distX + distY * distY;

                    // This allows for some leniency in hit registration, as the player doesn't have to be perfectly intersected by the bullet path to get hit. 
                    // This is intentional to account for high bullet speeds and low tick rates (Added this to fix a bug with snipers, but should help with general latency).
                    if (distSq < HALF_HIT_BOX * HALF_HIT_BOX) {
                        const wasAlive = !player.dead;
                        const dmgEvents = this.applyDamage(player, p.damage, p.ownerId, players);
                        for (let j = 0; j < dmgEvents.length; j++) events.push(dmgEvents[j]);
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

            if (p.alive && (newX < 0 || newX > this.limits.right || newY < 0 || newY > this.limits.bottom)) {
                p.alive = false;
                events.push({ type: 'BULLET_REMOVED', bulletId: p.id });
            }

            if (p.alive) {
                p.x = newX;
                p.y = newY;
            } 
            
            else {
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

    throwGrenade(type: GrenadeType, ownerId: number, x: number, y: number, dx: number, dy: number, speed: number, timestamp: number): GameEvent[] {
        const id = this.nextGrenadeId++;
        this.grenadesList.push({ id, type, x, y, dx, dy, speed, ownerId, spawnTime: timestamp, detonated: false});

        return [
            { type: 'GRENADE_SPAWN', grenadeId: id, grenadeType: type, ownerId, x, y, dx, dy, speed, isC4: type === 'C4' },
        ];
    }

    detonateC4(playerId: number, segments: WallSegment[]): GameEvent[] {
        for (const g of this.grenadesList) {
            if (g.type === 'C4' && g.ownerId === playerId && !g.detonated) {
                return this.detonateGrenade(g, [], segments);
            }
        }
        return [];
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

            if (g.speed > MIN_GRENADE_SPEED) {
                const newX = g.x + g.dx * g.speed;
                const newY = g.y + g.dy * g.speed;

                let bounced = false;
                const gMinX = g.x < newX ? g.x : newX;
                const gMinY = g.y < newY ? g.y : newY;
                const gMaxX = g.x > newX ? g.x : newX;
                const gMaxY = g.y > newY ? g.y : newY;
                for (const seg of segments) {
                    if (seg.maxX < gMinX || seg.minX > gMaxX || seg.maxY < gMinY || seg.minY > gMaxY) continue;
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

            const def = getGrenadeDef(g.type);
            if (g.type !== 'C4' && def.fuseTime > 0) {
                if (timestamp - g.spawnTime >= def.fuseTime) {
                    events.push(...this.detonateGrenade(g, allPlayers, segments));
                }
            }

            g.x = Math.max(0, Math.min(this.limits.right, g.x));
            g.y = Math.max(0, Math.min(this.limits.bottom, g.y));
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
            const dmgEvents = this.applyDamage(player, damage, g.ownerId, allPlayers);
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