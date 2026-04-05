import './combat.css';
import { angleToRadians } from '../Utilities/angleToRadians';
import { acquireProjectile, releaseProjectile } from './ProjectilePool';
import { raySegmentIntersect } from '../Player/Raycast/raycast';
import { HALF_HIT_BOX } from '../constants';
import { applyDamage, isPlayerDead } from './damage';
import { showHitMarker, spawnDamageNumber, showDamageIndicator } from '../HUD/hud';
import { ACTIVE_PLAYER, getPlayerElement } from '../Globals/Players';

const projectiles: ProjectileState[] = [];
let nextProjectileId = 0;

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

    const acquired = acquireProjectile(weaponType === 'SNIPER');
    if (!acquired) return; // pool exhausted
    const { element: el, poolIndex } = acquired;
    el.style.transform = `translate3d(${originX}px, ${originY}px, 0)`;

    projectiles.push({
        id: nextProjectileId++,
        x: originX,
        y: originY,
        dx,
        dy,
        speed,
        damage,
        ownerId,
        element: el,
        alive: true,
        poolIndex,
        weaponType,
    });
}

export function updateProjectiles(
    segments: WallSegment[],
    players: player_info[],
) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (!p.alive) continue;

        const newX = p.x + p.dx * p.speed;
        const newY = p.y + p.dy * p.speed;

        // Wall collision: check if ray from current pos in direction hits any segment within this frame's travel
        for (const seg of segments) {
            const t = raySegmentIntersect(
                p.x, p.y, p.dx, p.dy,
                seg.x1, seg.y1, seg.x2, seg.y2
            );
            if (t !== null && t >= 0 && t <= p.speed) {
                p.alive = false;
                break;
            }
        }

        // Player collision - sweep along bullet path to prevent tunneling
        if (p.alive) {
            for (const player of players) {
                if (player.id === p.ownerId) continue;
                if (isPlayerDead(player)) continue;

                const pcx = player.current_position.x + HALF_HIT_BOX;
                const pcy = player.current_position.y + HALF_HIT_BOX;

                // Project player center onto bullet travel segment to find closest point
                const ox = pcx - p.x;
                const oy = pcy - p.y;
                // t = dot(o, d) where d is (dx, dy) unit vector
                const t = Math.max(0, Math.min(p.speed, ox * p.dx + oy * p.dy));
                const closestX = p.x + p.dx * t;
                const closestY = p.y + p.dy * t;
                const distX = closestX - pcx;
                const distY = closestY - pcy;
                const distSq = distX * distX + distY * distY;

                if (distSq < HALF_HIT_BOX * HALF_HIT_BOX) {
                    const wasAlive = !isPlayerDead(player);
                    applyDamage(player, p.damage, p.ownerId);
                    const isKill = wasAlive && isPlayerDead(player);
                    // Show hit marker on shooter's crosshair
                    if (p.ownerId === ACTIVE_PLAYER) {
                        showHitMarker(isKill, player.name);
                        spawnDamageNumber(closestX, closestY, p.damage, isKill);
                    }
                    // Show directional damage indicator on the hit player's screen
                    if (player.id === ACTIVE_PLAYER) {
                        const angleFromBullet = Math.atan2(p.dy, p.dx) * 180 / Math.PI;
                        showDamageIndicator(angleFromBullet, player.current_position.rotation);
                    }
                    // Flash the hit player
                    const el = getPlayerElement(player.id);
                    if (el) {
                        el.classList.add('hit-flash');
                        setTimeout(() => el.classList.remove('hit-flash'), 150);
                    }
                    p.alive = false;
                    break;
                }
            }
        }

        // Bounds check
        if (p.alive && (newX < 0 || newX > 3000 || newY < 0 || newY > 3000)) {
            p.alive = false;
        }

        if (p.alive) {
            p.x = newX;
            p.y = newY;
            p.element.style.transform = `translate3d(${Math.round(newX)}px, ${Math.round(newY)}px, 0)`;
        } else {
            releaseProjectile(p.poolIndex);
            const last = projectiles.length - 1;
            if (i !== last) projectiles[i] = projectiles[last];
            projectiles.length = last;
        }
    }
}
