import './grenade.css';
import { app } from '../main';
import { HALF_HIT_BOX } from '../constants';
import { getGrenadeDef } from './grenades';
import { raySegmentIntersect } from '../Player/Raycast/raycast';
import { isLineBlocked } from '../Player/Raycast/raycast';
import { applyDamage, isPlayerDead } from './damage';
import { spawnSmoke } from './smoke';
import { ACTIVE_PLAYER, getPlayerInfo } from '../Globals/Players';
import { playSound } from '../Audio/audio';
import { showHitMarker, spawnDamageNumber } from '../HUD/hud';
import { environment } from '../Environment/environment';
import { spawnBullet } from './projectiles';

const grenades: GrenadeState[] = [];
let nextGrenadeId = 0;
const FRICTION = 0.94;
const MIN_SPEED = 0.3;

// Mouse position tracked from interactivity
let mouseWorldX = 0;
let mouseWorldY = 0;

export function setMouseWorldPosition(x: number, y: number) {
    mouseWorldX = x;
    mouseWorldY = y;
}

export function throwGrenade(type: GrenadeType, playerInfo: player_info) {
    const def = getGrenadeDef(type);
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;

    let dx = 0;
    let dy = 0;
    let speed = def.throwSpeed;

    if (type === 'C4') {
        // C4 is placed at feet, no throw
        speed = 0;
    } else {
        // Direction toward mouse cursor
        const tdx = mouseWorldX - cx;
        const tdy = mouseWorldY - cy;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist > 0) {
            dx = tdx / dist;
            dy = tdy / dist;
        }
    }

    const el = document.createElement('div');
    el.classList.add('grenade', `grenade-${type}`);
    if (type === 'C4') el.classList.add('placed');
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    app.appendChild(el);

    playSound('grenade_throw', { x: cx, y: cy });

    grenades.push({
        id: nextGrenadeId++,
        type,
        x: cx,
        y: cy,
        dx,
        dy,
        speed,
        ownerId: playerInfo.id,
        element: el,
        spawnTime: performance.now(),
        detonated: false,
    });
}

export function detonateC4(playerId: number) {
    for (const g of grenades) {
        if (g.type === 'C4' && g.ownerId === playerId && !g.detonated) {
            detonateGrenade(g, []);
            return true;
        }
    }
    return false;
}

export function hasPlacedC4(playerId: number): boolean {
    return grenades.some(g => g.type === 'C4' && g.ownerId === playerId && !g.detonated);
}

export function updateGrenades(
    segments: WallSegment[],
    allPlayers: player_info[],
    timestamp: number,
) {
    for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        if (g.detonated) {
            g.element.remove();
            grenades.splice(i, 1);
            continue;
        }

        // Move with friction
        if (g.speed > MIN_SPEED) {
            const newX = g.x + g.dx * g.speed;
            const newY = g.y + g.dy * g.speed;

            // Wall bounce check
            let bounced = false;
            for (const seg of segments) {
                const t = raySegmentIntersect(
                    g.x, g.y, g.dx, g.dy,
                    seg.x1, seg.y1, seg.x2, seg.y2
                );
                if (t !== null && t >= 0 && t <= g.speed) {
                    // Reflect off segment normal
                    const sx = seg.x2 - seg.x1;
                    const sy = seg.y2 - seg.y1;
                    const len = Math.sqrt(sx * sx + sy * sy);
                    const nx = -sy / len;
                    const ny = sx / len;

                    // Reflect: d' = d - 2(d.n)n
                    const dot = g.dx * nx + g.dy * ny;
                    g.dx = g.dx - 2 * dot * nx;
                    g.dy = g.dy - 2 * dot * ny;
                    g.speed *= 0.6; // lose energy on bounce

                    // Place at bounce point
                    g.x = g.x + g.dx * t * 0.9;
                    g.y = g.y + g.dy * t * 0.9;
                    bounced = true;

                    playSound('grenade_bounce', { x: g.x, y: g.y });
                    break;
                }
            }

            if (!bounced) {
                g.x = newX;
                g.y = newY;
            }

            g.speed *= FRICTION;
            if (g.speed <= MIN_SPEED) g.speed = 0;
        }

        // Fuse check (not C4 - manual only)
        const def = getGrenadeDef(g.type);
        if (g.type !== 'C4' && def.fuseTime > 0) {
            if (timestamp - g.spawnTime >= def.fuseTime) {
                detonateGrenade(g, allPlayers);
            }
        }

        // Bounds clamp
        g.x = Math.max(0, Math.min(3000, g.x));
        g.y = Math.max(0, Math.min(3000, g.y));

        if (!g.detonated) {
            g.element.style.transform = `translate3d(${Math.round(g.x)}px, ${Math.round(g.y)}px, 0)`;
        }
    }
}

function detonateGrenade(g: GrenadeState, allPlayers: player_info[]) {
    g.detonated = true;
    const def = getGrenadeDef(g.type);

    switch (g.type) {
        case 'FRAG':
            detonateFrag(g, def, allPlayers);
            break;
        case 'C4':
            detonateC4Explosion(g, def, allPlayers);
            break;
        case 'FLASH':
            detonateFlash(g, def);
            break;
        case 'SMOKE':
            detonateSmokeGrenade(g, def);
            break;
    }
}

function detonateFrag(g: GrenadeState, def: GrenadeDef, allPlayers: player_info[]) {
    spawnExplosionRing(g.x, g.y, def.radius, false);
    playSound('frag_explode', { x: g.x, y: g.y });
    applyExplosionDamage(g, def, allPlayers);
    spawnShrapnel(g.x, g.y, g.ownerId, def);
}

function detonateC4Explosion(g: GrenadeState, def: GrenadeDef, allPlayers: player_info[]) {
    spawnExplosionRing(g.x, g.y, def.radius, true);
    playSound('c4_explode', { x: g.x, y: g.y });
    applyExplosionDamage(g, def, allPlayers);
    spawnShrapnel(g.x, g.y, g.ownerId, def);
}

function spawnShrapnel(x: number, y: number, ownerId: number, def: GrenadeDef) {
    if (!def.shrapnelCount || !def.shrapnelDamage || !def.shrapnelSpeed) return;
    const angleStep = 360 / def.shrapnelCount;
    for (let i = 0; i < def.shrapnelCount; i++) {
        const angle = angleStep * i + (Math.random() - 0.5) * angleStep * 0.6;
        spawnBullet(ownerId, x, y, angle, def.shrapnelSpeed, def.shrapnelDamage);
    }
}

function applyExplosionDamage(g: GrenadeState, def: GrenadeDef, allPlayers: player_info[]) {
    for (const player of allPlayers) {
        if (isPlayerDead(player)) continue;

        const pcx = player.current_position.x + HALF_HIT_BOX;
        const pcy = player.current_position.y + HALF_HIT_BOX;
        const dx = pcx - g.x;
        const dy = pcy - g.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > def.radius) continue;

        // Check wall blocking - walls protect from explosions
        if (isLineBlocked(g.x, g.y, pcx, pcy, environment.segments)) continue;

        // Linear falloff
        const falloff = 1 - (dist / def.radius);
        const damage = Math.round(def.damage * falloff);

        const wasAlive = !isPlayerDead(player);
        applyDamage(player, damage, g.ownerId);
        const isKill = wasAlive && isPlayerDead(player);

        if (g.ownerId === ACTIVE_PLAYER) {
            showHitMarker(isKill);
            spawnDamageNumber(pcx, pcy, damage, isKill);
        }
    }
}

function detonateFlash(g: GrenadeState, def: GrenadeDef) {
    playSound('flash_explode', { x: g.x, y: g.y });

    // Only affect the active player
    const player = ACTIVE_PLAYER ? getPlayerInfo(ACTIVE_PLAYER) : null;
    if (!player || isPlayerDead(player)) return;

    const pcx = player.current_position.x + HALF_HIT_BOX;
    const pcy = player.current_position.y + HALF_HIT_BOX;
    const dx = pcx - g.x;
    const dy = pcy - g.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > def.radius) return;

    // Intensity based on distance (closer = stronger)
    const intensity = Math.max(0.2, 1 - (dist / def.radius));
    const duration = def.effectDuration * intensity;

    showFlashOverlay(intensity, duration);
}

function showFlashOverlay(intensity: number, duration: number) {
    // Remove existing flash if any
    const existing = document.querySelector('.flash-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.classList.add('flash-overlay');
    overlay.style.setProperty('--flash-intensity', `${intensity}`);
    overlay.style.setProperty('--flash-duration', `${duration}ms`);
    document.body.appendChild(overlay);

    // Force reflow then activate
    void overlay.offsetWidth;
    overlay.classList.add('active');

    setTimeout(() => overlay.remove(), duration + 100);
}

function detonateSmokeGrenade(g: GrenadeState, def: GrenadeDef) {
    playSound('smoke_deploy', { x: g.x, y: g.y });
    spawnSmoke(g.x, g.y, def.radius, def.effectDuration);
}

function spawnExplosionRing(x: number, y: number, radius: number, isC4: boolean) {
    const ring = document.createElement('div');
    ring.classList.add('explosion-ring');
    if (isC4) ring.classList.add('c4');
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.width = `${radius * 2}px`;
    ring.style.height = `${radius * 2}px`;
    app.appendChild(ring);

    setTimeout(() => ring.remove(), 600);
}
