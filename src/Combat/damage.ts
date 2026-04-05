import { simulation } from '../Net/GameSimulation';
import { gameEventBus } from '../Net/GameEvent';

export function isPlayerDead(player: player_info): boolean {
    return player.dead;
}

// Delegates state to simulation, emits events for ClientRenderer to handle rendering.
export function applyDamage(target: player_info, rawDamage: number, attackerId: number) {
    const events = simulation.applyDamage(target, rawDamage, attackerId);
    gameEventBus.emitAll(events);
}
