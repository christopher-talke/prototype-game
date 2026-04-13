/**
 * NetAdapter defines the interface for communication between the game client and the authoritative game logic (which could be local or remote).
 * It abstracts away the details of how player inputs are sent and how game events are received, allowing for both offline (local) and online (networked) implementations.
 * The adapter also provides methods for querying the current match state, which can be used for UI updates and client-side prediction.
 */

import type { GameEvent, PlayerInput } from './gameEvent';

export interface NetAdapter {
    mode: 'offline' | 'online';

    /**
     * Sends a player input to the authoritative game logic.
     * @param input The player input to send.
     */
    sendInput(input: PlayerInput): void;

    /**
     * Subscribes to authoritative game events.
     * @param callback The callback to invoke when a game event occurs.
     */
    onEvent(callback: (event: GameEvent) => void): void;

    /**
     * Advances the simulation by one tick.
     * @param segments The wall segments in the game.
     * @param players The player information in the game.
     * @param timestamp The current timestamp.
     */
    tick(segments: WallSegment[], players: player_info[], timestamp: number): void;

    isMatchActive(): boolean;
    isRoundActive(): boolean;

    getMatchTimeRemaining(): number;
    getPlayerState(playerId: number): PlayerGameState | undefined;
    getAllPlayerStates(): PlayerGameState[];
    getTeamRoundWins(): Record<number, number>;
    getCurrentRound(): number;
    getProjectiles(): readonly { id: number; x: number; y: number }[];
    getGrenades(): readonly { id: number; x: number; y: number; detonated: boolean }[];
    getConsecutiveShots(playerId: number): number;

    connect?(): Promise<void>;
    disconnect?(): void;
}
