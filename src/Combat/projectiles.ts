import './combat.css';
import { angleToRadians } from '../Utilities/angleToRadians';
import { simulation } from '../Net/GameSimulation';
import { gameEventBus } from '../Net/GameEvent';

export function spawnBullet(
    ownerId: number,
    originX: number, originY: number,
    angleDeg: number,
    speed: number,
    damage: number,
    weaponType: string
) {
    const rad = angleToRadians(angleDeg);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);

    const events = simulation.spawnBullet(ownerId, originX, originY, dx, dy, speed, damage, weaponType);
    gameEventBus.emitAll(events);
}

export function updateProjectiles(
    segments: WallSegment[],
    players: player_info[],
) {
    const events = simulation.tickProjectiles(segments, players);
    gameEventBus.emitAll(events);
}
