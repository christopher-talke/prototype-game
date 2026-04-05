import './grenade.css';
import { app } from '../main';
import { HALF_HIT_BOX } from '../constants';
import { getGrenadeDef } from './grenades';
import { spawnSmoke } from './smoke';
import { ACTIVE_PLAYER, getPlayerInfo } from '../Globals/Players';
import { playSound } from '../Audio/audio';
import { showHitMarker, spawnDamageNumber } from '../HUD/hud';
import { environment } from '../Environment/environment';
import { acquireBulletElement } from './projectiles';
import { renderDamageEvents } from './damage';
import { simulation } from '../Net/GameSimulation';
import { gameEventBus, type GameEvent } from '../Net/GameEvent';

// Mouse position tracked from interactivity
let mouseWorldX = 0;
let mouseWorldY = 0;

// Map grenadeId -> DOM element for rendering
const grenadeElements = new Map<number, HTMLElement>();

export function setMouseWorldPosition(x: number, y: number) {
    mouseWorldX = x;
    mouseWorldY = y;
}

export function getMouseWorldPosition(): { x: number; y: number } {
    return { x: mouseWorldX, y: mouseWorldY };
}

export function throwGrenade(type: GrenadeType, playerInfo: player_info) {
    const def = getGrenadeDef(type);
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;

    let dx = 0;
    let dy = 0;
    let speed = def.throwSpeed;

    if (type === 'C4') {
        speed = 0;
    } else {
        const tdx = mouseWorldX - cx;
        const tdy = mouseWorldY - cy;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist > 0) {
            dx = tdx / dist;
            dy = tdy / dist;
        }
    }

    // Simulation creates physics state
    const events = simulation.throwGrenade(type, playerInfo.id, cx, cy, dx, dy, speed, performance.now());

    // Create DOM element for rendering
    for (const event of events) {
        if (event.type === 'GRENADE_SPAWN') {
            const el = document.createElement('div');
            el.classList.add('grenade', `grenade-${type}`);
            if (type === 'C4') el.classList.add('placed');
            el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
            app.appendChild(el);
            grenadeElements.set(event.grenadeId, el);
        }
    }

    playSound('grenade_throw', { x: cx, y: cy });
    gameEventBus.emitAll(events);
}

export function detonateC4(playerId: number) {
    if (!simulation.hasPlacedC4(playerId)) return false;

    const events = simulation.detonateC4(playerId, environment.segments);
    processGrenadeEvents(events);
    gameEventBus.emitAll(events);
    return true;
}

export function hasPlacedC4(playerId: number): boolean {
    return simulation.hasPlacedC4(playerId);
}

export function updateGrenades(
    segments: WallSegment[],
    allPlayers: player_info[],
    timestamp: number,
) {
    // Simulation handles all physics + detonation
    const events = simulation.tickGrenades(segments, allPlayers, timestamp);
    processGrenadeEvents(events);

    // Update alive grenade positions from simulation state
    for (const g of simulation.getGrenades()) {
        const el = grenadeElements.get(g.id);
        if (el && !g.detonated) {
            el.style.transform = `translate3d(${Math.round(g.x)}px, ${Math.round(g.y)}px, 0)`;
        }
    }

    gameEventBus.emitAll(events);
}

function processGrenadeEvents(events: GameEvent[]) {
    const damageEvents: GameEvent[] = [];

    for (const event of events) {
        switch (event.type) {
            case 'PLAYER_DAMAGED':
            case 'PLAYER_KILLED':
                damageEvents.push(event);
                break;

            case 'GRENADE_DETONATE':
                renderDetonation(event.grenadeType, event.x, event.y, event.radius);
                break;

            case 'GRENADE_BOUNCE':
                playSound('grenade_bounce', { x: event.x, y: event.y });
                break;

            case 'GRENADE_REMOVED': {
                const el = grenadeElements.get(event.grenadeId);
                if (el) {
                    el.remove();
                    grenadeElements.delete(event.grenadeId);
                }
                break;
            }

            case 'EXPLOSION_HIT':
                if (event.attackerId === ACTIVE_PLAYER) {
                    showHitMarker(event.isKill, getPlayerInfo(event.targetId)?.name);
                    spawnDamageNumber(event.x, event.y, event.damage, event.isKill);
                }
                break;

            case 'FLASH_EFFECT':
                if (event.targetId === ACTIVE_PLAYER) {
                    showFlashOverlay(event.intensity, event.duration);
                }
                break;

            case 'SMOKE_DEPLOY':
                playSound('smoke_deploy', { x: event.x, y: event.y });
                spawnSmoke(event.x, event.y, event.radius, event.duration);
                break;

            case 'BULLET_SPAWN':
                // Shrapnel bullets created by simulation need pool elements for rendering
                acquireBulletElement(event.bulletId, event.x, event.y, false);
                break;
        }
    }

    if (damageEvents.length > 0) {
        renderDamageEvents(damageEvents);
    }
}

function renderDetonation(type: GrenadeType, x: number, y: number, radius: number) {
    switch (type) {
        case 'FRAG':
            spawnExplosionRing(x, y, radius, false);
            playSound('frag_explode', { x, y });
            break;
        case 'C4':
            spawnExplosionRing(x, y, radius, true);
            playSound('c4_explode', { x, y });
            break;
        case 'FLASH':
            playSound('flash_explode', { x, y });
            break;
        case 'SMOKE':
            // Sound handled by SMOKE_DEPLOY event
            break;
    }
}

function showFlashOverlay(intensity: number, duration: number) {
    const existing = document.querySelector('.flash-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.classList.add('flash-overlay');
    overlay.style.setProperty('--flash-intensity', `${intensity}`);
    overlay.style.setProperty('--flash-duration', `${duration}ms`);
    document.body.appendChild(overlay);

    void overlay.offsetWidth;
    overlay.classList.add('active');

    setTimeout(() => overlay.remove(), duration + 100);
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
