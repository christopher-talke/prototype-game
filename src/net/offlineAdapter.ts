/**
 * Offline adapter - runs the authoritative simulation locally with no network.
 *
 * Net layer - implements {@link NetAdapter} by wrapping an
 * {@link AuthoritativeSimulation}. Used for single-player and local matches.
 * All inputs are processed synchronously and events are emitted on the
 * shared {@link gameEventBus}.
 */

import type { NetAdapter } from './netAdapter';
import type { PlayerInput, EventHandler } from './gameEvent';
import { gameEventBus } from './gameEvent';
import { AuthoritativeSimulation } from '@simulation/authoritativeSimulation';

/**
 * Local-only implementation of {@link NetAdapter}.
 *
 * Delegates every call to an internal {@link AuthoritativeSimulation},
 * emitting resulting events onto the {@link gameEventBus}. Exposes
 * {@link authSim} so the orchestration layer can configure the simulation
 * (set map, set players, init match, start round).
 */
class OfflineAdapter implements NetAdapter {
    readonly mode = 'offline' as const;
    readonly authSim = new AuthoritativeSimulation();

    /** @inheritdoc */
    onEvent(callback: EventHandler): void {
        gameEventBus.subscribe(callback);
    }

    /**
     * Processes a player input through the local simulation. For MOVE inputs,
     * emits a FOOTSTEP event when the player's position actually changed.
     * @param input - The player input to process.
     */
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

    /** @inheritdoc */
    tick(_segments: WallSegment[], _players: player_info[], timestamp: number): void {
        const events = this.authSim.tick(timestamp);
        gameEventBus.emitAll(events);
    }

    /** @inheritdoc */
    isRoundActive(): boolean {
        return this.authSim.isRoundActive();
    }

    /** @inheritdoc */
    isMatchActive(): boolean {
        return this.authSim.isMatchActive();
    }

    /** @inheritdoc */
    getMatchTimeRemaining(): number {
        return this.authSim.getMatchTimeRemaining();
    }

    /** @inheritdoc */
    getPlayerState(playerId: number): PlayerGameState | undefined {
        return this.authSim.getPlayerState(playerId);
    }

    /** @inheritdoc */
    getAllPlayerStates(): PlayerGameState[] {
        return this.authSim.getAllPlayerStates();
    }

    /** @inheritdoc */
    getTeamRoundWins(): Record<number, number> {
        return this.authSim.getTeamRoundWins();
    }

    /** @inheritdoc */
    getCurrentRound(): number {
        return this.authSim.getCurrentRound();
    }

    /** @inheritdoc */
    getProjectiles() {
        return this.authSim.simulation.getProjectiles();
    }

    /** @inheritdoc */
    getGrenades() {
        return this.authSim.simulation.getGrenades();
    }

    /** @inheritdoc */
    getConsecutiveShots(playerId: number): number {
        return this.authSim.getConsecutiveShots(playerId);
    }
}

export const offlineAdapter = new OfflineAdapter();
