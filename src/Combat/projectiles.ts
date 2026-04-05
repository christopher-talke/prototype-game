import './combat.css';
import { app } from '../main';
import { angleToRadians } from '../Utilities/angleToRadians';
import { raySegmentIntersect } from '../Player/Raycast/raycast';
import { HALF_HIT_BOX } from '../constants';
import { applyDamage, isPlayerDead } from './damage';
import { showHitMarker, spawnDamageNumber, showDamageIndicator } from '../HUD/hud';
import { ACTIVE_PLAYER } from '../Globals/Players';

const projectiles: ProjectileState[] = [];
let nextProjectileId = 0;

export function spawnBullet(
    ownerId: number,
    originX: number, originY: number,
    angleDeg: number,
    speed: number,
    damage: number
) {
    const rad = angleToRadians(angleDeg);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    const el = document.createElement('div');
    el.classList.add('projectile');
    el.style.transform = `translate3d(${originX}px, ${originY}px, 0)`;
    app.appendChild(el);

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

        // Player collision
        if (p.alive) {
            for (const player of players) {
                if (player.id === p.ownerId) continue;
                if (isPlayerDead(player)) continue;

                const pcx = player.current_position.x + HALF_HIT_BOX;
                const pcy = player.current_position.y + HALF_HIT_BOX;
                const distX = newX - pcx;
                const distY = newY - pcy;
                const distSq = distX * distX + distY * distY;

                if (distSq < HALF_HIT_BOX * HALF_HIT_BOX) {
                    const wasAlive = !isPlayerDead(player);
                    applyDamage(player, p.damage, p.ownerId);
                    const isKill = wasAlive && isPlayerDead(player);
                    // Show hit marker on shooter's crosshair
                    if (p.ownerId === ACTIVE_PLAYER) {
                        showHitMarker(isKill, player.name);
                        spawnDamageNumber(newX, newY, p.damage, isKill);
                    }
                    // Show directional damage indicator on the hit player's screen
                    if (player.id === ACTIVE_PLAYER) {
                        const angleFromBullet = Math.atan2(p.dy, p.dx) * 180 / Math.PI;
                        showDamageIndicator(angleFromBullet);
                    }
                    // Flash the hit player
                    const el = document.getElementById(`player-${player.id}`);
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
            p.element.remove();
            projectiles.splice(i, 1);
        }
    }
}
