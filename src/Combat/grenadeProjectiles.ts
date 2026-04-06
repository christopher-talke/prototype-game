import { HALF_HIT_BOX } from '../constants';
import { getGrenadeDef } from './grenades';
import { environment } from '../Environment/environment';
import { simulation } from '../Net/GameSimulation';
import { gameEventBus } from '../Net/GameEvent';
import { getConfig } from '../Config/activeConfig';

// Mouse position tracked from interactivity
let mouseWorldX = 0;
let mouseWorldY = 0;

export function setMouseWorldPosition(x: number, y: number) {
    mouseWorldX = x;
    mouseWorldY = y;
}

export function getMouseWorldPosition(): { x: number; y: number } {
    return { x: mouseWorldX, y: mouseWorldY };
}

export function throwGrenade(type: GrenadeType, playerInfo: player_info, chargePercent: number = 1) {
    const def = getGrenadeDef(type);
    const cx = playerInfo.current_position.x + HALF_HIT_BOX;
    const cy = playerInfo.current_position.y + HALF_HIT_BOX;

    let dx = 0;
    let dy = 0;
    const minFraction = getConfig().grenades.minThrowFraction;
    const chargeFraction = minFraction + (1 - minFraction) * Math.max(0, Math.min(1, chargePercent));
    let speed = def.throwSpeed * chargeFraction;

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

    const events = simulation.throwGrenade(type, playerInfo.id, cx, cy, dx, dy, speed, performance.now());
    gameEventBus.emitAll(events);
}

export function detonateC4(playerId: number) {
    if (!simulation.hasPlacedC4(playerId)) return false;
    const events = simulation.detonateC4(playerId, environment.segments);
    gameEventBus.emitAll(events);
    return true;
}

export function hasPlacedC4(playerId: number): boolean {
    return simulation.hasPlacedC4(playerId);
}

export function updateGrenades(segments: WallSegment[], allPlayers: player_info[], timestamp: number) {
    const events = simulation.tickGrenades(segments, allPlayers, timestamp);
    gameEventBus.emitAll(events);
}
