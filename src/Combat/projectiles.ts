import './combat.css';
import { angleToRadians } from '../Utilities/angleToRadians';
import { acquireProjectile, releaseProjectile } from './ProjectilePool';
import { showHitMarker, spawnDamageNumber, showDamageIndicator } from '../HUD/hud';
import { ACTIVE_PLAYER, getPlayerElement, getPlayerInfo } from '../Globals/Players';
import { renderDamageEvents } from './damage';
import { simulation } from '../Net/GameSimulation';
import { gameEventBus, type GameEvent } from '../Net/GameEvent';

// Map bulletId -> pool element for rendering
const bulletElements = new Map<number, { element: HTMLElement; poolIndex: number }>();

// Acquire a pool element for a bullet that was already created in the simulation
// (used for shrapnel spawned by grenade detonation)
export function acquireBulletElement(bulletId: number, x: number, y: number, isSniper: boolean) {
    const acquired = acquireProjectile(isSniper);
    if (acquired) {
        acquired.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        bulletElements.set(bulletId, acquired);
    }
}

export function spawnBullet(
    ownerId: number,
    originX: number, originY: number,
    angleDeg: number,
    speed: number,
    damage: number,
    weaponType?: string
) {
    const rad = angleToRadians(angleDeg);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    // Simulation creates physics state
    const events = simulation.spawnBullet(ownerId, originX, originY, dx, dy, speed, damage, weaponType);

    // Acquire pool element for rendering
    for (const event of events) {
        if (event.type === 'BULLET_SPAWN') {
            const acquired = acquireProjectile(weaponType === 'SNIPER');
            if (acquired) {
                acquired.element.style.transform = `translate3d(${originX}px, ${originY}px, 0)`;
                bulletElements.set(event.bulletId, acquired);
            }
        }
    }

    gameEventBus.emitAll(events);
}

export function updateProjectiles(
    segments: WallSegment[],
    players: player_info[],
) {
    // Simulation handles all physics + damage
    const events = simulation.tickProjectiles(segments, players);

    // Process events for rendering
    const damageEvents: GameEvent[] = [];
    for (const event of events) {
        switch (event.type) {
            case 'PLAYER_DAMAGED':
            case 'PLAYER_KILLED':
                damageEvents.push(event);
                break;

            case 'BULLET_HIT': {
                if (event.attackerId === ACTIVE_PLAYER) {
                    showHitMarker(event.isKill, getPlayerInfo(event.targetId)?.name);
                    spawnDamageNumber(event.x, event.y, event.damage, event.isKill);
                }
                if (event.targetId === ACTIVE_PLAYER) {
                    const angleFromBullet = Math.atan2(event.bulletDy, event.bulletDx) * 180 / Math.PI;
                    const target = getPlayerInfo(event.targetId);
                    if (target) {
                        showDamageIndicator(angleFromBullet, target.current_position.rotation);
                    }
                }
                // Flash the hit player
                const el = getPlayerElement(event.targetId);
                if (el) {
                    el.classList.add('hit-flash');
                    setTimeout(() => el.classList.remove('hit-flash'), 150);
                }
                break;
            }

            case 'BULLET_REMOVED': {
                const entry = bulletElements.get(event.bulletId);
                if (entry) {
                    releaseProjectile(entry.poolIndex);
                    bulletElements.delete(event.bulletId);
                }
                break;
            }
        }
    }

    // Render damage/kill effects
    if (damageEvents.length > 0) {
        renderDamageEvents(damageEvents);
    }

    // Update alive bullet positions from simulation state
    for (const p of simulation.getProjectiles()) {
        const entry = bulletElements.get(p.id);
        if (entry) {
            entry.element.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
        }
    }

    gameEventBus.emitAll(events);
}
