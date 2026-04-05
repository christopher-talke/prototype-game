// OfflineAdapter: runs the simulation locally with no network.
// Processes inputs immediately and emits events synchronously.

import type { NetAdapter } from './NetAdapter';
import type { PlayerInput, EventHandler } from './GameEvent';
import { gameEventBus } from './GameEvent';
import { simulation } from './GameSimulation';
import { moveWithCollision } from '../Player/collision';
import { getPlayerInfo } from '../Globals/Players';
import { getConfig } from '../Config/activeConfig';
import { throwGrenade, detonateC4 } from '../Combat/grenadeProjectiles';
import { startReload, switchWeapon, tryFire } from '../Combat/shooting';
import { buyWeapon, buyGrenade } from '../Combat/gameState';
import { playFootstep } from '../Audio/audio';

export class OfflineAdapter implements NetAdapter {
    readonly mode = 'offline' as const;

    onEvent(callback: EventHandler): void {
        gameEventBus.subscribe(callback);
    }

    sendInput(input: PlayerInput): void {
        const player = getPlayerInfo(input.playerId);
        if (!player) return;

        switch (input.type) {
            case 'MOVE': {
                const prevX = player.current_position.x;
                const prevY = player.current_position.y;
                const result = moveWithCollision(
                    player.current_position.x,
                    player.current_position.y,
                    input.dx * getConfig().player.speed,
                    input.dy * getConfig().player.speed,
                );
                player.current_position.x = result.x;
                player.current_position.y = result.y;
                if (result.x !== prevX || result.y !== prevY) {
                    playFootstep(player, performance.now());
                }
                break;
            }
            case 'ROTATE':
                player.current_position.rotation = input.rotation;
                break;
            case 'FIRE':
                tryFire(player, input.timestamp);
                break;
            case 'RELOAD':
                startReload(player);
                break;
            case 'SWITCH_WEAPON':
                switchWeapon(player, input.slotIndex);
                break;
            case 'THROW_GRENADE':
                if (player.grenades[input.grenadeType] > 0) {
                    player.grenades[input.grenadeType]--;
                    throwGrenade(input.grenadeType, player);
                }
                break;
            case 'DETONATE_C4':
                detonateC4(input.playerId);
                break;
            case 'BUY_WEAPON':
                buyWeapon(input.playerId, input.weaponType, player);
                break;
            case 'BUY_GRENADE':
                buyGrenade(input.playerId, input.grenadeType, player);
                break;
        }
    }

    tick(segments: WallSegment[], players: player_info[], timestamp: number): void {
        const bulletEvents = simulation.tickProjectiles(segments, players);
        gameEventBus.emitAll(bulletEvents);

        const grenadeEvents = simulation.tickGrenades(segments, players, timestamp);
        gameEventBus.emitAll(grenadeEvents);
    }
}

export const offlineAdapter = new OfflineAdapter();
