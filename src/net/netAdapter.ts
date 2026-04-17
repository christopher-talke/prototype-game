/**
 * Port interface for the game's network abstraction (Ports and Adapters pattern).
 *
 * Net layer - defines the contract between the game loop and the authoritative
 * game logic, which may run locally ({@link OfflineAdapter}) or on a remote
 * server ({@link WebSocketAdapter}). The game loop never talks to the
 * simulation directly; all communication passes through this interface.
 */

import type { GameEvent, PlayerInput } from './gameEvent';

/**
 * Abstraction over local or remote authoritative game logic.
 *
 * Consumed by the game loop and orchestration layer. Implementations must
 * provide input delivery, event subscription, per-frame tick, and read-only
 * accessors for match state used by the HUD and rendering layers.
 */
export interface NetAdapter {
    /** Whether this adapter runs the simulation locally or over the network. */
    mode: 'offline' | 'online';

    /**
     * Sends a player input to the authoritative game logic.
     * @param input - The player input to deliver.
     */
    sendInput(input: PlayerInput): void;

    /**
     * Subscribes to authoritative game events.
     * @param callback - Invoked each time a {@link GameEvent} is produced.
     */
    onEvent(callback: (event: GameEvent) => void): void;

    /**
     * Advances the adapter by one frame. For offline mode this ticks the
     * simulation; for online mode this flushes throttled inputs, advances
     * client-predicted projectiles, and interpolates remote players.
     * @param segments - Current wall segments in the environment.
     * @param players - Current player info array.
     * @param timestamp - Frame timestamp from requestAnimationFrame.
     */
    tick(segments: WallSegment[], players: player_info[], timestamp: number): void;

    /** Whether a round is currently in progress. */
    isRoundActive(): boolean;

    /** Whether a match is currently in progress (may span multiple rounds). */
    isMatchActive(): boolean;

    /** Seconds remaining in the current match timer. */
    getMatchTimeRemaining(): number;

    /**
     * Returns the game state (kills, deaths, money, points) for a player.
     * @param playerId - Player to look up.
     * @returns The state object, or undefined if not tracked.
     */
    getPlayerState(playerId: number): PlayerGameState | undefined;

    /** Returns game state objects for all tracked players. */
    getAllPlayerStates(): PlayerGameState[];

    /** Returns a map of team number to round wins. */
    getTeamRoundWins(): Record<number, number>;

    /** Returns the 1-based index of the current round. */
    getCurrentRound(): number;

    /** Returns the live projectile list for rendering. */
    getProjectiles(): readonly { id: number; x: number; y: number }[];

    /** Returns the live grenade list for rendering. */
    getGrenades(): readonly { id: number; x: number; y: number; detonated: boolean }[];

    /**
     * Returns the number of consecutive shots the player has fired without
     * pausing, used for recoil spread calculation.
     * @param playerId - Player to query.
     */
    getConsecutiveShots(playerId: number): number;

    /** Establishes the network connection (online adapter only). */
    connect?(): Promise<void>;

    /** Tears down the network connection and resets state (online adapter only). */
    disconnect?(): void;
}
