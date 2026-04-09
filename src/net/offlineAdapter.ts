// OfflineAdapter: runs the simulation locally with no network.
// Thin wrapper around AuthoritativeSimulation.

import type { NetAdapter } from './netAdapter';
import type { PlayerInput, EventHandler } from './gameEvent';
import { gameEventBus } from './gameEvent';
import { AuthoritativeSimulation } from '@simulation/authoritativeSimulation';

class OfflineAdapter implements NetAdapter {
    readonly mode = 'offline' as const;
    readonly authSim = new AuthoritativeSimulation();

    onEvent(callback: EventHandler): void {
        gameEventBus.subscribe(callback);
    }

    sendInput(input: PlayerInput): void {
        const player = this.authSim.getPlayers().find((p) => p.id === input.playerId);
        if (!player) return;

        const prevX = player.current_position.x;
        const prevY = player.current_position.y;

        const now = performance.now();
        const events = this.authSim.processInput(input, now);

        if (input.type === 'MOVE') {
            if (player.current_position.x !== prevX || player.current_position.y !== prevY) {
                events.push({ type: 'FOOTSTEP', playerId: player.id, timestamp: now });
            }
        }

        gameEventBus.emitAll(events);
    }

    tick(_segments: WallSegment[], _players: player_info[], timestamp: number): void {
        const events = this.authSim.tick(timestamp);
        gameEventBus.emitAll(events);
    }

    isRoundActive(): boolean {
        return this.authSim.isRoundActive();
    }

    isMatchActive(): boolean {
        return this.authSim.isMatchActive();
    }

    getMatchTimeRemaining(): number {
        return this.authSim.getMatchTimeRemaining();
    }

    getPlayerState(playerId: number): PlayerGameState | undefined {
        return this.authSim.getPlayerState(playerId);
    }

    getAllPlayerStates(): PlayerGameState[] {
        return this.authSim.getAllPlayerStates();
    }

    getTeamRoundWins(): Record<number, number> {
        return this.authSim.getTeamRoundWins();
    }

    getCurrentRound(): number {
        return this.authSim.getCurrentRound();
    }

    getProjectiles() {
        return this.authSim.simulation.getProjectiles();
    }

    getGrenades() {
        return this.authSim.simulation.getGrenades();
    }
}

export const offlineAdapter = new OfflineAdapter();
