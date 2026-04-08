import { simulation } from '../Net/GameSimulation';
import { gameEventBus } from '../Net/GameEvent';

export function isPlayerDead(player: player_info): boolean {
    return player.dead;
}